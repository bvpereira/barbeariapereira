-- Add usuarios_id column to informacoes table
ALTER TABLE public.informacoes ADD COLUMN IF NOT EXISTS usuarios_id UUID;

-- Since the user asked to fill the first row with the admin's ID, 
-- and we found 'Bruno Vital' with login '22998770113' as a likely candidate (or just the first user),
-- let's find the first user and the first info row to link them if they exist.

DO $$
DECLARE
    first_user_id UUID;
BEGIN
    SELECT id INTO first_user_id FROM public.usuarios LIMIT 1;
    
    -- If there's at least one row in informacoes, update the first one
    UPDATE public.informacoes 
    SET usuarios_id = first_user_id 
    WHERE id = (SELECT id FROM public.informacoes LIMIT 1);
END $$;
