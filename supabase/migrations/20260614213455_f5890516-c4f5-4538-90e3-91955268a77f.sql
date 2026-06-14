CREATE OR REPLACE FUNCTION public.delete_cupom_desconto(
  p_admin_id uuid,
  p_admin_password text,
  p_barbearia_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_admin_id
      AND u.barbearia_id = p_barbearia_id
      AND u.senha = p_admin_password
      AND u.nivel = 1
  ) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  UPDATE public.cupons_desconto
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_id
    AND barbearia_id = p_barbearia_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado ou já excluído.';
  END IF;

  FOR v_appointment IN
    SELECT a.id
    FROM public.atendimentos a
    WHERE a.cupom_id = p_id
      AND a.barbearia_id = p_barbearia_id
      AND a.cupom_status = 'aplicado'
      AND a.status = 'Agendado'
  LOOP
    PERFORM public.remove_coupon_from_appointment(v_appointment.id, 'Cupom excluído.');
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_cupom_desconto(uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_cupom_desconto(uuid, text, uuid, uuid) TO anon, authenticated, service_role;