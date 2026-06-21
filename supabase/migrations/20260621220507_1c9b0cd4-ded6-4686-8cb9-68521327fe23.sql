-- 1) informacoes.cashback
ALTER TABLE public.informacoes
  ADD COLUMN IF NOT EXISTS cashback BOOLEAN NOT NULL DEFAULT false;

-- 2) servicos.cashback_*
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS cashback_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashback_percentual NUMERIC(5,2);

ALTER TABLE public.servicos
  DROP CONSTRAINT IF EXISTS servicos_cashback_percentual_chk;
ALTER TABLE public.servicos
  ADD CONSTRAINT servicos_cashback_percentual_chk
  CHECK (cashback_percentual IS NULL OR (cashback_percentual >= 0 AND cashback_percentual <= 100));

-- 3) atendimentos.cashback_*
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS cashback_gerado NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_usado NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 4) atendimento_servicos.cashback_gerado_item
ALTER TABLE public.atendimento_servicos
  ADD COLUMN IF NOT EXISTS cashback_gerado_item NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 5) Tabela cashback_movimentos (livro-razão)
CREATE TABLE IF NOT EXISTS public.cashback_movimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbearia_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  atendimento_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito','debito','estorno_credito','estorno_debito')),
  valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_movimentos TO authenticated;
GRANT ALL ON public.cashback_movimentos TO service_role;
ALTER TABLE public.cashback_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashback_mov_all ON public.cashback_movimentos;
CREATE POLICY cashback_mov_all ON public.cashback_movimentos FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cashback_mov_barb_cliente
  ON public.cashback_movimentos(barbearia_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_atendimento
  ON public.cashback_movimentos(atendimento_id);

-- 6) Função: saldo, a_receber e total economizado
CREATE OR REPLACE FUNCTION public.fn_cashback_saldo(p_barbearia_id UUID, p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disponivel NUMERIC(10,2);
  v_a_receber NUMERIC(10,2);
  v_economizado NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN tipo IN ('credito','estorno_debito') THEN valor
         WHEN tipo IN ('debito','estorno_credito') THEN -valor
         ELSE 0 END), 0)
  INTO v_disponivel
  FROM public.cashback_movimentos
  WHERE barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id;

  SELECT COALESCE(SUM(cashback_gerado), 0)
  INTO v_a_receber
  FROM public.atendimentos
  WHERE barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id
    AND status = 'Agendado';

  SELECT COALESCE(SUM(CASE WHEN tipo='debito' THEN valor WHEN tipo='estorno_debito' THEN -valor ELSE 0 END), 0)
  INTO v_economizado
  FROM public.cashback_movimentos
  WHERE barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id;

  RETURN jsonb_build_object(
    'disponivel', GREATEST(v_disponivel, 0),
    'a_receber', v_a_receber,
    'total_economizado', GREATEST(v_economizado, 0)
  );
END $$;

-- 7) Função: recalcula cashback_gerado por item (regras: clube zera, cupom proporcional)
CREATE OR REPLACE FUNCTION public.fn_recalc_cashback_atendimento(p_atendimento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at public.atendimentos%ROWTYPE;
  v_cu public.clube_usuarios%ROWTYPE;
  v_clube public.clube_assinatura%ROWTYPE;
  v_data_local DATE;
  v_dow INT;
  v_item RECORD;
  v_serv RECORD;
  v_perc NUMERIC(5,2);
  v_coberto_clube BOOLEAN;
  v_regra JSONB;
  v_usados INT;
  v_total NUMERIC(10,2) := 0;
  v_cashback_item NUMERIC(10,2);
  v_fator NUMERIC(10,6);
BEGIN
  SELECT * INTO v_at FROM public.atendimentos WHERE id = p_atendimento_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Assinatura ativa do cliente
  SELECT cu.* INTO v_cu FROM public.clube_usuarios cu
  WHERE cu.usuario_id = v_at.cliente_id
    AND cu.barbearia_id = v_at.barbearia_id
    AND cu.status = 'ativa'
  LIMIT 1;

  IF v_cu.id IS NOT NULL THEN
    SELECT * INTO v_clube FROM public.clube_assinatura
      WHERE id = v_cu.clube_id AND ativo = true AND deleted_at IS NULL;
  END IF;

  v_data_local := (v_at.data AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow := EXTRACT(DOW FROM v_data_local)::int;

  FOR v_item IN
    SELECT * FROM public.atendimento_servicos
    WHERE atendimento_id = p_atendimento_id
    ORDER BY id
  LOOP
    SELECT cashback_ativo, COALESCE(cashback_percentual, 0) AS perc
      INTO v_serv FROM public.servicos WHERE id = v_item.servico_id;

    v_perc := COALESCE(v_serv.perc, 0);
    v_cashback_item := 0;

    IF v_serv.cashback_ativo IS TRUE AND v_perc > 0 AND COALESCE(v_item.valor_original,0) > 0 THEN
      -- Regra 1: coberto por clube?
      v_coberto_clube := false;
      IF v_clube.id IS NOT NULL AND v_cu.data_inicio <= v_data_local AND v_cu.data_fim >= v_data_local THEN
        SELECT value INTO v_regra FROM jsonb_array_elements(v_clube.regras_servicos) value
          WHERE (value->>'servico_id')::uuid = v_item.servico_id LIMIT 1;
        IF v_regra IS NOT NULL THEN
          IF EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_regra->'dias_semana') d
            WHERE (d::text)::int = v_dow
          ) THEN
            SELECT COUNT(*) INTO v_usados
            FROM public.atendimento_servicos asv2
            JOIN public.atendimentos a2 ON a2.id = asv2.atendimento_id
            WHERE a2.cliente_id = v_at.cliente_id
              AND a2.barbearia_id = v_at.barbearia_id
              AND asv2.servico_id = v_item.servico_id
              AND (a2.data AT TIME ZONE 'America/Sao_Paulo')::date
                  BETWEEN v_cu.data_inicio AND v_cu.data_fim
              AND a2.status IN ('Agendado','Finalizado');
            IF v_usados <= (v_regra->>'quantidade')::int THEN
              v_coberto_clube := true;
            END IF;
          END IF;
        END IF;
      END IF;

      IF NOT v_coberto_clube THEN
        -- Regra 2: cupom proporcional
        IF COALESCE(v_item.valor_desconto, 0) > 0 AND v_item.tipo_desconto_cupom IS NOT NULL THEN
          v_fator := GREATEST(0, (v_item.valor_original - v_item.valor_desconto)) / v_item.valor_original;
          v_cashback_item := ROUND(v_item.valor_original * v_perc / 100 * v_fator, 2);
        ELSE
          v_cashback_item := ROUND(v_item.valor_original * v_perc / 100, 2);
        END IF;
      END IF;
    END IF;

    UPDATE public.atendimento_servicos
      SET cashback_gerado_item = v_cashback_item
      WHERE id = v_item.id;

    v_total := v_total + v_cashback_item;
  END LOOP;

  UPDATE public.atendimentos SET cashback_gerado = v_total WHERE id = p_atendimento_id;
END $$;

-- 8) Trigger em atendimento_servicos para recalc automático
CREATE OR REPLACE FUNCTION public.trg_recalc_cashback_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_cashback_atendimento(OLD.atendimento_id);
    RETURN OLD;
  END IF;
  PERFORM public.fn_recalc_cashback_atendimento(NEW.atendimento_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_atend_serv_cashback ON public.atendimento_servicos;
CREATE TRIGGER trg_atend_serv_cashback
AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_servicos
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_cashback_atendimento();

-- 9) Trigger em atendimentos: status & cashback_usado
CREATE OR REPLACE FUNCTION public.trg_atendimento_cashback_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC(10,2);
BEGIN
  -- INSERT: debitar cashback_usado se houver
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.cashback_usado, 0) > 0 THEN
      SELECT (public.fn_cashback_saldo(NEW.barbearia_id, NEW.cliente_id)->>'disponivel')::numeric INTO v_saldo;
      IF v_saldo < NEW.cashback_usado THEN
        RAISE EXCEPTION 'Saldo de cashback insuficiente.';
      END IF;
      INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
        VALUES (NEW.barbearia_id, NEW.cliente_id, NEW.id, 'debito', NEW.cashback_usado, 'Uso em atendimento');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Mudança de cashback_usado
    IF COALESCE(NEW.cashback_usado,0) <> COALESCE(OLD.cashback_usado,0) THEN
      -- estornar débito antigo
      IF COALESCE(OLD.cashback_usado,0) > 0 THEN
        INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
          VALUES (NEW.barbearia_id, NEW.cliente_id, NEW.id, 'estorno_debito', OLD.cashback_usado, 'Ajuste de uso');
      END IF;
      IF COALESCE(NEW.cashback_usado,0) > 0 THEN
        SELECT (public.fn_cashback_saldo(NEW.barbearia_id, NEW.cliente_id)->>'disponivel')::numeric INTO v_saldo;
        IF v_saldo < NEW.cashback_usado THEN
          RAISE EXCEPTION 'Saldo de cashback insuficiente.';
        END IF;
        INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
          VALUES (NEW.barbearia_id, NEW.cliente_id, NEW.id, 'debito', NEW.cashback_usado, 'Uso em atendimento');
      END IF;
    END IF;

    -- Mudança de status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- Crédito ao finalizar
      IF NEW.status = 'Finalizado' AND OLD.status <> 'Finalizado' AND COALESCE(NEW.cashback_gerado,0) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashback_movimentos
                       WHERE atendimento_id = NEW.id AND tipo = 'credito') THEN
          INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
            VALUES (NEW.barbearia_id, NEW.cliente_id, NEW.id, 'credito', NEW.cashback_gerado, 'Cashback ganho');
        END IF;
      END IF;
      -- Estorno do crédito ao sair de Finalizado
      IF OLD.status = 'Finalizado' AND NEW.status <> 'Finalizado' THEN
        IF EXISTS (SELECT 1 FROM public.cashback_movimentos
                   WHERE atendimento_id = NEW.id AND tipo = 'credito')
           AND NOT EXISTS (SELECT 1 FROM public.cashback_movimentos
                           WHERE atendimento_id = NEW.id AND tipo = 'estorno_credito') THEN
          INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
            SELECT NEW.barbearia_id, NEW.cliente_id, NEW.id, 'estorno_credito', valor, 'Reversão de cashback'
            FROM public.cashback_movimentos
            WHERE atendimento_id = NEW.id AND tipo = 'credito';
        END IF;
      END IF;
      -- Devolver débito ao cancelar/não comparecer
      IF NEW.status IN ('Cancelado','Não compareceu') AND OLD.status NOT IN ('Cancelado','Não compareceu')
         AND COALESCE(OLD.cashback_usado,0) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashback_movimentos
                       WHERE atendimento_id = NEW.id AND tipo = 'estorno_debito'
                         AND descricao = 'Cancelamento/não comparecimento') THEN
          INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
            VALUES (NEW.barbearia_id, NEW.cliente_id, NEW.id, 'estorno_debito', OLD.cashback_usado, 'Cancelamento/não comparecimento');
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_atendimento_cashback ON public.atendimentos;
CREATE TRIGGER trg_atendimento_cashback
AFTER INSERT OR UPDATE ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.trg_atendimento_cashback_status();