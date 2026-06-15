CREATE OR REPLACE FUNCTION public.clone_barbearia(p_admin_id uuid, p_admin_login text, p_admin_senha text, p_modelo_id uuid, p_new_slug text, p_new_nome text, p_new_admin_login text, p_new_admin_senha text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_modelo_config jsonb;
  v_admin_id uuid;
  v_reserved text[] := ARRAY['admin','login','cadastro','colaborador','cliente','atendimentos',
    'clientes','colaboradores','comunidade','financeiro','gastos','horarios','iacodconsumi',
    'iaimagem','integracoes','minhaconta','promocao','redefinir-senha','registro','servicos',
    'superadmin','superlogin','barbearias','blog','notificacoes','clube'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = p_admin_id AND login = p_admin_login AND senha = p_admin_senha AND nivel = 0) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  p_new_slug := lower(btrim(p_new_slug));
  IF p_new_slug !~ '^[a-z0-9-]{3,30}$' THEN RAISE EXCEPTION 'Slug inválido. Use 3-30 caracteres: a-z, 0-9 e hífen.'; END IF;
  IF p_new_slug = ANY(v_reserved) THEN RAISE EXCEPTION 'Este slug é reservado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.barbearias WHERE slug = p_new_slug) THEN RAISE EXCEPTION 'Já existe uma barbearia com este slug.'; END IF;
  IF char_length(btrim(coalesce(p_new_nome,''))) < 1 THEN RAISE EXCEPTION 'Informe o nome da barbearia.'; END IF;
  IF char_length(btrim(coalesce(p_new_admin_login,''))) < 3 THEN RAISE EXCEPTION 'Login do admin inválido.'; END IF;
  IF char_length(coalesce(p_new_admin_senha,'')) < 6 THEN RAISE EXCEPTION 'Senha do admin deve ter no mínimo 6 caracteres.'; END IF;

  SELECT config INTO v_modelo_config FROM public.barbearias WHERE id = p_modelo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barbearia modelo não encontrada.'; END IF;

  INSERT INTO public.barbearias (nome, slug, config)
  VALUES (btrim(p_new_nome), p_new_slug, COALESCE(v_modelo_config, '{}'::jsonb))
  RETURNING id INTO v_new_id;

  CREATE TEMP TABLE IF NOT EXISTS _map_usuarios(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_servicos(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_colaboradores(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_clubes(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_cupons(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_atendimentos(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_informacoes(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_agentes(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_promocao(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_blog(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;

  TRUNCATE _map_usuarios, _map_servicos, _map_colaboradores, _map_clubes, _map_cupons,
    _map_atendimentos, _map_informacoes, _map_agentes, _map_promocao, _map_blog;

  INSERT INTO _map_servicos SELECT id, gen_random_uuid() FROM public.servicos WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_colaboradores SELECT id, gen_random_uuid() FROM public.colaboradores WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_usuarios SELECT id, gen_random_uuid() FROM public.usuarios WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_clubes SELECT id, gen_random_uuid() FROM public.clube_assinatura WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_cupons SELECT id, gen_random_uuid() FROM public.cupons_desconto WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_atendimentos SELECT id, gen_random_uuid() FROM public.atendimentos WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_informacoes SELECT id, gen_random_uuid() FROM public.informacoes WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_agentes SELECT id, gen_random_uuid() FROM public.agentes_ia WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_promocao SELECT id, gen_random_uuid() FROM public.promocao WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_blog SELECT id, gen_random_uuid() FROM public.blog WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.servicos (id, name, price, duration, image_url, created_at, updated_at,
    detalhes, barbearia_id, image_url_2, image_url_3, image_url_4, image_url_5)
  SELECT m.new_id, s.name, s.price, s.duration, s.image_url, s.created_at, s.updated_at,
    s.detalhes, v_new_id, s.image_url_2, s.image_url_3, s.image_url_4, s.image_url_5
  FROM public.servicos s JOIN _map_servicos m ON m.old_id = s.id
  WHERE s.barbearia_id = p_modelo_id;

  INSERT INTO public.clube_assinatura (id, barbearia_id, nome, valor_mensal, descricao,
    ativo, regras_servicos, deleted_at, created_at, updated_at)
  SELECT m.new_id, v_new_id, c.nome, c.valor_mensal, c.descricao, c.ativo,
    (SELECT COALESCE(jsonb_agg(
      regra || jsonb_build_object('servico_id',
        COALESCE((SELECT new_id FROM _map_servicos WHERE old_id = (regra->>'servico_id')::uuid),
                 (regra->>'servico_id')::uuid))
    ), '[]'::jsonb)
    FROM jsonb_array_elements(c.regras_servicos) regra),
    c.deleted_at, c.created_at, c.updated_at
  FROM public.clube_assinatura c JOIN _map_clubes m ON m.old_id = c.id
  WHERE c.barbearia_id = p_modelo_id;

  INSERT INTO public.usuarios (id, nome, login, senha, nivel, created_at, updated_at,
    observacao, registro, promocao, recovery_token, barbearia_id, clube_id,
    clube_data_inicio, clube_data_fim, clube_valor_pago, clube_historico)
  SELECT m.new_id, u.nome, u.login, u.senha, u.nivel, u.created_at, u.updated_at,
    u.observacao, u.registro, u.promocao, u.recovery_token, v_new_id,
    (SELECT new_id FROM _map_clubes WHERE old_id = u.clube_id),
    u.clube_data_inicio, u.clube_data_fim, u.clube_valor_pago, u.clube_historico
  FROM public.usuarios u JOIN _map_usuarios m ON m.old_id = u.id
  WHERE u.barbearia_id = p_modelo_id;

  UPDATE public.usuarios SET login = p_new_admin_login, senha = p_new_admin_senha
  WHERE barbearia_id = v_new_id AND nivel = 1
  RETURNING id INTO v_admin_id;

  IF v_admin_id IS NULL THEN
    INSERT INTO public.usuarios (nome, login, senha, nivel, barbearia_id)
    VALUES ('Administrador', p_new_admin_login, p_new_admin_senha, 1, v_new_id);
  END IF;

  INSERT INTO public.colaboradores (id, nome, resumo, login, senha, salario_fixo, foto_url,
    created_at, updated_at, ativo, barbearia_id, foto_url_2, foto_url_3, foto_url_4,
    foto_url_5, foto_url_6, foto_url_7)
  SELECT m.new_id, c.nome, c.resumo, c.login, c.senha, c.salario_fixo, c.foto_url,
    c.created_at, c.updated_at, c.ativo, v_new_id, c.foto_url_2, c.foto_url_3, c.foto_url_4,
    c.foto_url_5, c.foto_url_6, c.foto_url_7
  FROM public.colaboradores c JOIN _map_colaboradores m ON m.old_id = c.id
  WHERE c.barbearia_id = p_modelo_id;

  INSERT INTO public.colaborador_servicos (colaborador_id, servico_id, tipo_comissao,
    valor_comissao, created_at, barbearia_id)
  SELECT mc.new_id, ms.new_id, cs.tipo_comissao, cs.valor_comissao, cs.created_at, v_new_id
  FROM public.colaborador_servicos cs
  JOIN _map_colaboradores mc ON mc.old_id = cs.colaborador_id
  JOIN _map_servicos ms ON ms.old_id = cs.servico_id
  WHERE cs.barbearia_id = p_modelo_id;

  INSERT INTO public.horarios_colaboradores (colaborador_id, data, manha_inicio, manha_fim,
    tarde_inicio, tarde_fim, created_at, updated_at, ativo, barbearia_id)
  SELECT mc.new_id, h.data, h.manha_inicio, h.manha_fim, h.tarde_inicio, h.tarde_fim,
    h.created_at, h.updated_at, h.ativo, v_new_id
  FROM public.horarios_colaboradores h
  JOIN _map_colaboradores mc ON mc.old_id = h.colaborador_id
  WHERE h.barbearia_id = p_modelo_id;

  INSERT INTO public.dias_agenda (data, ativo, created_at, updated_at, barbearia_id)
  SELECT data, ativo, created_at, updated_at, v_new_id
  FROM public.dias_agenda WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.informacoes (id, user_id, usuario_id, userrr, tel_contato,
    imagem_1, imagem_2, imagem_3, imagem_4, imagem_5, imagem_6, imagem_7, imagem_8,
    created_at, updated_at, email, video_local, google_avaliacao, tempo_marcar,
    tempo_excluir, instancia_evo, imagem_logo, barbearia_id, nome_barbearia,
    instancia_propria, instancia_api, instagram, endereco, foto_perfil)
  SELECT m.new_id, i.user_id, i.usuario_id, i.userrr, i.tel_contato,
    i.imagem_1, i.imagem_2, i.imagem_3, i.imagem_4, i.imagem_5, i.imagem_6, i.imagem_7, i.imagem_8,
    i.created_at, i.updated_at, i.email, i.video_local, i.google_avaliacao, i.tempo_marcar,
    i.tempo_excluir, i.instancia_evo, i.imagem_logo, v_new_id, i.nome_barbearia,
    i.instancia_propria, i.instancia_api, i.instagram, i.endereco, i.foto_perfil
  FROM public.informacoes i JOIN _map_informacoes m ON m.old_id = i.id
  WHERE i.barbearia_id = p_modelo_id;

  INSERT INTO public.agentes_ia (id, imagem_formato, created_at, updated_at, linha,
    imagem_objetivo, imagem_campanha, imagem_estilovisual, imagem_informacoes,
    imagem_imareferencia, imagem_comlogo, imagem_criada_ia, barbearia_id,
    num_imagens_criadas, last_reset_month, num_limite_imagens, texto_estilo, texto_emoji,
    oq_criar, legenda_criada_ia, imagem_referencia_ia, texto_endereco, texto_instagram,
    texto_telcontato, imagem_endereco, imagem_instagram, imagem_telcontato, tom_comunicacao,
    imagem_paleta, imagem_elem_central, edit_tipo_fundo, edit_cor_fundo, edit_textura_fundo,
    edit_tipo_iluminacao, edit_intensidade_luz, edit_temperatura_cor, edit_sombra,
    edit_estilo_cor, edit_nivel_retoque, edit_nitidez, edit_tipo_produto, edit_acessorios,
    edit_escala_produto, edit_imagemupada, edit_imagemeditada, edit_formato)
  SELECT m.new_id, a.imagem_formato, a.created_at, a.updated_at, a.linha,
    a.imagem_objetivo, a.imagem_campanha, a.imagem_estilovisual, a.imagem_informacoes,
    a.imagem_imareferencia, a.imagem_comlogo, a.imagem_criada_ia, v_new_id,
    a.num_imagens_criadas, a.last_reset_month, a.num_limite_imagens, a.texto_estilo, a.texto_emoji,
    a.oq_criar, a.legenda_criada_ia, a.imagem_referencia_ia, a.texto_endereco, a.texto_instagram,
    a.texto_telcontato, a.imagem_endereco, a.imagem_instagram, a.imagem_telcontato, a.tom_comunicacao,
    a.imagem_paleta, a.imagem_elem_central, a.edit_tipo_fundo, a.edit_cor_fundo, a.edit_textura_fundo,
    a.edit_tipo_iluminacao, a.edit_intensidade_luz, a.edit_temperatura_cor, a.edit_sombra,
    a.edit_estilo_cor, a.edit_nivel_retoque, a.edit_nitidez, a.edit_tipo_produto, a.edit_acessorios,
    a.edit_escala_produto, a.edit_imagemupada, a.edit_imagemeditada, a.edit_formato
  FROM public.agentes_ia a JOIN _map_agentes m ON m.old_id = a.id
  WHERE a.barbearia_id = p_modelo_id;

  INSERT INTO public.integracoes (webhook_url, created_at, updated_at, tipo, barbearia_id)
  SELECT webhook_url, created_at, updated_at, tipo, v_new_id
  FROM public.integracoes WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.mensagens (barbearia_id, msg_wpp_colab_eve_criado_01,
    msg_wpp_colab_eve_alterado_02, msg_wpp_colab_eve_cancelado_03, msg_wpp_cliente_eve_criado_04,
    msg_wpp_cliente_eve_alterado_05, msg_wpp_cliente_eve_cancelado_06, msg_wpp_cliente_finalizado_07,
    msg_wpp_cliente_naocompareceu_08, msg_wpp_colab_avisofinal_09, msg_wpp_cliente_avisofinal_10,
    created_at, updated_at, msg_wpp_cliente_lembrete_11)
  SELECT v_new_id, msg_wpp_colab_eve_criado_01, msg_wpp_colab_eve_alterado_02,
    msg_wpp_colab_eve_cancelado_03, msg_wpp_cliente_eve_criado_04, msg_wpp_cliente_eve_alterado_05,
    msg_wpp_cliente_eve_cancelado_06, msg_wpp_cliente_finalizado_07, msg_wpp_cliente_naocompareceu_08,
    msg_wpp_colab_avisofinal_09, msg_wpp_cliente_avisofinal_10, created_at, updated_at,
    msg_wpp_cliente_lembrete_11
  FROM public.mensagens WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.promocao (id, numero_promo, imagem_promo, texto_promo, data_promo,
    created_at, testada, texto_promo_ia_2, texto_promo_ia_3, imagem_ia, barbearia_id,
    texto_promo_auxiliar, imagem_banner)
  SELECT m.new_id, p.numero_promo, p.imagem_promo, p.texto_promo, p.data_promo,
    p.created_at, p.testada, p.texto_promo_ia_2, p.texto_promo_ia_3, p.imagem_ia, v_new_id,
    p.texto_promo_auxiliar, p.imagem_banner
  FROM public.promocao p JOIN _map_promocao m ON m.old_id = p.id
  WHERE p.barbearia_id = p_modelo_id;

  INSERT INTO public.blog (id, titulo, resumo, link_noticia, imagem_url, autor_id,
    barbearia_id, likes, dislikes, created_at, updated_at)
  SELECT m.new_id, b.titulo, b.resumo, b.link_noticia, b.imagem_url,
    COALESCE((SELECT new_id FROM _map_usuarios WHERE old_id = b.autor_id), b.autor_id),
    v_new_id, b.likes, b.dislikes, b.created_at, b.updated_at
  FROM public.blog b JOIN _map_blog m ON m.old_id = b.id
  WHERE b.barbearia_id = p_modelo_id;

  -- Reescreve URLs de imagens para apontar para o storage da nova barbearia
  PERFORM public._rewrite_clone_image_urls(p_modelo_id, v_new_id);

  RETURN jsonb_build_object(
    'id', v_new_id,
    'slug', p_new_slug,
    'mapping', jsonb_build_object(
      'barbearia', jsonb_build_object('old', p_modelo_id, 'new', v_new_id),
      'servicos', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_servicos), '{}'::jsonb),
      'colaboradores', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_colaboradores), '{}'::jsonb),
      'informacoes', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_informacoes), '{}'::jsonb),
      'promocao', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_promocao), '{}'::jsonb),
      'blog', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_blog), '{}'::jsonb),
      'agentes', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_agentes), '{}'::jsonb)
    )
  );
END;
$function$;