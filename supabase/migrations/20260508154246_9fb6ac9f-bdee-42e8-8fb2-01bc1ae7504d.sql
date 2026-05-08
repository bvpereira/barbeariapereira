CREATE OR REPLACE FUNCTION public.handle_atendimento_agendamento_webhook()
RETURNS TRIGGER AS $$
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
  -- Get the webhook URL for 'atendimentos' type
  SELECT webhook_url INTO webhook_url_text 
  FROM public.integracoes 
  WHERE tipo = 'atendimentos' 
  LIMIT 1;

  -- Exit if no URL is configured
  IF webhook_url_text IS NULL OR webhook_url_text = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check user level. We only fire for level 3 (Customer)
  -- For UPDATE, we check the user level of the client assigned to the record
  SELECT nivel, login, nome INTO user_nivel, cliente_login, cliente_nome 
  FROM public.usuarios 
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.cliente_id ELSE NEW.cliente_id END);

  -- Only level 3 triggers this specific webhook
  IF user_nivel IS NULL OR user_nivel != 3 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine event type and check for relevant changes
  IF (TG_OP = 'INSERT') THEN
    -- If services are empty on insert, we wait for the sync update to fire the webhook
    IF (NEW.servicos_atendimento IS NULL OR NEW.servicos_atendimento = '') THEN
      RETURN NEW;
    END IF;
    event_type := 'Agendamento';
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If it was previously empty and now has services, it's the initial "Agendamento" webhook firing late
    IF (COALESCE(OLD.servicos_atendimento, '') = '' AND COALESCE(NEW.servicos_atendimento, '') <> '') THEN
      event_type := 'Agendamento';
    -- Otherwise check if it's a rescheduling (date, services or colaborador changed)
    ELSIF (OLD.data IS DISTINCT FROM NEW.data OR OLD.servicos_atendimento IS DISTINCT FROM NEW.servicos_atendimento OR OLD.colaborador_id IS DISTINCT FROM NEW.colaborador_id) THEN
      event_type := 'Remarcacao';
    ELSE
      RETURN NEW; -- No relevant change
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    event_type := 'Exclusao';
  END IF;

  -- Get colaborador name and login
  SELECT nome, login INTO colaborador_nome, colaborador_login 
  FROM public.colaboradores 
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.colaborador_id ELSE NEW.colaborador_id END);

  -- Build base payload
  payload := jsonb_build_object(
    'Tipo', event_type,
    'login_cliente', COALESCE(cliente_login, ''),
    'telefone_colaborador', COALESCE(colaborador_login, ''),
    'Data', TO_CHAR((CASE WHEN TG_OP = 'DELETE' THEN OLD.data ELSE NEW.data END) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'Servicos', COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.servicos_atendimento ELSE NEW.servicos_atendimento END), ''),
    'Colaborador', COALESCE(colaborador_nome, ''),
    'Cliente', COALESCE(cliente_nome, '')
  );

  -- Add old data/time if it's a rescheduling
  IF (event_type = 'Remarcacao' AND TG_OP = 'UPDATE') THEN
    payload := payload || jsonb_build_object(
      'data_antiga', TO_CHAR(OLD.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
      'hora_antiga', TO_CHAR(OLD.data AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
    );
  END IF;

  -- Send webhook
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;