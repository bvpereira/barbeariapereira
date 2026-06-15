-- Helper to rewrite a URL: replace old barbearia id and old parent id with new ones.
CREATE OR REPLACE FUNCTION public._clone_rewrite_url(p_url text, p_old_barb uuid, p_new_barb uuid, p_old_parent uuid, p_new_parent uuid)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_url IS NULL THEN NULL
    ELSE replace(replace(p_url, '/' || p_old_barb::text || '/', '/' || p_new_barb::text || '/'),
                              '/' || p_old_parent::text || '/', '/' || p_new_parent::text || '/')
  END
$$;

-- Append a post-step in clone: rewrite URLs in cloned rows so they point to the freshly copied storage paths.
CREATE OR REPLACE FUNCTION public._rewrite_clone_image_urls(p_old_barb uuid, p_new_barb uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- servicos (parent = servicos.id) — map via _map_servicos
  UPDATE public.servicos s SET
    image_url   = _clone_rewrite_url(image_url,   p_old_barb, p_new_barb, m.old_id, s.id),
    image_url_2 = _clone_rewrite_url(image_url_2, p_old_barb, p_new_barb, m.old_id, s.id),
    image_url_3 = _clone_rewrite_url(image_url_3, p_old_barb, p_new_barb, m.old_id, s.id),
    image_url_4 = _clone_rewrite_url(image_url_4, p_old_barb, p_new_barb, m.old_id, s.id),
    image_url_5 = _clone_rewrite_url(image_url_5, p_old_barb, p_new_barb, m.old_id, s.id)
  FROM _map_servicos m WHERE m.new_id = s.id AND s.barbearia_id = p_new_barb;

  -- colaboradores
  UPDATE public.colaboradores c SET
    foto_url   = _clone_rewrite_url(foto_url,   p_old_barb, p_new_barb, m.old_id, c.id),
    foto_url_2 = _clone_rewrite_url(foto_url_2, p_old_barb, p_new_barb, m.old_id, c.id),
    foto_url_3 = _clone_rewrite_url(foto_url_3, p_old_barb, p_new_barb, m.old_id, c.id),
    foto_url_4 = _clone_rewrite_url(foto_url_4, p_old_barb, p_new_barb, m.old_id, c.id),
    foto_url_5 = _clone_rewrite_url(foto_url_5, p_old_barb, p_new_barb, m.old_id, c.id),
    foto_url_6 = _clone_rewrite_url(foto_url_6, p_old_barb, p_new_barb, m.old_id, c.id),
    foto_url_7 = _clone_rewrite_url(foto_url_7, p_old_barb, p_new_barb, m.old_id, c.id)
  FROM _map_colaboradores m WHERE m.new_id = c.id AND c.barbearia_id = p_new_barb;

  -- informacoes
  UPDATE public.informacoes i SET
    imagem_1    = _clone_rewrite_url(imagem_1,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_2    = _clone_rewrite_url(imagem_2,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_3    = _clone_rewrite_url(imagem_3,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_4    = _clone_rewrite_url(imagem_4,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_5    = _clone_rewrite_url(imagem_5,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_6    = _clone_rewrite_url(imagem_6,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_7    = _clone_rewrite_url(imagem_7,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_8    = _clone_rewrite_url(imagem_8,    p_old_barb, p_new_barb, m.old_id, i.id),
    imagem_logo = _clone_rewrite_url(imagem_logo, p_old_barb, p_new_barb, m.old_id, i.id),
    video_local = _clone_rewrite_url(video_local, p_old_barb, p_new_barb, m.old_id, i.id),
    foto_perfil = _clone_rewrite_url(foto_perfil, p_old_barb, p_new_barb, m.old_id, i.id)
  FROM _map_informacoes m WHERE m.new_id = i.id AND i.barbearia_id = p_new_barb;

  -- agentes_ia
  UPDATE public.agentes_ia a SET
    imagem_objetivo      = _clone_rewrite_url(imagem_objetivo,      p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_campanha      = _clone_rewrite_url(imagem_campanha,      p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_estilovisual  = _clone_rewrite_url(imagem_estilovisual,  p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_informacoes   = _clone_rewrite_url(imagem_informacoes,   p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_imareferencia = _clone_rewrite_url(imagem_imareferencia, p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_comlogo       = _clone_rewrite_url(imagem_comlogo,       p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_criada_ia     = _clone_rewrite_url(imagem_criada_ia,     p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_referencia_ia = _clone_rewrite_url(imagem_referencia_ia, p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_endereco      = _clone_rewrite_url(imagem_endereco,      p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_instagram     = _clone_rewrite_url(imagem_instagram,     p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_telcontato    = _clone_rewrite_url(imagem_telcontato,    p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_paleta        = _clone_rewrite_url(imagem_paleta,        p_old_barb, p_new_barb, m.old_id, a.id),
    imagem_elem_central  = _clone_rewrite_url(imagem_elem_central,  p_old_barb, p_new_barb, m.old_id, a.id),
    edit_imagemupada     = _clone_rewrite_url(edit_imagemupada,     p_old_barb, p_new_barb, m.old_id, a.id),
    edit_imagemeditada   = _clone_rewrite_url(edit_imagemeditada,   p_old_barb, p_new_barb, m.old_id, a.id)
  FROM _map_agentes m WHERE m.new_id = a.id AND a.barbearia_id = p_new_barb;

  -- promocao
  UPDATE public.promocao p SET
    imagem_promo  = _clone_rewrite_url(imagem_promo,  p_old_barb, p_new_barb, m.old_id, p.id),
    imagem_ia     = _clone_rewrite_url(imagem_ia,     p_old_barb, p_new_barb, m.old_id, p.id),
    imagem_banner = _clone_rewrite_url(imagem_banner, p_old_barb, p_new_barb, m.old_id, p.id)
  FROM _map_promocao m WHERE m.new_id = p.id AND p.barbearia_id = p_new_barb;

  -- blog
  UPDATE public.blog b SET
    imagem_url = _clone_rewrite_url(imagem_url, p_old_barb, p_new_barb, m.old_id, b.id)
  FROM _map_blog m WHERE m.new_id = b.id AND b.barbearia_id = p_new_barb;
END $$;