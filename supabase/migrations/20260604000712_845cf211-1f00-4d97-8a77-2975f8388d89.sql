ALTER TABLE public.promocao ADD COLUMN texto_promo_auxiliar TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promocao TO authenticated;
GRANT ALL ON public.promocao TO service_role;