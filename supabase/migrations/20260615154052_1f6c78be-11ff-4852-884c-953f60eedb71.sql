CREATE OR REPLACE FUNCTION public.list_clubes_assinatura(p_admin_id uuid, p_admin_password text, p_barbearia_id uuid)
 RETURNS TABLE(id uuid, nome text, valor_mensal numeric, descricao text, ativo boolean, regras_servicos jsonb, created_at timestamptz, assinantes jsonb, total_assinantes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_admin_id
    AND u.barbearia_id = p_barbearia_id AND u.senha = p_admin_password AND u.nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT c.id AS id, c.nome AS nome, c.valor_mensal AS valor_mensal,
    c.descricao AS descricao, c.ativo AS ativo, c.regras_servicos AS regras_servicos,
    c.created_at AS created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u2.id, 'nome', u2.nome, 'data_fim', u2.clube_data_fim) ORDER BY u2.nome)
      FROM public.usuarios u2
      WHERE u2.clube_id = c.id AND u2.barbearia_id = p_barbearia_id
        AND u2.clube_data_fim >= CURRENT_DATE
    ), '[]'::jsonb) AS assinantes,
    (SELECT count(*) FROM public.usuarios u3
      WHERE u3.clube_id = c.id AND u3.barbearia_id = p_barbearia_id
        AND u3.clube_data_fim >= CURRENT_DATE)::bigint AS total_assinantes
  FROM public.clube_assinatura c
  WHERE c.barbearia_id = p_barbearia_id AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC;
END $function$;