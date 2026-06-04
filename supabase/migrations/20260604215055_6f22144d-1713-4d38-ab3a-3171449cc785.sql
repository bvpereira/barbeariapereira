ALTER TABLE public.informacoes ADD COLUMN instancia_propria TEXT;

-- Garantir que os privilégios sejam mantidos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.informacoes TO authenticated;
GRANT ALL ON public.informacoes TO service_role;
