
-- 1. Add columns
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS dias_inativo text;
ALTER TABLE public.promocao ADD COLUMN IF NOT EXISTS promo_para_quem text;
ALTER TABLE public.promocao ADD COLUMN IF NOT EXISTS tipo_promo text;

-- 2. Function to recompute dias_inativo for all usuarios
CREATE OR REPLACE FUNCTION public.refresh_dias_inativo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios u
  SET dias_inativo = sub.val
  FROM (
    SELECT u2.id,
      CASE
        WHEN MAX(a.data) FILTER (WHERE a.status = 'finalizado') IS NULL THEN 'nunca'
        ELSE GREATEST(0, (CURRENT_DATE - MAX(a.data) FILTER (WHERE a.status = 'finalizado')::date))::text
      END AS val
    FROM public.usuarios u2
    LEFT JOIN public.atendimentos a ON a.cliente_id = u2.id
    GROUP BY u2.id
  ) sub
  WHERE u.id = sub.id
    AND (u.dias_inativo IS DISTINCT FROM sub.val);
END;
$$;

-- 3. Populate now
SELECT public.refresh_dias_inativo();

-- 4. Trigger to update on atendimento change
CREATE OR REPLACE FUNCTION public.update_dias_inativo_for_cliente(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last date;
  v_val text;
BEGIN
  SELECT MAX(a.data)::date INTO v_last
  FROM public.atendimentos a
  WHERE a.cliente_id = p_cliente_id AND a.status = 'finalizado';

  IF v_last IS NULL THEN
    v_val := 'nunca';
  ELSE
    v_val := GREATEST(0, (CURRENT_DATE - v_last))::text;
  END IF;

  UPDATE public.usuarios SET dias_inativo = v_val WHERE id = p_cliente_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_atendimentos_dias_inativo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_dias_inativo_for_cliente(OLD.cliente_id);
    RETURN OLD;
  END IF;
  PERFORM public.update_dias_inativo_for_cliente(NEW.cliente_id);
  IF TG_OP = 'UPDATE' AND OLD.cliente_id IS DISTINCT FROM NEW.cliente_id THEN
    PERFORM public.update_dias_inativo_for_cliente(OLD.cliente_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atendimentos_dias_inativo ON public.atendimentos;
CREATE TRIGGER trg_atendimentos_dias_inativo
AFTER INSERT OR UPDATE OR DELETE ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.trg_atendimentos_dias_inativo();

-- 5. Daily cron to refresh all rows (so counters advance each day even without activity)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh_dias_inativo_daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh_dias_inativo_daily',
  '5 0 * * *',
  $$SELECT public.refresh_dias_inativo();$$
);
