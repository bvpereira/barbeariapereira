-- Remove the global unique constraint on 'tipo'
ALTER TABLE public.integracoes DROP CONSTRAINT IF EXISTS integracoes_tipo_key;

-- Add a new unique constraint on (tipo, barbearia_id)
ALTER TABLE public.integracoes ADD CONSTRAINT integracoes_tipo_barbearia_id_key UNIQUE (tipo, barbearia_id);