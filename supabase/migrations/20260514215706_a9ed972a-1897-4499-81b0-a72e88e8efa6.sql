CREATE OR REPLACE FUNCTION public.handle_atendimento_finalizacao_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url_text TEXT;
  cliente_login TEXT;
  cliente_nome TEXT;
  colaborador_nome TEXT;
  payload JSONB;
  status_envio TEXT;
BEGIN
  SELECT webhook_url INTO webhook_url_text 
  FROM public.integracoes 
  WHERE tipo = 'finalizacao' 
  LIMIT 1;

  IF webhook_url_text IS NULL OR webhook_url_text = '' THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND (NEW.status = 'Finalizado' OR NEW.status = 'Não compareceu')) OR
     (TG_OP = 'UPDATE' AND (OLD.status = 'Agendado' AND (NEW.status = 'Finalizado' OR NEW.status = 'Não compareceu'))) THEN
    
    SELECT login, nome INTO cliente_login, cliente_nome FROM public.usuarios WHERE id = NEW.cliente_id;
    SELECT nome INTO colaborador_nome FROM public.colaboradores WHERE id = NEW.colaborador_id;

    IF NEW.status = 'Finalizado' THEN
      status_envio := 'Finalizado';
    ELSE
      status_envio := 'nao_compareceu';
    END IF;

    payload := jsonb_build_object(
      'tipo', status_envio,
      'telefone_cliente', COALESCE(cliente_login, ''),
      'data', NEW.data,
      'horario', to_char(NEW.data AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      'valor', NEW.valor,
      'servicos', COALESCE(NEW.servicos_atendimento, ''),
      'colaborador', COALESCE(colaborador_nome, ''),
      'cliente', COALESCE(cliente_nome, '')
    );

    BEGIN
      PERFORM net.http_post(
        url := webhook_url_text,
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao disparar webhook: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$function$;