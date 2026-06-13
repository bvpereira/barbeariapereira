ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS notificacao_auxiliar boolean NOT NULL DEFAULT false;

ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS notificacoes_numero_por_canal;

WITH numeradas AS (
  SELECT id,
         (SELECT COALESCE(MAX(n2.numero_notificacao), 0) FROM public.notificacoes n2)
         + ROW_NUMBER() OVER (ORDER BY created_at, id) AS novo_numero
  FROM public.notificacoes
  WHERE numero_notificacao IS NULL
)
UPDATE public.notificacoes n
SET numero_notificacao = numeradas.novo_numero
FROM numeradas
WHERE n.id = numeradas.id;

DROP INDEX IF EXISTS public.notificacoes_whatsapp_atual_por_barbearia_idx;
DROP INDEX IF EXISTS public.notificacoes_whatsapp_atual_idx;

DELETE FROM public.notificacoes
WHERE numero_notificacao = 0;

INSERT INTO public.notificacoes (
  titulo, texto, canal, numero_notificacao, notificacao_auxiliar, testada
)
VALUES ('', '', 'site', 0, true, false);

CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_numero_positivo_idx
ON public.notificacoes (numero_notificacao)
WHERE numero_notificacao > 0;

CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_auxiliar_zero_idx
ON public.notificacoes (numero_notificacao)
WHERE numero_notificacao = 0;

INSERT INTO public.integracoes (barbearia_id, tipo, webhook_url)
VALUES (
  NULL,
  'notificacao_superadmin',
  'https://n8n.servidorpereira.shop/webhook-test/superadminnotificacoes'
)
ON CONFLICT (tipo) DO UPDATE
SET webhook_url = EXCLUDED.webhook_url,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.get_latest_site_notifications()
RETURNS TABLE (id uuid, titulo text, texto text, publicada_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.titulo, n.texto, n.publicada_em
  FROM public.notificacoes n
  WHERE n.canal = 'site'
    AND n.numero_notificacao > 0
    AND n.publicada_em IS NOT NULL
  ORDER BY n.numero_notificacao DESC
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
  v_next integer;
  v_published_at timestamptz;
  v_rows jsonb;
  v_count bigint;
  v_auxiliar jsonb;
  v_webhook text;
  v_testada boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_admin_id
      AND u.login = p_login
      AND u.senha = p_senha
      AND u.nivel = 0
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF p_action = 'page' THEN
    v_page := LEAST(GREATEST(COALESCE((p_payload->>'page')::integer, 0), 0), 10000);
    v_from := v_page * 10;

    SELECT count(*) INTO v_count
    FROM public.notificacoes n
    WHERE n.numero_notificacao > 0;

    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT n.id, n.barbearia_id, n.titulo, n.texto, n.canal,
             n.numero_notificacao, n.testada, n.publicada_em, n.created_at
      FROM public.notificacoes n
      WHERE n.numero_notificacao > 0
      ORDER BY n.numero_notificacao DESC
      OFFSET v_from LIMIT 10
    ) x;

    SELECT to_jsonb(x) INTO v_auxiliar
    FROM (
      SELECT n.id, n.titulo, n.texto, n.canal, n.testada
      FROM public.notificacoes n
      WHERE n.numero_notificacao = 0
      LIMIT 1
    ) x;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'count', v_count,
      'drafts', CASE WHEN v_auxiliar IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_auxiliar) END
    );

  ELSIF p_action = 'publish_site' THEN
    SELECT COALESCE(MAX(numero_notificacao), 0) + 1 INTO v_next
    FROM public.notificacoes WHERE numero_notificacao > 0;
    v_published_at := now();

    INSERT INTO public.notificacoes (
      titulo, texto, canal, numero_notificacao, notificacao_auxiliar, testada, publicada_em
    ) VALUES (
      p_payload->>'titulo', p_payload->>'texto', 'site', v_next, false, false, v_published_at
    );

    UPDATE public.notificacoes
    SET titulo = p_payload->>'titulo', texto = p_payload->>'texto', canal = 'site',
        notificacao_auxiliar = true, testada = false, publicada_em = v_published_at
    WHERE numero_notificacao = 0;

    RETURN jsonb_build_object('ok', true, 'numero_notificacao', v_next);

  ELSIF p_action = 'delete' THEN
    v_id := (p_payload->>'id')::uuid;
    DELETE FROM public.notificacoes WHERE id = v_id AND numero_notificacao > 0;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_action = 'save_drafts' THEN
    UPDATE public.notificacoes
    SET titulo = p_payload->>'titulo', texto = p_payload->>'texto', canal = 'whatsapp',
        notificacao_auxiliar = true, testada = false, publicada_em = NULL
    WHERE numero_notificacao = 0;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_action = 'mark_tested' THEN
    UPDATE public.notificacoes
    SET titulo = p_payload->>'titulo', texto = p_payload->>'texto', canal = 'whatsapp',
        notificacao_auxiliar = true, testada = true, publicada_em = NULL
    WHERE numero_notificacao = 0;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_action = 'prepare_send' THEN
    SELECT n.testada,
           jsonb_build_object('titulo', n.titulo, 'texto', n.texto)
    INTO v_testada, v_rows
    FROM public.notificacoes n
    WHERE n.numero_notificacao = 0 AND n.canal = 'whatsapp'
    LIMIT 1;

    IF v_rows IS NULL OR NOT COALESCE(v_testada, false) THEN
      RAISE EXCEPTION 'Envie um teste antes da notificação real.';
    END IF;

    SELECT webhook_url INTO v_webhook
    FROM public.integracoes
    WHERE tipo = 'notificacao_superadmin'
    ORDER BY created_at DESC LIMIT 1;

    RETURN jsonb_build_object('notification', v_rows, 'webhook_url', v_webhook);

  ELSIF p_action = 'webhook_config' THEN
    SELECT webhook_url INTO v_webhook
    FROM public.integracoes
    WHERE tipo = 'notificacao_superadmin'
    ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object('webhook_url', v_webhook);

  ELSIF p_action = 'finalize_send' THEN
    SELECT COALESCE(MAX(numero_notificacao), 0) + 1 INTO v_next
    FROM public.notificacoes WHERE numero_notificacao > 0;
    v_published_at := now();

    INSERT INTO public.notificacoes (
      titulo, texto, canal, numero_notificacao, notificacao_auxiliar, testada, publicada_em
    )
    SELECT n.titulo, n.texto, 'whatsapp', v_next, false, true, v_published_at
    FROM public.notificacoes n
    WHERE n.numero_notificacao = 0 AND n.canal = 'whatsapp' AND n.testada = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Envie um teste antes da notificação real.';
    END IF;

    UPDATE public.notificacoes
    SET notificacao_auxiliar = true, publicada_em = v_published_at
    WHERE numero_notificacao = 0;

    RETURN jsonb_build_object('ok', true, 'numero_notificacao', v_next);
  END IF;

  RAISE EXCEPTION 'Operação inválida.';
END;
$$;

REVOKE ALL ON FUNCTION public.manage_notificacoes(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_notificacoes(uuid, text, text, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_latest_site_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_site_notifications() TO anon, authenticated;