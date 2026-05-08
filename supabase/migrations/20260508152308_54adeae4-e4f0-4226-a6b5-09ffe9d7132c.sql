-- Function to handle appointment webhooks (create, update, delete)
CREATE OR REPLACE FUNCTION public.handle_atendimento_agendamento_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url_text TEXT;
  user_nivel INTEGER;
  cliente_login TEXT;
  cliente_nome TEXT;
  colaborador_nome TEXT;
  payload JSONB;
  event_type TEXT;
  target_id UUID;
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

  -- Determine which record to use (NEW for insert/update, OLD for delete)
  IF (TG_OP = 'DELETE') THEN
    target_id := OLD.id;
  ELSE
    target_id := NEW.id;
  END IF;

  -- Check user level. We only fire for level 3 (Customer)
  -- Since the action is usually via API/Trigger, we check the auth.uid() or the cliente_id's level
  -- For safety and according to requirements, we check the level of the user associated with the record
  SELECT nivel, login, nome INTO user_nivel, cliente_login, cliente_nome 
  FROM public.usuarios 
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.cliente_id ELSE NEW.cliente_id END);

  -- Only level 3 triggers this specific webhook
  IF user_nivel IS NULL OR user_nivel != 3 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine event type
  IF (TG_OP = 'INSERT') THEN
    event_type := 'Agendamento';
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Only trigger if data or hora changed
    IF (OLD.data IS DISTINCT FROM NEW.data OR OLD.hora IS DISTINCT FROM NEW.hora) THEN
      event_type := 'Remarcacao';
    ELSE
      RETURN NEW; -- No relevant change
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    event_type := 'Exclusao';
  END IF;

  -- Get colaborador name
  SELECT nome INTO colaborador_nome 
  FROM public.colaboradores 
  WHERE id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.colaborador_id ELSE NEW.colaborador_id END);

  -- Build payload
  payload := jsonb_build_object(
    'Tipo', event_type,
    'login_cliente', COALESCE(cliente_login, ''),
    'Telefone_cliente', COALESCE(cliente_login, ''),
    'Data', (CASE WHEN TG_OP = 'DELETE' THEN OLD.data ELSE NEW.data END),
    'Hora', (CASE WHEN TG_OP = 'DELETE' THEN OLD.hora ELSE NEW.hora END),
    'Servicos', COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.servicos_atendimento ELSE NEW.servicos_atendimento END), ''),
    'Colaborador', COALESCE(colaborador_nome, ''),
    'Cliente', COALESCE(cliente_nome, '')
  );

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_atendimento_agendamento_webhook ON public.atendimentos;
CREATE TRIGGER trigger_atendimento_agendamento_webhook
AFTER INSERT OR UPDATE OR DELETE ON public.atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.handle_atendimento_agendamento_webhook();