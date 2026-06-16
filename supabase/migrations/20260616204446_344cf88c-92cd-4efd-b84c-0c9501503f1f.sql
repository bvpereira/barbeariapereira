CREATE OR REPLACE FUNCTION public.list_clubes_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid)
RETURNS TABLE(id uuid, nome text, valor_mensal numeric, descricao text, ativo boolean,
  regras_servicos jsonb, created_at timestamptz, assinantes jsonb, total_assinantes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_admin_id
    AND u.barbearia_id = p_barbearia_id AND u.nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.valor_mensal, c.descricao, c.ativo, c.regras_servicos, c.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u2.id, 'nome', u2.nome, 'data_fim', cu.data_fim)
                       ORDER BY u2.nome)
      FROM public.clube_usuarios cu
      JOIN public.usuarios u2 ON u2.id = cu.usuario_id
      WHERE cu.clube_id = c.id AND cu.barbearia_id = p_barbearia_id
        AND cu.status = 'ativa' AND cu.data_fim >= CURRENT_DATE
    ), '[]'::jsonb) AS assinantes,
    (SELECT count(*) FROM public.clube_usuarios cu
      WHERE cu.clube_id = c.id AND cu.barbearia_id = p_barbearia_id
        AND cu.status = 'ativa' AND cu.data_fim >= CURRENT_DATE)::bigint
  FROM public.clube_assinatura c
  WHERE c.barbearia_id = p_barbearia_id AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.list_clube_expirando(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid)
RETURNS TABLE(cliente_id uuid, cliente_nome text, cliente_login text,
  clube_id uuid, clube_nome text, data_fim date, dias_restantes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nome, u.login, c.id, c.nome, cu.data_fim,
    (cu.data_fim - CURRENT_DATE)::int
  FROM public.clube_usuarios cu
  JOIN public.usuarios u ON u.id = cu.usuario_id
  JOIN public.clube_assinatura c ON c.id = cu.clube_id
  WHERE cu.barbearia_id = p_barbearia_id
    AND cu.status = 'ativa'
    AND cu.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
  ORDER BY cu.data_fim ASC;
END $$;

CREATE OR REPLACE FUNCTION public.set_cliente_clube(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid,
  p_cliente_id uuid, p_clube_id uuid, p_data_inicio date, p_data_fim date, p_valor numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    (barbearia_id, usuario_id, clube_id, data_inicio, data_fim, valor, status, created_by)
    VALUES (p_barbearia_id, p_cliente_id, p_clube_id, p_data_inicio, p_data_fim,
            COALESCE(p_valor, 0), 'ativa', p_admin_id);
END $$;

CREATE OR REPLACE FUNCTION public.remove_cliente_clube(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  UPDATE public.clube_usuarios
    SET status = 'cancelada', updated_at = now(),
        motivo_cancelamento = COALESCE(motivo_cancelamento, 'Removido pelo administrador.')
    WHERE usuario_id = p_cliente_id AND barbearia_id = p_barbearia_id AND status = 'ativa';
END $$;

CREATE OR REPLACE FUNCTION public.save_clube_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid,
  p_id uuid, p_nome text, p_valor_mensal numeric, p_descricao text,
  p_ativo boolean, p_regras_servicos jsonb
) RETURNS public.clube_assinatura
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result public.clube_assinatura; v_regra jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  IF char_length(btrim(p_nome)) < 1 OR char_length(p_nome) > 100 THEN
    RAISE EXCEPTION 'Nome inválido (1-100 caracteres).';
  END IF;
  IF p_valor_mensal <= 0 THEN RAISE EXCEPTION 'Valor mensal deve ser positivo.'; END IF;
  IF jsonb_typeof(p_regras_servicos) <> 'array' OR jsonb_array_length(p_regras_servicos) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço.';
  END IF;
  FOR v_regra IN SELECT value FROM jsonb_array_elements(p_regras_servicos) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.servicos s
      WHERE s.id = (v_regra->>'servico_id')::uuid AND s.barbearia_id = p_barbearia_id) THEN
      RAISE EXCEPTION 'Serviço inválido nas regras.';
    END IF;
    IF COALESCE((v_regra->>'quantidade')::int, 0) < 1 THEN
      RAISE EXCEPTION 'Informe a quantidade de cada serviço.';
    END IF;
    IF v_regra->>'tipo_desconto' NOT IN ('percentual', 'fixo') THEN
      RAISE EXCEPTION 'Tipo de desconto inválido.';
    END IF;
    IF COALESCE((v_regra->>'valor_desconto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Informe o valor do desconto.';
    END IF;
    IF v_regra->>'tipo_desconto' = 'percentual' AND (v_regra->>'valor_desconto')::numeric > 100 THEN
      RAISE EXCEPTION 'Desconto percentual não pode passar de 100%%.';
    END IF;
    IF jsonb_typeof(v_regra->'dias_semana') <> 'array' OR jsonb_array_length(v_regra->'dias_semana') = 0 THEN
      RAISE EXCEPTION 'Selecione ao menos um dia da semana.';
    END IF;
  END LOOP;
  IF p_id IS NULL THEN
    INSERT INTO public.clube_assinatura (barbearia_id, nome, valor_mensal, descricao, ativo, regras_servicos)
    VALUES (p_barbearia_id, btrim(p_nome), p_valor_mensal, COALESCE(p_descricao, ''), p_ativo, p_regras_servicos)
    RETURNING * INTO v_result;
  ELSE
    UPDATE public.clube_assinatura
    SET nome = btrim(p_nome), valor_mensal = p_valor_mensal, descricao = COALESCE(p_descricao, ''),
        ativo = p_ativo, regras_servicos = p_regras_servicos
    WHERE id = p_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL
    RETURNING * INTO v_result;
    IF v_result.id IS NULL THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;
  END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.toggle_clube_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_id uuid, p_ativo boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  UPDATE public.clube_assinatura SET ativo = p_ativo
  WHERE id = p_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.delete_clube_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  UPDATE public.clube_assinatura SET deleted_at = now(), ativo = false
  WHERE id = p_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clube não encontrado.'; END IF;
  RETURN true;
END $$;