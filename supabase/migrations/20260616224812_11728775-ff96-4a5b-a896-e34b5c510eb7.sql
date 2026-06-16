CREATE OR REPLACE FUNCTION public.set_cliente_clube(p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_cliente_id uuid, p_clube_id uuid, p_data_inicio date, p_data_fim date, p_valor numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id AND nivel = 3) THEN
    RAISE EXCEPTION 'Cliente inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clube_assinatura
    WHERE id = p_clube_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Clube inválido.';
  END IF;
  UPDATE public.clube_usuarios SET status = 'arquivada', updated_at = now()
    WHERE usuario_id = p_cliente_id AND status = 'ativa';
  INSERT INTO public.clube_usuarios
    (barbearia_id, usuario_id, clube_id, data_inicio, data_fim, valor_pago, status, criada_por)
    VALUES (p_barbearia_id, p_cliente_id, p_clube_id, p_data_inicio, p_data_fim,
            COALESCE(p_valor, 0), 'ativa', p_admin_id);
END $function$;