
CREATE OR REPLACE FUNCTION public.clone_barbearia(
  p_admin_id uuid, p_admin_login text, p_admin_senha text,
  p_modelo_id uuid, p_new_slug text, p_new_nome text,
  p_new_admin_login text, p_new_admin_senha text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_new_id uuid;
  v_modelo_config jsonb;
  v_new_admin_id uuid;
  v_reserved text[] := ARRAY['admin','login','cadastro','colaborador','cliente','atendimentos',
    'clientes','colaboradores','comunidade','financeiro','gastos','horarios','iacodconsumi',
    'iaimagem','iaedicao','integracoes','minhaconta','promocao','redefinir-senha','registro','servicos',
    'superadmin','superlogin','barbearias','blog','notificacoes','clube','cores','webhooks'];
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
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE login = p_new_admin_login) THEN
    RAISE EXCEPTION 'Já existe um usuário com este login de admin.';
  END IF;

  SELECT config INTO v_modelo_config FROM public.barbearias WHERE id = p_modelo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barbearia modelo não encontrada.'; END IF;

  INSERT INTO public.barbearias (nome, slug, config)
  VALUES (btrim(p_new_nome), p_new_slug, COALESCE(v_modelo_config, '{}'::jsonb))
  RETURNING id INTO v_new_id;

  CREATE TEMP TABLE IF NOT EXISTS _map_servicos(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_colaboradores(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_clubes(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_cupons(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_informacoes(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_agentes(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_promocao(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _map_blog(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  TRUNCATE _map_servicos, _map_colaboradores, _map_clubes, _map_cupons,
    _map_informacoes, _map_agentes, _map_promocao, _map_blog;

  INSERT INTO _map_servicos       SELECT id, gen_random_uuid() FROM public.servicos        WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_colaboradores  SELECT id, gen_random_uuid() FROM public.colaboradores   WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_clubes         SELECT id, gen_random_uuid() FROM public.clube_assinatura WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_cupons         SELECT id, gen_random_uuid() FROM public.cupons_desconto WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_informacoes    SELECT id, gen_random_uuid() FROM public.informacoes     WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_agentes        SELECT id, gen_random_uuid() FROM public.agentes_ia      WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_promocao       SELECT id, gen_random_uuid() FROM public.promocao        WHERE barbearia_id = p_modelo_id;
  INSERT INTO _map_blog           SELECT id, gen_random_uuid() FROM public.blog            WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.usuarios (nome, login, senha, nivel, barbearia_id)
  VALUES ('Administrador', p_new_admin_login, p_new_admin_senha, 1, v_new_id)
  RETURNING id INTO v_new_admin_id;

  INSERT INTO public.servicos (id, name, price, duration, image_url, detalhes, barbearia_id,
    image_url_2, image_url_3, image_url_4, image_url_5,
    cashback_ativo, cashback_percentual, extra)
  SELECT m.new_id, s.name, s.price, s.duration, s.image_url, s.detalhes, v_new_id,
    s.image_url_2, s.image_url_3, s.image_url_4, s.image_url_5,
    s.cashback_ativo, s.cashback_percentual, s.extra
  FROM public.servicos s JOIN _map_servicos m ON m.old_id = s.id
  WHERE s.barbearia_id = p_modelo_id;

  INSERT INTO public.clube_assinatura (id, barbearia_id, nome, valor_mensal, descricao,
    ativo, regras_servicos, deleted_at)
  SELECT m.new_id, v_new_id, c.nome, c.valor_mensal, c.descricao, c.ativo,
    COALESCE((SELECT jsonb_agg(
      regra || jsonb_build_object('servico_id',
        COALESCE((SELECT new_id FROM _map_servicos WHERE old_id = (regra->>'servico_id')::uuid),
                 (regra->>'servico_id')::uuid))
    ) FROM jsonb_array_elements(c.regras_servicos) regra), '[]'::jsonb),
    c.deleted_at
  FROM public.clube_assinatura c JOIN _map_clubes m ON m.old_id = c.id
  WHERE c.barbearia_id = p_modelo_id;

  INSERT INTO public.cupons_desconto (id, barbearia_id, nome, descricao, codigo,
    data_inicio, data_fim, dias_semana, limite_por_cliente, somente_novos_clientes,
    inatividade_dias, valor_minimo_total, tipo_desconto_total, valor_desconto_total,
    regras_servicos, deleted_at)
  SELECT m.new_id, v_new_id, cu.nome, cu.descricao, cu.codigo,
    cu.data_inicio, cu.data_fim, cu.dias_semana, cu.limite_por_cliente, cu.somente_novos_clientes,
    cu.inatividade_dias, cu.valor_minimo_total, cu.tipo_desconto_total, cu.valor_desconto_total,
    COALESCE((SELECT jsonb_agg(
      regra || jsonb_build_object('servico_id',
        COALESCE((SELECT new_id FROM _map_servicos WHERE old_id = (regra->>'servico_id')::uuid),
                 (regra->>'servico_id')::uuid))
    ) FROM jsonb_array_elements(cu.regras_servicos) regra), '[]'::jsonb),
    cu.deleted_at
  FROM public.cupons_desconto cu JOIN _map_cupons m ON m.old_id = cu.id
  WHERE cu.barbearia_id = p_modelo_id;

  INSERT INTO public.colaboradores (id, nome, resumo, login, senha, salario_fixo, foto_url,
    ativo, barbearia_id, foto_url_2, foto_url_3, foto_url_4, foto_url_5, foto_url_6, foto_url_7)
  SELECT m.new_id, c.nome, c.resumo, c.login, c.senha, c.salario_fixo, c.foto_url,
    c.ativo, v_new_id, c.foto_url_2, c.foto_url_3, c.foto_url_4, c.foto_url_5, c.foto_url_6, c.foto_url_7
  FROM public.colaboradores c JOIN _map_colaboradores m ON m.old_id = c.id
  WHERE c.barbearia_id = p_modelo_id;

  INSERT INTO public.colaborador_servicos (colaborador_id, servico_id, tipo_comissao, valor_comissao, barbearia_id)
  SELECT mc.new_id, ms.new_id, cs.tipo_comissao, cs.valor_comissao, v_new_id
  FROM public.colaborador_servicos cs
  JOIN _map_colaboradores mc ON mc.old_id = cs.colaborador_id
  JOIN _map_servicos ms       ON ms.old_id = cs.servico_id
  WHERE cs.barbearia_id = p_modelo_id;

  INSERT INTO public.horarios_colaboradores (colaborador_id, data, manha_inicio, manha_fim,
    tarde_inicio, tarde_fim, ativo, barbearia_id)
  SELECT mc.new_id, h.data, h.manha_inicio, h.manha_fim, h.tarde_inicio, h.tarde_fim, h.ativo, v_new_id
  FROM public.horarios_colaboradores h
  JOIN _map_colaboradores mc ON mc.old_id = h.colaborador_id
  WHERE h.barbearia_id = p_modelo_id;

  INSERT INTO public.dias_agenda (data, ativo, barbearia_id)
  SELECT data, ativo, v_new_id FROM public.dias_agenda WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.informacoes (id, user_id, usuario_id, nome_admin, tel_contato,
    imagem_1, imagem_2, imagem_3, imagem_4, imagem_5, imagem_6, imagem_7, imagem_8,
    email, video_local, google_avaliacao, tempo_marcar, tempo_excluir,
    instancia_evo, imagem_logo, barbearia_id, nome_barbearia,
    instancia_propria, instancia_api, instagram, endereco, foto_perfil,
    site, instancia_numero, modo_teste, instancia_funcionando,
    instancia_reserva_evo, instancia_reserva_api, instancia_reserva_numero,
    envio_via, cashback, manha_inicio, manha_fim, tarde_inicio, tarde_fim)
  SELECT m.new_id, v_new_admin_id, v_new_admin_id, btrim(p_new_nome), i.tel_contato,
    i.imagem_1, i.imagem_2, i.imagem_3, i.imagem_4, i.imagem_5, i.imagem_6, i.imagem_7, i.imagem_8,
    i.email, i.video_local, i.google_avaliacao, i.tempo_marcar, i.tempo_excluir,
    NULL, i.imagem_logo, v_new_id, btrim(p_new_nome),
    NULL, NULL, i.instagram, i.endereco, i.foto_perfil,
    i.site, NULL, true, false,
    NULL, NULL, NULL,
    i.envio_via, i.cashback, i.manha_inicio, i.manha_fim, i.tarde_inicio, i.tarde_fim
  FROM public.informacoes i JOIN _map_informacoes m ON m.old_id = i.id
  WHERE i.barbearia_id = p_modelo_id;

  INSERT INTO public.agentes_ia (id, imagem_formato, linha,
    imagem_objetivo, imagem_campanha, imagem_estilovisual, imagem_informacoes,
    imagem_imareferencia, imagem_comlogo, imagem_criada_ia, barbearia_id,
    num_imagens_criadas, last_reset_month, num_limite_imagens, texto_estilo, texto_emoji,
    oq_criar, legenda_criada_ia, imagem_referencia_ia, texto_endereco, texto_instagram,
    texto_telcontato, imagem_endereco, imagem_instagram, imagem_telcontato, tom_comunicacao,
    imagem_paleta, imagem_elem_central, edit_tipo_fundo, edit_cor_fundo, edit_textura_fundo,
    edit_tipo_iluminacao, edit_intensidade_luz, edit_temperatura_cor, edit_sombra,
    edit_estilo_cor, edit_nivel_retoque, edit_nitidez, edit_tipo_produto, edit_acessorios,
    edit_escala_produto, edit_imagemupada, edit_imagemeditada, edit_formato)
  SELECT m.new_id, a.imagem_formato, a.linha,
    a.imagem_objetivo, a.imagem_campanha, a.imagem_estilovisual, a.imagem_informacoes,
    a.imagem_imareferencia, a.imagem_comlogo, a.imagem_criada_ia, v_new_id,
    0, a.last_reset_month, a.num_limite_imagens, a.texto_estilo, a.texto_emoji,
    a.oq_criar, a.legenda_criada_ia, a.imagem_referencia_ia, a.texto_endereco, a.texto_instagram,
    a.texto_telcontato, a.imagem_endereco, a.imagem_instagram, a.imagem_telcontato, a.tom_comunicacao,
    a.imagem_paleta, a.imagem_elem_central, a.edit_tipo_fundo, a.edit_cor_fundo, a.edit_textura_fundo,
    a.edit_tipo_iluminacao, a.edit_intensidade_luz, a.edit_temperatura_cor, a.edit_sombra,
    a.edit_estilo_cor, a.edit_nivel_retoque, a.edit_nitidez, a.edit_tipo_produto, a.edit_acessorios,
    a.edit_escala_produto, a.edit_imagemupada, a.edit_imagemeditada, a.edit_formato
  FROM public.agentes_ia a JOIN _map_agentes m ON m.old_id = a.id
  WHERE a.barbearia_id = p_modelo_id;

  INSERT INTO public.integracoes (webhook_url, tipo, barbearia_id)
  SELECT webhook_url, tipo, v_new_id FROM public.integracoes WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.mensagens (barbearia_id,
    msg_wpp_colab_eve_criado_01, msg_wpp_colab_eve_alterado_02, msg_wpp_colab_eve_cancelado_03,
    msg_wpp_cliente_eve_criado_04, msg_wpp_cliente_eve_alterado_05, msg_wpp_cliente_eve_cancelado_06,
    msg_wpp_cliente_finalizado_07, msg_wpp_cliente_naocompareceu_08,
    msg_wpp_colab_avisofinal_09, msg_wpp_cliente_avisofinal_10,
    msg_wpp_cliente_lembreteamanha_11, msg_wpp_cliente_registro_50, msg_wpp_cliente_variada_51,
    msg_wpp_cliente_redefinirsenha_12, msg_wpp_cliente_avisopromo_13, msg_wpp_cliente_lembretehoje_14)
  SELECT v_new_id,
    msg_wpp_colab_eve_criado_01, msg_wpp_colab_eve_alterado_02, msg_wpp_colab_eve_cancelado_03,
    msg_wpp_cliente_eve_criado_04, msg_wpp_cliente_eve_alterado_05, msg_wpp_cliente_eve_cancelado_06,
    msg_wpp_cliente_finalizado_07, msg_wpp_cliente_naocompareceu_08,
    msg_wpp_colab_avisofinal_09, msg_wpp_cliente_avisofinal_10,
    msg_wpp_cliente_lembreteamanha_11, msg_wpp_cliente_registro_50, msg_wpp_cliente_variada_51,
    msg_wpp_cliente_redefinirsenha_12, msg_wpp_cliente_avisopromo_13, msg_wpp_cliente_lembretehoje_14
  FROM public.mensagens WHERE barbearia_id = p_modelo_id;

  INSERT INTO public.promocao (id, numero_promo, imagem_promo, texto_promo, data_promo,
    testada, texto_promo_ia_2, texto_promo_ia_3, imagem_upada, barbearia_id,
    texto_promo_auxiliar, imagem_banner, promo_para_quem, tipo_promo,
    num_promo_criadas, num_limite_promo, last_reset_month,
    texto_promo_ia_1, texto_enviar_1, texto_enviar_2, texto_enviar_3)
  SELECT m.new_id, p.numero_promo, p.imagem_promo, p.texto_promo, p.data_promo,
    false, p.texto_promo_ia_2, p.texto_promo_ia_3, p.imagem_upada, v_new_id,
    p.texto_promo_auxiliar, p.imagem_banner, p.promo_para_quem, p.tipo_promo,
    0, p.num_limite_promo, p.last_reset_month,
    p.texto_promo_ia_1, p.texto_enviar_1, p.texto_enviar_2, p.texto_enviar_3
  FROM public.promocao p JOIN _map_promocao m ON m.old_id = p.id
  WHERE p.barbearia_id = p_modelo_id;

  INSERT INTO public.blog (id, titulo, resumo, link_noticia, imagem_url, autor_id,
    barbearia_id, likes, dislikes)
  SELECT m.new_id, b.titulo, b.resumo, b.link_noticia, b.imagem_url, v_new_admin_id,
    v_new_id, 0, 0
  FROM public.blog b JOIN _map_blog m ON m.old_id = b.id
  WHERE b.barbearia_id = p_modelo_id;

  INSERT INTO public.cores (
    id, barbearia_id, preset, modo,
    background, foreground, card, card_foreground, popover, popover_foreground,
    "primary", primary_foreground, secondary, secondary_foreground, muted, muted_foreground,
    accent, accent_foreground, destructive, destructive_foreground, border, input, ring,
    titulo, subtitulo, sidebar, sidebar_foreground, sidebar_primary, sidebar_primary_foreground,
    sidebar_accent, sidebar_accent_foreground, sidebar_border, sidebar_ring,
    dark_background, dark_foreground, dark_card, dark_card_foreground, dark_popover, dark_popover_foreground,
    dark_primary, dark_primary_foreground, dark_secondary, dark_secondary_foreground,
    dark_muted, dark_muted_foreground, dark_accent, dark_accent_foreground,
    dark_destructive, dark_destructive_foreground, dark_border, dark_input, dark_ring,
    dark_titulo, dark_subtitulo, dark_sidebar, dark_sidebar_foreground,
    dark_sidebar_primary, dark_sidebar_primary_foreground, dark_sidebar_accent, dark_sidebar_accent_foreground,
    dark_sidebar_border, dark_sidebar_ring
  )
  SELECT
    gen_random_uuid(), v_new_id, preset, modo,
    background, foreground, card, card_foreground, popover, popover_foreground,
    "primary", primary_foreground, secondary, secondary_foreground, muted, muted_foreground,
    accent, accent_foreground, destructive, destructive_foreground, border, input, ring,
    titulo, subtitulo, sidebar, sidebar_foreground, sidebar_primary, sidebar_primary_foreground,
    sidebar_accent, sidebar_accent_foreground, sidebar_border, sidebar_ring,
    dark_background, dark_foreground, dark_card, dark_card_foreground, dark_popover, dark_popover_foreground,
    dark_primary, dark_primary_foreground, dark_secondary, dark_secondary_foreground,
    dark_muted, dark_muted_foreground, dark_accent, dark_accent_foreground,
    dark_destructive, dark_destructive_foreground, dark_border, dark_input, dark_ring,
    dark_titulo, dark_subtitulo, dark_sidebar, dark_sidebar_foreground,
    dark_sidebar_primary, dark_sidebar_primary_foreground, dark_sidebar_accent, dark_sidebar_accent_foreground,
    dark_sidebar_border, dark_sidebar_ring
  FROM public.cores WHERE barbearia_id = p_modelo_id;

  PERFORM public._rewrite_clone_image_urls(p_modelo_id, v_new_id);

  RETURN jsonb_build_object(
    'id', v_new_id,
    'slug', p_new_slug,
    'mapping', jsonb_build_object(
      'barbearia',     jsonb_build_object('old', p_modelo_id, 'new', v_new_id),
      'servicos',      COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_servicos), '{}'::jsonb),
      'colaboradores', COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_colaboradores), '{}'::jsonb),
      'informacoes',   COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_informacoes), '{}'::jsonb),
      'promocao',      COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_promocao), '{}'::jsonb),
      'blog',          COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_blog), '{}'::jsonb),
      'agentes',       COALESCE((SELECT jsonb_object_agg(old_id::text, new_id::text) FROM _map_agentes), '{}'::jsonb)
    )
  );
END;
$function$;
