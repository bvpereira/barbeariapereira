ALTER TABLE public.notificacoes
  RENAME COLUMN notificacao_auxiliar TO noti_texto_auxiliar;

ALTER TABLE public.notificacoes
  ALTER COLUMN noti_texto_auxiliar DROP DEFAULT,
  ALTER COLUMN noti_texto_auxiliar DROP NOT NULL;

ALTER TABLE public.notificacoes
  ALTER COLUMN noti_texto_auxiliar TYPE text
    USING CASE WHEN noti_texto_auxiliar THEN COALESCE(texto, '') ELSE NULL END;

ALTER TABLE public.notificacoes
  ADD COLUMN noti_titulo_auxiliar text;

UPDATE public.notificacoes
SET noti_titulo_auxiliar = CASE
      WHEN numero_notificacao = 0 AND canal = 'whatsapp' THEN titulo
      ELSE noti_titulo_auxiliar
    END,
    noti_texto_auxiliar = CASE
      WHEN numero_notificacao = 0 AND canal = 'whatsapp' THEN texto
      ELSE noti_texto_auxiliar
    END
WHERE numero_notificacao = 0;

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
SET search_path TO 'public'
AS $function$
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
      SELECT n.id,
             n.noti_titulo_auxiliar AS titulo,
             n.noti_texto_auxiliar AS texto,
             'whatsapp'::text AS canal,
             n.testada
      FROM public.notificacoes n
      WHERE n.numero_notificacao = 0
        AND (n.noti_titulo_auxiliar IS NOT NULL OR n.noti_texto_auxiliar IS NOT NULL)
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
      titulo, texto, canal, numero_notificacao, testada, publicada_em
    ) VALUES (
      p_payload->>'titulo', p_payload->>'texto', 'site', v_next, false, v_published_at
    );

    RETURN jsonb_build_object('ok', true, 'numero_notificacao', v_next);

  ELSIF p_action = 'delete' THEN
    v_id := (p_payload->>'id')::uuid;
    DELETE FROM public.notificacoes WHERE id = v_id AND numero_notificacao > 0;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_action = 'save_drafts' THEN
    UPDATE public.notificacoes
    SET noti_titulo_auxiliar = p_payload->>'titulo',
        noti_texto_auxiliar = p_payload->>'texto',
        testada = false
    WHERE numero_notificacao = 0;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_action = 'mark_tested' THEN
    UPDATE public.notificacoes
    SET noti_titulo_auxiliar = p_payload->>'titulo',
        noti_texto_auxiliar = p_payload->>'texto',
        testada = true
    WHERE numero_notificacao = 0;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_action = 'prepare_send' THEN
    SELECT n.testada,
           jsonb_build_object(
             'titulo', n.noti_titulo_auxiliar,
             'texto', n.noti_texto_auxiliar
           )
    INTO v_testada, v_rows
    FROM public.notificacoes n
    WHERE n.numero_notificacao = 0
      AND n.noti_titulo_auxiliar IS NOT NULL
      AND n.noti_texto_auxiliar IS NOT NULL
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
      titulo, texto, canal, numero_notificacao, testada, publicada_em
    )
    SELECT n.noti_titulo_auxiliar, n.noti_texto_auxiliar,
           'whatsapp', v_next, true, v_published_at
    FROM public.notificacoes n
    WHERE n.numero_notificacao = 0
      AND n.testada = true
      AND n.noti_titulo_auxiliar IS NOT NULL
      AND n.noti_texto_auxiliar IS NOT NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Envie um teste antes da notificação real.';
    END IF;

    UPDATE public.notificacoes
    SET noti_titulo_auxiliar = NULL,
        noti_texto_auxiliar = NULL,
        testada = false
    WHERE numero_notificacao = 0;

    RETURN jsonb_build_object('ok', true, 'numero_notificacao', v_next);
  END IF;

  RAISE EXCEPTION 'Operação inválida.';
END;
$function$;