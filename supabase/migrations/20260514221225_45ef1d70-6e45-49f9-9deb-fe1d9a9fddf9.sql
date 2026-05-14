CREATE OR REPLACE FUNCTION public.handle_atendimento_agendamento_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url_text TEXT;
  user_nivel INTEGER;
  cliente_login TEXT;
  cliente_nome TEXT;
  colaborador_nome TEXT;
  colaborador_login TEXT;
  payload JSONB;
  event_type TEXT;
BEGIN
  SELECT webhook_url INTO webhook_url_text 
  FROM public.integracoes 
  WHERE tipo = 'atendimentos' 
  LIMIT 1;

  IF webhook_url_text IS NULL OR webhook_url_text = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT nivel, login, nome INTO user_nivel, cliente_login, cliente_nome 
  FROM public.usuarios 
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.cliente_id ELSE NEW.cliente_id END);

  IF user_nivel IS NULL OR user_nivel != 3 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    IF (NEW.servicos_atendimento IS NULL OR NEW.servicos_atendimento = '') THEN
      RETURN NEW;
    END IF;
    event_type := 'agendamento';
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (COALESCE(OLD.servicos_atendimento, '') = '' AND COALESCE(NEW.servicos_atendimento, '') <> '') THEN
      event_type := 'agendamento';
    ELSIF (OLD.data IS DISTINCT FROM NEW.data OR OLD.servicos_atendimento IS DISTINCT FROM NEW.servicos_atendimento OR OLD.colaborador_id IS DISTINCT FROM NEW.colaborador_id OR OLD.valor IS DISTINCT FROM NEW.valor) THEN
      event_type := 'remarcacao';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    event_type := 'exclusao';
  END IF;

  SELECT nome, login INTO colaborador_nome, colaborador_login 
  FROM public.colaboradores 
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.colaborador_id ELSE NEW.colaborador_id END);

  payload := jsonb_build_object(
    'tipo', event_type,
    'login_cliente', COALESCE(cliente_login, ''),
    'telefone_colaborador', COALESCE(colaborador_login, ''),
    'data', TO_CHAR((CASE WHEN TG_OP = 'DELETE' THEN OLD.data ELSE NEW.data END) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'servicos', COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.servicos_atendimento ELSE NEW.servicos_atendimento END), ''),
    'colaborador', COALESCE(colaborador_nome, ''),
    'cliente', COALESCE(cliente_nome, ''),
    'valor', COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.valor ELSE NEW.valor END), 0)
  );

  IF (event_type = 'remarcacao' AND TG_OP = 'UPDATE') THEN
    payload := payload || jsonb_build_object(
      'data_antiga', TO_CHAR(OLD.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
      'hora_antiga', TO_CHAR(OLD.data AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
    );
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := webhook_url_text,
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error firing appointment webhook: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;