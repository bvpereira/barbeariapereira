ALTER TABLE public.promocao ADD COLUMN testada TEXT DEFAULT 'nao';
UPDATE public.promocao SET testada = 'nao' WHERE testada IS NULL;