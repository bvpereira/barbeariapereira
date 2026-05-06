ALTER TABLE public.usuarios ADD COLUMN promocao TEXT DEFAULT 'sim';
UPDATE public.usuarios SET promocao = 'sim' WHERE promocao IS NULL;