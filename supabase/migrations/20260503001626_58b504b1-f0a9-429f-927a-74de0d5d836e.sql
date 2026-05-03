-- Ensure user_id is unique so we can use UPSERT or simple checks
ALTER TABLE public.informacoes ADD CONSTRAINT informacoes_user_id_key UNIQUE (user_id);
