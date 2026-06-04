ALTER TABLE public.agentes_ia ADD COLUMN IF NOT EXISTS imagem_referencia_ia TEXT;

-- We don't need to change permissions as the table already has RLS and grants
-- But let's ensure the user can update this new column
GRANT ALL ON public.agentes_ia TO authenticated;
GRANT ALL ON public.agentes_ia TO service_role;