CREATE TABLE public.cupons_desconto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  codigo TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  dias_semana SMALLINT[] NOT NULL,
  limite_por_cliente TEXT NOT NULL DEFAULT 'ilimitado',
  somente_novos_clientes BOOLEAN NOT NULL DEFAULT false,
  inatividade_dias INTEGER,
  valor_minimo_total NUMERIC(10,2),
  tipo_desconto_total TEXT,
  valor_desconto_total NUMERIC(10,2),
  regras_servicos JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.cupons_desconto TO service_role;

ALTER TABLE public.cupons_desconto ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX cupons_desconto_codigo_barbearia_unique
  ON public.cupons_desconto (barbearia_id, upper(codigo))
  WHERE deleted_at IS NULL;
CREATE INDEX cupons_desconto_barbearia_created_idx
  ON public.cupons_desconto (barbearia_id, created_at DESC);
CREATE INDEX cupons_desconto_periodo_idx
  ON public.cupons_desconto (barbearia_id, data_inicio, data_fim)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_cupom_desconto()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  regra JSONB;
  servico_uuid UUID;
BEGIN
  NEW.nome := btrim(NEW.nome);
  NEW.descricao := btrim(COALESCE(NEW.descricao, ''));
  NEW.codigo := upper(btrim(NEW.codigo));

  IF char_length(NEW.nome) < 1 OR char_length(NEW.nome) > 100 THEN
    RAISE EXCEPTION 'O nome do cupom deve ter entre 1 e 100 caracteres.';
  END IF;
  IF char_length(NEW.descricao) > 500 THEN
    RAISE EXCEPTION 'A descrição deve ter no máximo 500 caracteres.';
  END IF;
  IF NEW.codigo !~ '^[A-Z0-9_-]{4,10}$' THEN
    RAISE EXCEPTION 'O código deve ter de 4 a 10 caracteres e usar apenas letras, números, hífen ou sublinhado.';
  END IF;
  IF NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'A data final não pode ser anterior à data inicial.';
  END IF;
  IF cardinality(NEW.dias_semana) IS NULL OR cardinality(NEW.dias_semana) = 0
     OR EXISTS (SELECT 1 FROM unnest(NEW.dias_semana) d WHERE d < 0 OR d > 6) THEN
    RAISE EXCEPTION 'Selecione ao menos um dia válido da semana.';
  END IF;
  IF NEW.limite_por_cliente NOT IN ('1', 'ilimitado') THEN
    RAISE EXCEPTION 'Limite por cliente inválido.';
  END IF;
  IF NEW.somente_novos_clientes THEN
    NEW.inatividade_dias := NULL;
  ELSIF NEW.inatividade_dias IS NOT NULL AND NEW.inatividade_dias < 1 THEN
    RAISE EXCEPTION 'O tempo de inatividade deve ser positivo.';
  END IF;
  IF NEW.valor_minimo_total IS NOT NULL THEN
    IF NEW.valor_minimo_total <= 0 THEN
      RAISE EXCEPTION 'O valor mínimo deve ser positivo.';
    END IF;
    IF NEW.tipo_desconto_total NOT IN ('percentual', 'fixo') OR NEW.valor_desconto_total IS NULL OR NEW.valor_desconto_total <= 0 THEN
      RAISE EXCEPTION 'Informe um desconto total válido.';
    END IF;
    IF NEW.tipo_desconto_total = 'percentual' AND NEW.valor_desconto_total > 100 THEN
      RAISE EXCEPTION 'O desconto percentual não pode ultrapassar 100%%.';
    END IF;
  ELSE
    NEW.tipo_desconto_total := NULL;
    NEW.valor_desconto_total := NULL;
  END IF;
  IF jsonb_typeof(NEW.regras_servicos) <> 'array' OR jsonb_array_length(NEW.regras_servicos) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço.';
  END IF;

  FOR regra IN SELECT value FROM jsonb_array_elements(NEW.regras_servicos)
  LOOP
    BEGIN
      servico_uuid := (regra->>'servico_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Serviço inválido nas regras do cupom.';
    END;
    IF NOT EXISTS (
      SELECT 1 FROM public.servicos s
      WHERE s.id = servico_uuid AND s.barbearia_id = NEW.barbearia_id
    ) THEN
      RAISE EXCEPTION 'Um serviço selecionado não pertence à barbearia.';
    END IF;
    IF NEW.valor_minimo_total IS NULL THEN
      IF regra->>'tipo_desconto' NOT IN ('percentual', 'fixo')
         OR COALESCE((regra->>'valor_desconto')::numeric, 0) <= 0 THEN
        RAISE EXCEPTION 'Informe o desconto de cada serviço selecionado.';
      END IF;
      IF regra->>'tipo_desconto' = 'percentual' AND (regra->>'valor_desconto')::numeric > 100 THEN
        RAISE EXCEPTION 'O desconto percentual não pode ultrapassar 100%%.';
      END IF;
    END IF;
  END LOOP;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cupom_desconto_trigger
BEFORE INSERT OR UPDATE ON public.cupons_desconto
FOR EACH ROW EXECUTE FUNCTION public.validate_cupom_desconto();

ALTER TABLE public.atendimentos
  ADD COLUMN cupom_id UUID REFERENCES public.cupons_desconto(id) ON DELETE SET NULL,
  ADD COLUMN cupom_codigo TEXT,
  ADD COLUMN cupom_nome TEXT,
  ADD COLUMN cupom_status TEXT,
  ADD COLUMN cupom_motivo_invalidacao TEXT,
  ADD COLUMN valor_original NUMERIC(10,2),
  ADD COLUMN valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN cupom_aplicado_em TIMESTAMPTZ,
  ADD COLUMN cupom_invalidado_em TIMESTAMPTZ;

UPDATE public.atendimentos SET valor_original = valor WHERE valor_original IS NULL;
ALTER TABLE public.atendimentos ALTER COLUMN valor_original SET NOT NULL;

ALTER TABLE public.atendimento_servicos
  ADD COLUMN valor_original NUMERIC(10,2),
  ADD COLUMN valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN tipo_desconto_cupom TEXT,
  ADD COLUMN valor_regra_cupom NUMERIC(10,2);

UPDATE public.atendimento_servicos SET valor_original = valor_servico WHERE valor_original IS NULL;
ALTER TABLE public.atendimento_servicos ALTER COLUMN valor_original SET NOT NULL;

CREATE INDEX atendimentos_cupom_cliente_idx
  ON public.atendimentos (cupom_id, cliente_id, cupom_status)
  WHERE cupom_id IS NOT NULL;
CREATE INDEX atendimentos_cupom_barbearia_idx
  ON public.atendimentos (barbearia_id, cupom_id)
  WHERE cupom_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_coupon_to_appointment(
  p_atendimento_id UUID,
  p_barbearia_id UUID,
  p_cliente_id UUID,
  p_codigo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupom public.cupons_desconto%ROWTYPE;
  v_atendimento public.atendimentos%ROWTYPE;
  v_data_local DATE;
  v_total_original NUMERIC(10,2);
  v_desconto_total NUMERIC(10,2) := 0;
  v_total_final NUMERIC(10,2);
  v_elegiveis UUID[];
  v_regra JSONB;
  v_item RECORD;
  v_desconto_item NUMERIC(10,2);
  v_soma_final NUMERIC(10,2) := 0;
  v_ultimo_id UUID;
  v_detalhes JSONB := '[]'::jsonb;
  v_ultimo_finalizado TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_atendimento FROM public.atendimentos
  WHERE id = p_atendimento_id AND barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;

  SELECT * INTO v_cupom FROM public.cupons_desconto
  WHERE barbearia_id = p_barbearia_id AND upper(codigo) = upper(btrim(p_codigo)) AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado.'; END IF;

  v_data_local := (v_atendimento.data AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_data_local < v_cupom.data_inicio THEN RAISE EXCEPTION 'Este cupom ainda não está ativo.'; END IF;
  IF v_data_local > v_cupom.data_fim THEN RAISE EXCEPTION 'Este cupom expirou.'; END IF;
  IF NOT (extract(dow FROM v_data_local)::smallint = ANY(v_cupom.dias_semana)) THEN
    RAISE EXCEPTION 'Cupom indisponível para o dia selecionado.';
  END IF;

  SELECT array_agg((x->>'servico_id')::uuid) INTO v_elegiveis
  FROM jsonb_array_elements(v_cupom.regras_servicos) x;
  IF NOT EXISTS (
    SELECT 1 FROM public.atendimento_servicos a
    WHERE a.atendimento_id = p_atendimento_id AND a.servico_id = ANY(v_elegiveis)
  ) THEN RAISE EXCEPTION 'Cupom não válido para os serviços selecionados.'; END IF;

  IF v_cupom.somente_novos_clientes AND EXISTS (
    SELECT 1 FROM public.atendimentos a
    WHERE a.barbearia_id = p_barbearia_id AND a.cliente_id = p_cliente_id AND a.id <> p_atendimento_id
  ) THEN RAISE EXCEPTION 'Este cupom é exclusivo para novos clientes.'; END IF;

  IF v_cupom.inatividade_dias IS NOT NULL THEN
    SELECT max(a.data) INTO v_ultimo_finalizado FROM public.atendimentos a
    WHERE a.barbearia_id = p_barbearia_id AND a.cliente_id = p_cliente_id
      AND a.id <> p_atendimento_id AND a.status = 'Finalizado';
    IF v_ultimo_finalizado IS NOT NULL AND v_data_local - (v_ultimo_finalizado AT TIME ZONE 'America/Sao_Paulo')::date <= v_cupom.inatividade_dias THEN
      RAISE EXCEPTION 'Este cupom exige % dias sem atendimento.', v_cupom.inatividade_dias;
    END IF;
  END IF;

  IF v_cupom.limite_por_cliente = '1' AND EXISTS (
    SELECT 1 FROM public.atendimentos a
    WHERE a.cupom_id = v_cupom.id AND a.cliente_id = p_cliente_id
      AND a.id <> p_atendimento_id AND a.cupom_status = 'aplicado'
      AND a.status <> 'Não compareceu'
  ) THEN RAISE EXCEPTION 'Você já utilizou este cupom.'; END IF;

  SELECT COALESCE(sum(valor_original), 0) INTO v_total_original
  FROM public.atendimento_servicos WHERE atendimento_id = p_atendimento_id;
  IF v_cupom.valor_minimo_total IS NOT NULL AND v_total_original < v_cupom.valor_minimo_total THEN
    RAISE EXCEPTION 'O valor mínimo para este cupom é R$ %.', v_cupom.valor_minimo_total;
  END IF;

  IF v_cupom.valor_minimo_total IS NOT NULL THEN
    v_desconto_total := CASE WHEN v_cupom.tipo_desconto_total = 'percentual'
      THEN round(v_total_original * v_cupom.valor_desconto_total / 100, 2)
      ELSE least(v_cupom.valor_desconto_total, v_total_original) END;
    FOR v_item IN SELECT * FROM public.atendimento_servicos WHERE atendimento_id = p_atendimento_id ORDER BY id LOOP
      v_ultimo_id := v_item.id;
      v_desconto_item := CASE WHEN v_total_original = 0 THEN 0 ELSE round(v_desconto_total * v_item.valor_original / v_total_original, 2) END;
      UPDATE public.atendimento_servicos SET
        valor_desconto = v_desconto_item,
        valor_servico = greatest(v_item.valor_original - v_desconto_item, 0),
        tipo_desconto_cupom = 'rateio_total',
        valor_regra_cupom = v_cupom.valor_desconto_total
      WHERE id = v_item.id;
      v_soma_final := v_soma_final + greatest(v_item.valor_original - v_desconto_item, 0);
    END LOOP;
    v_total_final := greatest(v_total_original - v_desconto_total, 0);
    IF v_ultimo_id IS NOT NULL AND v_soma_final <> v_total_final THEN
      UPDATE public.atendimento_servicos SET valor_servico = valor_servico + (v_total_final - v_soma_final),
        valor_desconto = valor_original - (valor_servico + (v_total_final - v_soma_final))
      WHERE id = v_ultimo_id;
    END IF;
  ELSE
    FOR v_item IN SELECT * FROM public.atendimento_servicos WHERE atendimento_id = p_atendimento_id ORDER BY id LOOP
      SELECT value INTO v_regra FROM jsonb_array_elements(v_cupom.regras_servicos)
      WHERE (value->>'servico_id')::uuid = v_item.servico_id LIMIT 1;
      IF v_regra IS NULL THEN
        v_desconto_item := 0;
        UPDATE public.atendimento_servicos SET valor_desconto = 0, valor_servico = valor_original,
          tipo_desconto_cupom = NULL, valor_regra_cupom = NULL WHERE id = v_item.id;
      ELSE
        v_desconto_item := CASE WHEN v_regra->>'tipo_desconto' = 'percentual'
          THEN round(v_item.valor_original * (v_regra->>'valor_desconto')::numeric / 100, 2)
          ELSE least((v_regra->>'valor_desconto')::numeric, v_item.valor_original) END;
        UPDATE public.atendimento_servicos SET valor_desconto = v_desconto_item,
          valor_servico = v_item.valor_original - v_desconto_item,
          tipo_desconto_cupom = v_regra->>'tipo_desconto',
          valor_regra_cupom = (v_regra->>'valor_desconto')::numeric WHERE id = v_item.id;
      END IF;
      v_desconto_total := v_desconto_total + v_desconto_item;
    END LOOP;
    v_total_final := v_total_original - v_desconto_total;
  END IF;

  UPDATE public.atendimentos SET cupom_id = v_cupom.id, cupom_codigo = v_cupom.codigo,
    cupom_nome = v_cupom.nome, cupom_status = 'aplicado', cupom_motivo_invalidacao = NULL,
    valor_original = v_total_original, valor_desconto = v_desconto_total, valor = v_total_final,
    cupom_aplicado_em = COALESCE(cupom_aplicado_em, now()), cupom_invalidado_em = NULL
  WHERE id = p_atendimento_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('servico_id', a.servico_id, 'nome', a.name_servico,
    'valor_original', a.valor_original, 'valor_desconto', a.valor_desconto, 'valor_final', a.valor_servico)), '[]'::jsonb)
  INTO v_detalhes FROM public.atendimento_servicos a WHERE a.atendimento_id = p_atendimento_id;

  RETURN jsonb_build_object('cupom_id', v_cupom.id, 'codigo', v_cupom.codigo, 'nome', v_cupom.nome,
    'valor_original', v_total_original, 'valor_desconto', v_desconto_total, 'valor_final', v_total_final,
    'servicos', v_detalhes);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_coupon_to_appointment(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_coupon_to_appointment(UUID, UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.remove_coupon_from_appointment(
  p_atendimento_id UUID,
  p_reason TEXT DEFAULT 'Cupom removido.'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.atendimento_servicos SET valor_servico = valor_original, valor_desconto = 0,
    tipo_desconto_cupom = NULL, valor_regra_cupom = NULL
  WHERE atendimento_id = p_atendimento_id;
  UPDATE public.atendimentos SET valor = valor_original, valor_desconto = 0,
    cupom_status = 'invalidado', cupom_motivo_invalidacao = p_reason, cupom_invalidado_em = now()
  WHERE id = p_atendimento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_coupon_from_appointment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_coupon_from_appointment(UUID, TEXT) TO service_role;