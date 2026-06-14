CREATE OR REPLACE FUNCTION public.list_cupons_desconto(
  p_admin_id uuid,
  p_admin_password text,
  p_barbearia_id uuid
)
RETURNS TABLE (
  id uuid,
  barbearia_id uuid,
  nome text,
  descricao text,
  codigo text,
  data_inicio date,
  data_fim date,
  dias_semana smallint[],
  limite_por_cliente text,
  somente_novos_clientes boolean,
  inatividade_dias integer,
  valor_minimo_total numeric,
  tipo_desconto_total text,
  valor_desconto_total numeric,
  regras_servicos jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  usos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT c.id, c.barbearia_id, c.nome, c.descricao, c.codigo,
         c.data_inicio, c.data_fim, c.dias_semana, c.limite_por_cliente,
         c.somente_novos_clientes, c.inatividade_dias, c.valor_minimo_total,
         c.tipo_desconto_total, c.valor_desconto_total, c.regras_servicos,
         c.created_at, c.updated_at, c.deleted_at,
         count(a.id)::bigint AS usos
  FROM public.cupons_desconto c
  LEFT JOIN public.atendimentos a
    ON a.cupom_id = c.id
   AND a.cupom_status = 'aplicado'
   AND a.status <> 'Não compareceu'
  WHERE c.barbearia_id = p_barbearia_id
    AND c.deleted_at IS NULL
  GROUP BY c.id
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_cupons_desconto(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_cupons_desconto(uuid, text, uuid) TO anon, authenticated, service_role;