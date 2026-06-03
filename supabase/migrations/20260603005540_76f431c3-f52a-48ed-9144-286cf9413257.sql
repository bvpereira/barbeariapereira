-- Update handle_atendimento_agendamento_webhook
CREATE OR REPLACE FUNCTION public.handle_atendimento_agendamento_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
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
  current_row RECORD;
BEGIN
  SELECT webhook_url INTO webhook_url_text 
  FROM public.integracoes 
  WHERE tipo = 'atendimentos' 
  LIMIT 1;

  IF webhook_url_text IS NULL OR webhook_url_text = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  current_row := COALESCE(NEW, OLD);

  SELECT nivel, login, nome INTO user_nivel, cliente_login, cliente_nome 
  FROM public.usuarios 
  WHERE id = current_row.cliente_id;

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
  WHERE id = current_row.colaborador_id;

  payload := jsonb_build_object(
    'tipo', event_type,
    'login_cliente', COALESCE(cliente_login, ''),
    'telefone_colaborador', COALESCE(colaborador_login, ''),
    'data', TO_CHAR(current_row.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'servicos', COALESCE(current_row.servicos_atendimento, ''),
    'colaborador', COALESCE(colaborador_nome, ''),
    'cliente', COALESCE(cliente_nome, ''),
    'valor', COALESCE(current_row.valor, 0),
    'id_barbearia', current_row.barbearia_id,
    'barbearia_id', current_row.barbearia_id
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

-- Update handle_atendimento_finalizacao_webhook
CREATE OR REPLACE FUNCTION public.handle_atendimento_finalizacao_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
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
      'cliente', COALESCE(cliente_nome, ''),
      'id_barbearia', NEW.barbearia_id,
      'barbearia_id', NEW.barbearia_id
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
