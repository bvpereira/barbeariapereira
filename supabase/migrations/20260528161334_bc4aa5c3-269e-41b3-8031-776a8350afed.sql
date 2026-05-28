ALTER TABLE public.promocao ADD COLUMN IF NOT EXISTS texto_ia TEXT;

UPDATE public.promocao 
SET texto_ia = 'teste teste teste' 
WHERE numero_promo = 0;