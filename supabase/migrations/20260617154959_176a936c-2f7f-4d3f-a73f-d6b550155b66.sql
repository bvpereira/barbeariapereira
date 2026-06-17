ALTER TABLE public.promocao
  ADD COLUMN IF NOT EXISTS num_promo_criadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_limite_promo integer,
  ADD COLUMN IF NOT EXISTS last_reset_month text;