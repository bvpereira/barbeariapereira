ALTER TABLE public.notificacoes
ADD COLUMN barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.notificacoes_whatsapp_atual_idx;

CREATE UNIQUE INDEX notificacoes_whatsapp_atual_por_barbearia_idx
ON public.notificacoes (barbearia_id)
WHERE canal = 'whatsapp' AND numero_notificacao = 0;

DELETE FROM public.notificacoes
WHERE canal = 'whatsapp' AND numero_notificacao = 0 AND barbearia_id IS NULL;

INSERT INTO public.notificacoes (barbearia_id, titulo, texto, canal, numero_notificacao, testada)
VALUES
  ('01879baf-8f8b-4c3d-810f-7740b6432cd9', '', '', 'whatsapp', 0, false),
  ('139b84a5-baff-456f-91fb-f1a9a678319f', '', '', 'whatsapp', 0, false)
ON CONFLICT (barbearia_id) WHERE canal = 'whatsapp' AND numero_notificacao = 0 DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_latest_site_notifications()
RETURNS TABLE (id uuid, titulo text, texto text, publicada_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.titulo, n.texto, n.publicada_em
  FROM public.notificacoes n
  WHERE n.canal = 'site' AND n.publicada_em IS NOT NULL
  ORDER BY n.publicada_em DESC
  LIMIT 6
$$;

CREATE OR REPLACE FUNCTION public.manage_notificacoes(
  p_admin_id uuid,
  p_login text,
  p_senha text,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page integer;
  v_from integer;
  v_id uuid;
  v_draft public.notificacoes%ROWTYPE;
  v_next integer;
  v_published_at timestamptz;
  v_rows jsonb;
  v_count bigint;
  v_drafts jsonb;
  v_webhook text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_admin_id AND u.login = p_login AND u.senha = p_senha AND u.nivel = 0
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF p_action = 'page' THEN
    v_page := LEAST(GREATEST(COALESCE((p_payload->>'page')::integer, 0), 0), 10000);
    v_from := v_page * 10;
    SELECT count(*) INTO v_count FROM public.notificacoes n
    WHERE n.canal = 'site' OR (n.canal = 'whatsapp' AND n.numero_notificacao > 0);
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT n.id, n.barbearia_id, n.titulo, n.texto, n.canal, n.numero_notificacao,
             n.testada, n.publicada_em, n.created_at
      FROM public.notificacoes n
      WHERE n.canal = 'site' OR (n.canal = 'whatsapp' AND n.numero_notificacao > 0)
      ORDER BY n.publicada_em DESC NULLS LAST, n.created_at DESC
      OFFSET v_from LIMIT 10
    ) x;
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_drafts
    FROM (
      SELECT n.id, n.barbearia_id, n.titulo, n.texto, n.testada
      FROM public.notificacoes n
      WHERE n.canal = 'whatsapp' AND n.numero_notificacao = 0
      ORDER BY n.created_at
    ) x;
    RETURN jsonb_build_object('rows', v_rows, 'count', v_count, 'drafts', v_drafts);
  ELSIF p_action = 'publish_site' THEN
    INSERT INTO public.notificacoes (titulo, texto, canal, publicada_em)
    VALUES (p_payload->>'titulo', p_payload->>'texto', 'site', now());
    RETURN jsonb_build_object('ok', true);
  ELSIF p_action = 'delete' THEN
    v_id := (p_payload->>'id')::uuid;
    DELETE FROM public.notificacoes WHERE id = v_id AND COALESCE(numero_notificacao, -1) <> 0;
    RETURN jsonb_build_object('ok', true);
  ELSIF p_action IN ('save_drafts', 'mark_tested') THEN
    UPDATE public.notificacoes
    SET titulo = p_payload->>'titulo', texto = p_payload->>'texto', testada = (p_action = 'mark_tested')
    WHERE canal = 'whatsapp' AND numero_notificacao = 0;
    RETURN jsonb_build_object('ok', true);
  ELSIF p_action = 'prepare_send' THEN
    IF EXISTS (SELECT 1 FROM public.notificacoes WHERE canal = 'whatsapp' AND numero_notificacao = 0 AND NOT testada) THEN
      RAISE EXCEPTION 'Envie um teste antes da notificação real.';
    END IF;
    SELECT webhook_url INTO v_webhook FROM public.integracoes WHERE tipo = 'promocao' ORDER BY created_at DESC LIMIT 1;
    SELECT jsonb_build_object('titulo', n.titulo, 'texto', n.texto) INTO v_rows
    FROM public.notificacoes n WHERE n.canal = 'whatsapp' AND n.numero_notificacao = 0 ORDER BY n.created_at LIMIT 1;
    RETURN jsonb_build_object('notification', v_rows, 'webhook_url', v_webhook);
  ELSIF p_action = 'webhook_config' THEN
    SELECT webhook_url INTO v_webhook FROM public.integracoes WHERE tipo = 'promocao' ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object('webhook_url', v_webhook);
  ELSIF p_action = 'finalize_send' THEN
    SELECT COALESCE(max(numero_notificacao), 0) + 1 INTO v_next
    FROM public.notificacoes WHERE canal = 'whatsapp' AND numero_notificacao > 0;
    v_published_at := now();
    INSERT INTO public.notificacoes (barbearia_id, titulo, texto, canal, numero_notificacao, testada, publicada_em)
    SELECT n.barbearia_id, n.titulo, n.texto, 'whatsapp', v_next, true, v_published_at
    FROM public.notificacoes n WHERE n.canal = 'whatsapp' AND n.numero_notificacao = 0;
    UPDATE public.notificacoes SET titulo = '', texto = '', testada = false, publicada_em = NULL
    WHERE canal = 'whatsapp' AND numero_notificacao = 0;
    RETURN jsonb_build_object('ok', true);
  END IF;
  RAISE EXCEPTION 'Operação inválida.';
END;
$$;

REVOKE ALL ON FUNCTION public.manage_notificacoes(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_notificacoes(uuid, text, text, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_latest_site_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_site_notifications() TO anon, authenticated;