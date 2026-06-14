CREATE OR REPLACE FUNCTION public.save_cupom_desconto(
  p_admin_id uuid,
  p_admin_password text,
  p_id uuid,
  p_barbearia_id uuid,
  p_nome text,
  p_descricao text,
  p_codigo text,
  p_data_inicio date,
  p_data_fim date,
  p_dias_semana smallint[],
  p_limite_por_cliente text,
  p_somente_novos_clientes boolean,
  p_inatividade_dias integer,
  p_valor_minimo_total numeric,
  p_tipo_desconto_total text,
  p_valor_desconto_total numeric,
  p_regras_servicos jsonb
)
RETURNS public.cupons_desconto
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.cupons_desconto;
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

  IF p_id IS NULL THEN
    INSERT INTO public.cupons_desconto (
      barbearia_id, nome, descricao, codigo, data_inicio, data_fim,
      dias_semana, limite_por_cliente, somente_novos_clientes,
      inatividade_dias, valor_minimo_total, tipo_desconto_total,
      valor_desconto_total, regras_servicos
    ) VALUES (
      p_barbearia_id, p_nome, p_descricao, p_codigo, p_data_inicio, p_data_fim,
      p_dias_semana, p_limite_por_cliente, p_somente_novos_clientes,
      p_inatividade_dias, p_valor_minimo_total, p_tipo_desconto_total,
      p_valor_desconto_total, p_regras_servicos
    )
    RETURNING * INTO v_result;
  ELSE
    UPDATE public.cupons_desconto
    SET nome = p_nome,
        descricao = p_descricao,
        codigo = p_codigo,
        data_inicio = p_data_inicio,
        data_fim = p_data_fim,
        dias_semana = p_dias_semana,
        limite_por_cliente = p_limite_por_cliente,
        somente_novos_clientes = p_somente_novos_clientes,
        inatividade_dias = p_inatividade_dias,
        valor_minimo_total = p_valor_minimo_total,
        tipo_desconto_total = p_tipo_desconto_total,
        valor_desconto_total = p_valor_desconto_total,
        regras_servicos = p_regras_servicos
    WHERE id = p_id
      AND barbearia_id = p_barbearia_id
      AND deleted_at IS NULL
    RETURNING * INTO v_result;

    IF v_result.id IS NULL THEN
      RAISE EXCEPTION 'Cupom não encontrado.';
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_cupom_desconto(uuid, text, uuid, uuid, text, text, text, date, date, smallint[], text, boolean, integer, numeric, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_cupom_desconto(uuid, text, uuid, uuid, text, text, text, date, date, smallint[], text, boolean, integer, numeric, text, numeric, jsonb) TO anon, authenticated, service_role;