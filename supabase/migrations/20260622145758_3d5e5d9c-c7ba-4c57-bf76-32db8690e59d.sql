ALTER TABLE public.promocao 
  ADD COLUMN IF NOT EXISTS texto_promo_ia_1 text,
  ADD COLUMN IF NOT EXISTS texto_enviar_1 text,
  ADD COLUMN IF NOT EXISTS texto_enviar_2 text,
  ADD COLUMN IF NOT EXISTS texto_enviar_3 text;