ALTER TABLE public.agentes_ia ADD COLUMN num_limite_imagens INTEGER DEFAULT 0;
GRANT SELECT, UPDATE ON public.agentes_ia TO authenticated;
GRANT ALL ON public.agentes_ia TO service_role;