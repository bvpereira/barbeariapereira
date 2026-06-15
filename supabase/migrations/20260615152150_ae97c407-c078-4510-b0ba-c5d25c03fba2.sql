
-- ============ Tabela clube_assinatura ============
CREATE TABLE public.clube_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id uuid NOT NULL,
  nome text NOT NULL,
  valor_mensal numeric(10,2) NOT NULL CHECK (valor_mensal > 0),
  descricao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  regras_servicos jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clube_assinatura TO authenticated;
GRANT ALL ON public.clube_assinatura TO service_role;
ALTER TABLE public.clube_assinatura ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_clube_barbearia ON public.clube_assinatura(barbearia_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_clube_updated BEFORE UPDATE ON public.clube_assinatura
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Colunas em usuarios ============
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS clube_id uuid REFERENCES public.clube_assinatura(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clube_data_inicio date,
  ADD COLUMN IF NOT EXISTS clube_data_fim date,
  ADD COLUMN IF NOT EXISTS clube_valor_pago numeric(10,2),
  ADD COLUMN IF NOT EXISTS clube_historico jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============ Colunas em atendimentos ============
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS clube_id uuid,
  ADD COLUMN IF NOT EXISTS clube_desconto_aplicado numeric(10,2) NOT NULL DEFAULT 0;

-- ============ save_clube_assinatura ============
CREATE OR REPLACE FUNCTION public.save_clube_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid,
  p_id uuid, p_nome text, p_valor_mensal numeric, p_descricao text,
  p_ativo boolean, p_regras_servicos jsonb
) RETURNS public.clube_assinatura
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result public.clube_assinatura; v_regra jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  IF char_length(btrim(p_nome)) < 1 OR char_length(p_nome) > 100 THEN
    RAISE EXCEPTION 'Nome inválido (1-100 caracteres).';
  END IF;
  IF p_valor_mensal <= 0 THEN RAISE EXCEPTION 'Valor mensal deve ser positivo.'; END IF;
  IF jsonb_typeof(p_regras_servicos) <> 'array' OR jsonb_array_length(p_regras_servicos) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço.';
  END IF;

  FOR v_regra IN SELECT value FROM jsonb_array_elements(p_regras_servicos) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.servicos s
      WHERE s.id = (v_regra->>'servico_id')::uuid AND s.barbearia_id = p_barbearia_id) THEN
      RAISE EXCEPTION 'Serviço inválido nas regras.';
    END IF;
    IF COALESCE((v_regra->>'quantidade')::int, 0) < 1 THEN
      RAISE EXCEPTION 'Informe a quantidade de cada serviço.';
    END IF;
    IF v_regra->>'tipo_desconto' NOT IN ('percentual', 'fixo') THEN
      RAISE EXCEPTION 'Tipo de desconto inválido.';
    END IF;
    IF COALESCE((v_regra->>'valor_desconto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Informe o valor do desconto.';
    END IF;
    IF v_regra->>'tipo_desconto' = 'percentual' AND (v_regra->>'valor_desconto')::numeric > 100 THEN
      RAISE EXCEPTION 'Desconto percentual não pode passar de 100%%.';
    END IF;
    IF jsonb_typeof(v_regra->'dias_semana') <> 'array' OR jsonb_array_length(v_regra->'dias_semana') = 0 THEN
      RAISE EXCEPTION 'Selecione ao menos um dia da semana.';
    END IF;
  END LOOP;

  IF p_id IS NULL THEN
    INSERT INTO public.clube_assinatura (barbearia_id, nome, valor_mensal, descricao, ativo, regras_servicos)
    VALUES (p_barbearia_id, btrim(p_nome), p_valor_mensal, COALESCE(p_descricao, ''), p_ativo, p_regras_servicos)
    RETURNING * INTO v_result;
  ELSE
    UPDATE public.clube_assinatura
    SET nome = btrim(p_nome), valor_mensal = p_valor_mensal, descricao = COALESCE(p_descricao, ''),
        ativo = p_ativo, regras_servicos = p_regras_servicos
    WHERE id = p_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL
    RETURNING * INTO v_result;
    IF v_result.id IS NULL THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;
  END IF;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.save_clube_assinatura(uuid,text,uuid,uuid,text,numeric,text,boolean,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_clube_assinatura(uuid,text,uuid,uuid,text,numeric,text,boolean,jsonb) TO anon, authenticated, service_role;

-- ============ list_clubes_assinatura ============
CREATE OR REPLACE FUNCTION public.list_clubes_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid
) RETURNS TABLE (
  id uuid, nome text, valor_mensal numeric, descricao text, ativo boolean,
  regras_servicos jsonb, created_at timestamptz,
  assinantes jsonb, total_assinantes bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.valor_mensal, c.descricao, c.ativo, c.regras_servicos, c.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'data_fim', u.clube_data_fim) ORDER BY u.nome)
      FROM public.usuarios u
      WHERE u.clube_id = c.id AND u.barbearia_id = p_barbearia_id
        AND u.clube_data_fim >= CURRENT_DATE
    ), '[]'::jsonb) AS assinantes,
    (SELECT count(*) FROM public.usuarios u
      WHERE u.clube_id = c.id AND u.barbearia_id = p_barbearia_id
        AND u.clube_data_fim >= CURRENT_DATE)::bigint AS total_assinantes
  FROM public.clube_assinatura c
  WHERE c.barbearia_id = p_barbearia_id AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.list_clubes_assinatura(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_clubes_assinatura(uuid,text,uuid) TO anon, authenticated, service_role;

-- ============ toggle_clube_assinatura ============
CREATE OR REPLACE FUNCTION public.toggle_clube_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_id uuid, p_ativo boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  UPDATE public.clube_assinatura SET ativo = p_ativo
  WHERE id = p_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.toggle_clube_assinatura(uuid,text,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_clube_assinatura(uuid,text,uuid,uuid,boolean) TO anon, authenticated, service_role;

-- ============ delete_clube_assinatura ============
CREATE OR REPLACE FUNCTION public.delete_clube_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  UPDATE public.clube_assinatura SET deleted_at = now(), ativo = false
  WHERE id = p_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.delete_clube_assinatura(uuid,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_clube_assinatura(uuid,text,uuid,uuid) TO anon, authenticated, service_role;

-- ============ list_clube_expirando ============
CREATE OR REPLACE FUNCTION public.list_clube_expirando(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid
) RETURNS TABLE (
  cliente_id uuid, cliente_nome text, cliente_login text,
  clube_id uuid, clube_nome text, data_fim date, dias_restantes int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nome, u.login, c.id, c.nome, u.clube_data_fim,
    (u.clube_data_fim - CURRENT_DATE)::int
  FROM public.usuarios u
  JOIN public.clube_assinatura c ON c.id = u.clube_id
  WHERE u.barbearia_id = p_barbearia_id AND u.clube_id IS NOT NULL
    AND u.clube_data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
  ORDER BY u.clube_data_fim ASC;
END $$;

REVOKE ALL ON FUNCTION public.list_clube_expirando(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_clube_expirando(uuid,text,uuid) TO anon, authenticated, service_role;

-- ============ set_cliente_clube ============
CREATE OR REPLACE FUNCTION public.set_cliente_clube(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid,
  p_cliente_id uuid, p_clube_id uuid, p_data_inicio date, p_data_fim date, p_valor numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_atual record; v_clube_nome text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  IF p_data_fim < p_data_inicio THEN RAISE EXCEPTION 'Data final inválida.'; END IF;

  SELECT clube_id, clube_data_inicio, clube_data_fim, clube_valor_pago INTO v_atual
  FROM public.usuarios WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id AND nivel = 3;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  -- Arquivar assinatura atual se diferente
  IF v_atual.clube_id IS NOT NULL AND v_atual.clube_id <> p_clube_id THEN
    SELECT nome INTO v_clube_nome FROM public.clube_assinatura WHERE id = v_atual.clube_id;
    UPDATE public.usuarios SET clube_historico = clube_historico || jsonb_build_object(
      'clube_id', v_atual.clube_id, 'clube_nome', v_clube_nome,
      'data_inicio', v_atual.clube_data_inicio, 'data_fim', v_atual.clube_data_fim,
      'valor', v_atual.clube_valor_pago, 'arquivado_em', now()
    ) WHERE id = p_cliente_id;
  END IF;

  UPDATE public.usuarios
  SET clube_id = p_clube_id, clube_data_inicio = p_data_inicio,
      clube_data_fim = p_data_fim, clube_valor_pago = p_valor
  WHERE id = p_cliente_id;
END $$;

REVOKE ALL ON FUNCTION public.set_cliente_clube(uuid,text,uuid,uuid,uuid,date,date,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_cliente_clube(uuid,text,uuid,uuid,uuid,date,date,numeric) TO anon, authenticated, service_role;

-- ============ remove_cliente_clube ============
CREATE OR REPLACE FUNCTION public.remove_cliente_clube(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_cliente_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_atual record; v_clube_nome text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  SELECT clube_id, clube_data_inicio, clube_data_fim, clube_valor_pago INTO v_atual
  FROM public.usuarios WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id;
  IF v_atual.clube_id IS NOT NULL THEN
    SELECT nome INTO v_clube_nome FROM public.clube_assinatura WHERE id = v_atual.clube_id;
    UPDATE public.usuarios SET clube_historico = clube_historico || jsonb_build_object(
      'clube_id', v_atual.clube_id, 'clube_nome', v_clube_nome,
      'data_inicio', v_atual.clube_data_inicio, 'data_fim', v_atual.clube_data_fim,
      'valor', v_atual.clube_valor_pago, 'arquivado_em', now()
    ), clube_id = NULL, clube_data_inicio = NULL, clube_data_fim = NULL, clube_valor_pago = NULL
    WHERE id = p_cliente_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.remove_cliente_clube(uuid,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_cliente_clube(uuid,text,uuid,uuid) TO anon, authenticated, service_role;

-- ============ get_cliente_clube_status ============
-- Retorna info do clube ativo do cliente + serviços usados/disponíveis.
-- Pública para o próprio cliente (validação por senha) e admin.
CREATE OR REPLACE FUNCTION public.get_cliente_clube_status(
  p_barbearia_id uuid, p_cliente_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente record; v_clube record; v_regra jsonb; v_servico record;
  v_usados int; v_servicos jsonb := '[]'::jsonb;
BEGIN
  SELECT clube_id, clube_data_inicio, clube_data_fim, clube_valor_pago, clube_historico
    INTO v_cliente FROM public.usuarios
  WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id;
  IF NOT FOUND OR v_cliente.clube_id IS NULL THEN
    RETURN jsonb_build_object('ativo', false, 'historico', COALESCE(v_cliente.clube_historico, '[]'::jsonb));
  END IF;

  SELECT * INTO v_clube FROM public.clube_assinatura WHERE id = v_cliente.clube_id;

  FOR v_regra IN SELECT value FROM jsonb_array_elements(v_clube.regras_servicos) LOOP
    SELECT name INTO v_servico FROM public.servicos WHERE id = (v_regra->>'servico_id')::uuid;
    SELECT COUNT(*) INTO v_usados
    FROM public.atendimento_servicos asv
    JOIN public.atendimentos a ON a.id = asv.atendimento_id
    WHERE a.cliente_id = p_cliente_id AND a.barbearia_id = p_barbearia_id
      AND a.clube_id = v_clube.id AND asv.servico_id = (v_regra->>'servico_id')::uuid
      AND (a.data AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_cliente.clube_data_inicio AND v_cliente.clube_data_fim
      AND a.status IN ('Agendado', 'Finalizado');
    v_servicos := v_servicos || jsonb_build_object(
      'servico_id', v_regra->>'servico_id',
      'nome', COALESCE(v_servico.name, 'Serviço'),
      'quantidade', (v_regra->>'quantidade')::int,
      'usados', v_usados,
      'restantes', GREATEST(0, (v_regra->>'quantidade')::int - v_usados),
      'tipo_desconto', v_regra->>'tipo_desconto',
      'valor_desconto', (v_regra->>'valor_desconto')::numeric,
      'dias_semana', v_regra->'dias_semana'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ativo', v_cliente.clube_data_fim >= CURRENT_DATE,
    'expirado', v_cliente.clube_data_fim < CURRENT_DATE,
    'clube_id', v_clube.id, 'clube_nome', v_clube.nome, 'descricao', v_clube.descricao,
    'valor', v_cliente.clube_valor_pago, 'data_inicio', v_cliente.clube_data_inicio,
    'data_fim', v_cliente.clube_data_fim, 'servicos', v_servicos,
    'historico', COALESCE(v_cliente.clube_historico, '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_cliente_clube_status(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cliente_clube_status(uuid,uuid) TO anon, authenticated, service_role;

-- ============ list_clubes_publicos (cliente vê para se interessar) ============
CREATE OR REPLACE FUNCTION public.list_clubes_publicos(p_barbearia_id uuid)
RETURNS TABLE (id uuid, nome text, valor_mensal numeric, descricao text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, valor_mensal, descricao FROM public.clube_assinatura
  WHERE barbearia_id = p_barbearia_id AND ativo = true AND deleted_at IS NULL
  ORDER BY valor_mensal ASC;
$$;

REVOKE ALL ON FUNCTION public.list_clubes_publicos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_clubes_publicos(uuid) TO anon, authenticated, service_role;

-- ============ apply_clube_to_appointment ============
-- Calcula e aplica desconto do clube ativo do cliente para um atendimento existente.
-- Respeita: clube ativo no período, dia da semana permitido por serviço, quantidade restante.
CREATE OR REPLACE FUNCTION public.apply_clube_to_appointment(
  p_atendimento_id uuid, p_barbearia_id uuid, p_cliente_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_at record; v_cliente record; v_clube record; v_regra jsonb;
  v_data_local date; v_dow int;
  v_total_desc numeric(10,2) := 0; v_total_orig numeric(10,2) := 0; v_total_final numeric(10,2) := 0;
  v_item record; v_servico_regra jsonb; v_usados int; v_disp int; v_desc_item numeric(10,2);
BEGIN
  SELECT * INTO v_at FROM public.atendimentos
  WHERE id = p_atendimento_id AND barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;

  SELECT clube_id, clube_data_inicio, clube_data_fim INTO v_cliente
  FROM public.usuarios WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id;

  -- Limpa qualquer desconto de clube anteriormente aplicado neste atendimento
  UPDATE public.atendimento_servicos SET
    valor_servico = valor_original, valor_desconto = 0
  WHERE atendimento_id = p_atendimento_id AND tipo_desconto_cupom IS NULL;
  UPDATE public.atendimentos SET clube_id = NULL, clube_desconto_aplicado = 0,
    valor = COALESCE(valor_original, valor), valor_desconto = COALESCE(valor_desconto, 0) - clube_desconto_aplicado
  WHERE id = p_atendimento_id;

  IF v_cliente.clube_id IS NULL OR v_cliente.clube_data_fim IS NULL OR v_cliente.clube_data_fim < CURRENT_DATE THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'Cliente sem clube ativo.');
  END IF;

  v_data_local := (v_at.data AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_data_local < v_cliente.clube_data_inicio OR v_data_local > v_cliente.clube_data_fim THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'Data fora do período do clube.');
  END IF;

  SELECT * INTO v_clube FROM public.clube_assinatura
  WHERE id = v_cliente.clube_id AND ativo = true AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('aplicado', false, 'motivo', 'Clube inativo.'); END IF;

  v_dow := EXTRACT(DOW FROM v_data_local)::int;

  FOR v_item IN
    SELECT id, servico_id, valor_original FROM public.atendimento_servicos
    WHERE atendimento_id = p_atendimento_id ORDER BY id
  LOOP
    v_total_orig := v_total_orig + v_item.valor_original;
    v_servico_regra := NULL;
    SELECT value INTO v_servico_regra FROM jsonb_array_elements(v_clube.regras_servicos) value
    WHERE (value->>'servico_id')::uuid = v_item.servico_id LIMIT 1;

    v_desc_item := 0;
    IF v_servico_regra IS NOT NULL THEN
      -- dia permitido?
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_servico_regra->'dias_semana') d
        WHERE (d::text)::int = v_dow) THEN
        -- quantos já usou (em outros atendimentos do período, status válido, exclui o atual)
        SELECT COUNT(*) INTO v_usados
        FROM public.atendimento_servicos asv2
        JOIN public.atendimentos a2 ON a2.id = asv2.atendimento_id
        WHERE a2.cliente_id = p_cliente_id AND a2.barbearia_id = p_barbearia_id
          AND a2.clube_id = v_clube.id AND a2.id <> p_atendimento_id
          AND asv2.servico_id = v_item.servico_id
          AND (a2.data AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_cliente.clube_data_inicio AND v_cliente.clube_data_fim
          AND a2.status IN ('Agendado', 'Finalizado');
        v_disp := (v_servico_regra->>'quantidade')::int - v_usados;
        IF v_disp > 0 THEN
          IF v_servico_regra->>'tipo_desconto' = 'percentual' THEN
            v_desc_item := round(v_item.valor_original * (v_servico_regra->>'valor_desconto')::numeric / 100, 2);
          ELSE
            v_desc_item := LEAST((v_servico_regra->>'valor_desconto')::numeric, v_item.valor_original);
          END IF;
        END IF;
      END IF;
    END IF;

    UPDATE public.atendimento_servicos SET
      valor_desconto = COALESCE(valor_desconto, 0) + v_desc_item,
      valor_servico = GREATEST(v_item.valor_original - (COALESCE(valor_desconto, 0) + v_desc_item), 0)
    WHERE id = v_item.id;
    v_total_desc := v_total_desc + v_desc_item;
  END LOOP;

  v_total_final := GREATEST(v_total_orig - v_total_desc - COALESCE(v_at.valor_desconto, 0), 0);

  UPDATE public.atendimentos SET
    clube_id = v_clube.id,
    clube_desconto_aplicado = v_total_desc,
    valor_original = v_total_orig,
    valor_desconto = COALESCE(valor_desconto, 0) + v_total_desc,
    valor = GREATEST(valor - v_total_desc, 0)
  WHERE id = p_atendimento_id;

  RETURN jsonb_build_object('aplicado', v_total_desc > 0, 'desconto', v_total_desc,
    'valor_original', v_total_orig, 'valor_final', GREATEST(v_total_orig - v_total_desc, 0));
END $$;

REVOKE ALL ON FUNCTION public.apply_clube_to_appointment(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_clube_to_appointment(uuid,uuid,uuid) TO anon, authenticated, service_role;
