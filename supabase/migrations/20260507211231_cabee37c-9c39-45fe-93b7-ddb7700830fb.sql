-- First, ensure the function to call the edge function exists
CREATE OR REPLACE FUNCTION public.handle_atendimento_finalizacao_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url_text TEXT;
  tel_contato_text TEXT;
  cliente_nome TEXT;
  colaborador_nome TEXT;
  payload JSONB;
  status_envio TEXT;
BEGIN
  -- Buscar a URL do webhook de finalização
  SELECT webhook_url INTO webhook_url_text 
  FROM public.integracoes 
  WHERE tipo = 'finalizacao' 
  LIMIT 1;

  -- Se não houver URL, não faz nada
  IF webhook_url_text IS NULL OR webhook_url_text = '' THEN
    RETURN NEW;
  END IF;

  -- Verificar se as condições de disparo são atendidas
  IF (TG_OP = 'INSERT' AND (NEW.status = 'Finalizado' OR NEW.status = 'Não compareceu')) OR
     (TG_OP = 'UPDATE' AND (OLD.status = 'Agendado' AND (NEW.status = 'Finalizado' OR NEW.status = 'Não compareceu'))) THEN
    
    -- Buscar telefone de contato
    SELECT tel_contato INTO tel_contato_text FROM public.informacoes LIMIT 1;
    
    -- Buscar nome do cliente
    SELECT nome INTO cliente_nome FROM public.usuarios WHERE id = NEW.cliente_id;
    
    -- Buscar nome do colaborador
    SELECT nome INTO colaborador_nome FROM public.colaboradores WHERE id = NEW.colaborador_id;

    -- Definir o status para o payload
    IF NEW.status = 'Finalizado' THEN
      status_envio := 'Finalizado';
    ELSE
      status_envio := 'nao_compareceu';
    END IF;

    -- Montar o payload JSON
    payload := jsonb_build_object(
      'webhook_url', webhook_url_text,
      'payload', jsonb_build_object(
        'Tipo', status_envio,
        'Telefone_cliente', COALESCE(tel_contato_text, ''),
        'Data', NEW.data,
        'Servicos', COALESCE(NEW.servicos_atendimento, ''),
        'Colaborador', COALESCE(colaborador_nome, ''),
        'Cliente', COALESCE(cliente_nome, '')
      )
    );

    -- Chamar a Edge Function (usando net.http_post se disponível, caso contrário precisaremos de outra abordagem)
    -- Se pg_net não estiver disponível, vamos usar uma abordagem via Edge Function que monitora mudanças (mais complexo)
    -- ou simplesmente tentar habilitar pg_net se tivermos permissão.
    
    -- Vamos tentar habilitar pg_net primeiro se não estiver
    -- CREATE EXTENSION IF NOT EXISTS pg_net;
    
    -- Como não temos certeza se pg_net pode ser habilitado, 
    -- vamos usar uma alternativa: disparar via uma Edge Function que o próprio app chamará quando o status mudar
    -- Mas o usuário quer automação via banco. 
    -- Se pg_net falhou, pode ser que a extensão precise ser habilitada.
    
    -- Vamos tentar habilitar e usar.
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net;
      PERFORM net.http_post(
        url := webhook_url_text,
        body := (payload->'payload')::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao disparar webhook: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
