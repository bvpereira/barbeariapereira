ALTER TABLE public.agentes_ia ADD COLUMN num_imagens_criadas INTEGER DEFAULT 0;
ALTER TABLE public.agentes_ia ADD COLUMN last_reset_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');

-- Garantir permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentes_ia TO authenticated;
GRANT ALL ON public.agentes_ia TO service_role;