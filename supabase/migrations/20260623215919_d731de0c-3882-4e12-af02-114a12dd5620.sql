
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS cashback_saldo NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_receber NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_usado NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_recalc_cashback_usuario(p_barbearia_id uuid, p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC(10,2);
  v_receber NUMERIC(10,2);
  v_usado NUMERIC(10,2);
BEGIN
  IF p_cliente_id IS NULL OR p_barbearia_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN tipo IN ('credito','estorno_debito') THEN valor
         WHEN tipo IN ('debito','estorno_credito') THEN -valor
         ELSE 0 END), 0)
  INTO v_saldo
  FROM public.cashback_movimentos
  WHERE barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id;

  SELECT COALESCE(SUM(CASE WHEN tipo='debito' THEN valor WHEN tipo='estorno_debito' THEN -valor ELSE 0 END), 0)
  INTO v_usado
  FROM public.cashback_movimentos
  WHERE barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id;

  SELECT COALESCE(SUM(cashback_gerado), 0)
  INTO v_receber
  FROM public.atendimentos
  WHERE barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id
    AND status = 'Agendado';

  UPDATE public.usuarios
  SET cashback_saldo = GREATEST(v_saldo, 0),
      cashback_receber = v_receber,
      cashback_usado = GREATEST(v_usado, 0)
  WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_cashback_movimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_cashback_usuario(OLD.barbearia_id, OLD.cliente_id);
    RETURN OLD;
  ELSE
    PERFORM public.fn_recalc_cashback_usuario(NEW.barbearia_id, NEW.cliente_id);
    IF TG_OP = 'UPDATE' AND (OLD.cliente_id <> NEW.cliente_id OR OLD.barbearia_id <> NEW.barbearia_id) THEN
      PERFORM public.fn_recalc_cashback_usuario(OLD.barbearia_id, OLD.cliente_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_cashback_atendimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_cashback_usuario(OLD.barbearia_id, OLD.cliente_id);
    RETURN OLD;
  ELSE
    PERFORM public.fn_recalc_cashback_usuario(NEW.barbearia_id, NEW.cliente_id);
    IF TG_OP = 'UPDATE' AND (COALESCE(OLD.cliente_id::text,'') <> COALESCE(NEW.cliente_id::text,'') OR OLD.barbearia_id <> NEW.barbearia_id) THEN
      PERFORM public.fn_recalc_cashback_usuario(OLD.barbearia_id, OLD.cliente_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashback_mov_recalc ON public.cashback_movimentos;
CREATE TRIGGER trg_cashback_mov_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.cashback_movimentos
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_cashback_movimentos();

DROP TRIGGER IF EXISTS trg_atendimentos_cashback_recalc ON public.atendimentos;
CREATE TRIGGER trg_atendimentos_cashback_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_cashback_atendimentos();

-- Backfill existing data
UPDATE public.usuarios u
SET cashback_saldo = GREATEST(COALESCE(s.saldo,0), 0),
    cashback_usado = GREATEST(COALESCE(s.usado,0), 0)
FROM (
  SELECT barbearia_id, cliente_id,
    SUM(CASE WHEN tipo IN ('credito','estorno_debito') THEN valor
             WHEN tipo IN ('debito','estorno_credito') THEN -valor ELSE 0 END) AS saldo,
    SUM(CASE WHEN tipo='debito' THEN valor WHEN tipo='estorno_debito' THEN -valor ELSE 0 END) AS usado
  FROM public.cashback_movimentos
  GROUP BY barbearia_id, cliente_id
) s
WHERE u.id = s.cliente_id AND u.barbearia_id = s.barbearia_id;

UPDATE public.usuarios u
SET cashback_receber = COALESCE(r.total, 0)
FROM (
  SELECT barbearia_id, cliente_id, SUM(cashback_gerado) AS total
  FROM public.atendimentos
  WHERE status = 'Agendado'
  GROUP BY barbearia_id, cliente_id
) r
WHERE u.id = r.cliente_id AND u.barbearia_id = r.barbearia_id;
