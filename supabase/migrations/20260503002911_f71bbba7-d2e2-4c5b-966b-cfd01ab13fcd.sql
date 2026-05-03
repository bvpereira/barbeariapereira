-- Rename column usuarios_id to usuario_id if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'informacoes' AND column_name = 'usuarios_id') THEN
        ALTER TABLE public.informacoes RENAME COLUMN usuarios_id TO usuario_id;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'informacoes' AND column_name = 'usuario_id') THEN
        ALTER TABLE public.informacoes ADD COLUMN usuario_id UUID;
    END IF;
END $$;

-- Update the first row with the first user ID (assumed to be the admin)
DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM public.usuarios ORDER BY created_at ASC LIMIT 1;
    
    IF admin_id IS NOT NULL THEN
        UPDATE public.informacoes 
        SET usuario_id = admin_id 
        WHERE id = (SELECT id FROM public.informacoes LIMIT 1);
    END IF;
END $$;
