ALTER TABLE public.informacoes ADD COLUMN email TEXT;
UPDATE public.informacoes SET email = 'bvpereira@gmail.com' WHERE email IS NULL;