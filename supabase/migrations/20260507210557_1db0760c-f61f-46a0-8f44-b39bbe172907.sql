-- Função para disparar o webhook de finalização
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
  -- Caso 1 & 2: Mudança de Agendado -> Finalizado ou Não compareceu
  -- Caso 3 & 4: Criado já como Finalizado ou Não compareceu
  IF (TG_OP = 'INSERT' AND (NEW.status = 'Finalizado' OR NEW.status = 'Não compareceu')) OR
     (TG_OP = 'UPDATE' AND (OLD.status = 'Agendado' AND (NEW.status = 'Finalizado' OR NEW.status = 'Não compareceu'))) THEN
    
    -- Buscar telefone de contato das informações
    SELECT tel_contato INTO tel_contato_text FROM public.informacoes LIMIT 1;
    
    -- Buscar nome do cliente
    SELECT nome INTO cliente_nome FROM public.usuarios WHERE id = NEW.cliente_id;
    
    -- Buscar nome do colaborador
    SELECT nome INTO colaborador_nome FROM public.colaboradores WHERE id = NEW.colaborador_id;

    -- Definir o tipo para o payload
    IF NEW.status = 'Finalizado' THEN
      status_envio := 'Finalizado';
    ELSE
      status_envio := 'nao_compareceu';
    END IF;

    -- Montar o payload JSON
    payload := jsonb_build_object(
      'Tipo', status_envio,
      'Telefone_cliente', COALESCE(tel_contato_text, ''),
      'Data', NEW.data,
      'Servicos', COALESCE(NEW.servicos_atendimento, ''),
      'Colaborador', COALESCE(colaborador_nome, ''),
      'Cliente', COALESCE(cliente_nome, '')
    );

    -- Disparar o webhook de forma assíncrona usando net.http_post
    -- Nota: Usamos PERFORM para ignorar o retorno e não bloquear
    BEGIN
      PERFORM net.http_post(
        url := webhook_url_text,
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Silencia erros para não bloquear o sistema
      RAISE WARNING 'Erro ao disparar webhook de finalização: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para monitorar inserções e atualizações na tabela atendimentos
DROP TRIGGER IF EXISTS trigger_atendimento_finalizacao_webhook ON public.atendimentos;
CREATE TRIGGER trigger_atendimento_finalizacao_webhook
AFTER INSERT OR UPDATE ON public.atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.handle_atendimento_finalizacao_webhook();
