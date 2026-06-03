ALTER TABLE public.promocao 
DROP COLUMN IF EXISTS prompt_texto,
DROP COLUMN IF EXISTS prompt_imagem,
DROP COLUMN IF EXISTS texto_ia;