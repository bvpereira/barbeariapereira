-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update the function to include search_path for security
ALTER FUNCTION public.handle_atendimento_finalizacao_webhook() SET search_path = public;
