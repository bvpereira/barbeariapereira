ALTER TABLE public.informacoes ADD COLUMN IF NOT EXISTS envio_via TEXT;
ALTER TABLE public.superadmin ADD COLUMN IF NOT EXISTS envio_via TEXT;