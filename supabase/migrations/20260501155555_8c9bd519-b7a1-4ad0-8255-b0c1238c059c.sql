ALTER TABLE public.horarios_colaboradores ADD COLUMN ativo BOOLEAN DEFAULT true;

-- Update RLS if needed (usually not needed if already allowed for all columns)
-- But let's check existing policies just in case.