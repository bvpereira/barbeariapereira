CREATE OR REPLACE FUNCTION public.list_clientes_clube_ativo(p_barbearia_id uuid)
RETURNS TABLE(usuario_id uuid, clube_id uuid, data_fim date, clube_nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.usuario_id, cu.clube_id, cu.data_fim, ca.nome
  FROM public.clube_usuarios cu
  LEFT JOIN public.clube_assinatura ca ON ca.id = cu.clube_id
  WHERE cu.barbearia_id = p_barbearia_id
    AND cu.status = 'ativa'
    AND cu.data_fim >= CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.list_clientes_clube_ativo(uuid) TO anon, authenticated, service_role;