-- Add prompt_texto and prompt_imagem columns to promocao table
ALTER TABLE public.promocao 
ADD COLUMN prompt_texto TEXT,
ADD COLUMN prompt_imagem TEXT;