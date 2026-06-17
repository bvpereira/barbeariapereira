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
  WHERE a.cliente_id = p_cliente_id AND LOWER(a.status) = 'finalizado';

  IF v_last IS NULL THEN
    v_val := 'nunca';
  ELSE
    v_val := GREATEST(0, (CURRENT_DATE - v_last))::text;
  END IF;

  UPDATE public.usuarios SET dias_inativo = v_val WHERE id = p_cliente_id;
END;
$$;

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
        WHEN MAX(a.data) IS NULL THEN 'nunca'
        ELSE GREATEST(0, (CURRENT_DATE - MAX(a.data)::date))::text
      END AS val
    FROM public.usuarios u2
    LEFT JOIN public.atendimentos a
      ON a.cliente_id = u2.id AND LOWER(a.status) = 'finalizado'
    GROUP BY u2.id
  ) sub
  WHERE u.id = sub.id
    AND (u.dias_inativo IS DISTINCT FROM sub.val);
END;
$$;

SELECT public.refresh_dias_inativo();