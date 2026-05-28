-- Drop existing policies for agentes_ia to start fresh
DROP POLICY IF EXISTS "Allow public read access to agentes_ia" ON public.agentes_ia;
DROP POLICY IF EXISTS "Allow authenticated to select agentes_ia" ON public.agentes_ia;

-- Create policies for public access (Read and Update)
CREATE POLICY "Enable read access for all users" ON public.agentes_ia
FOR SELECT USING (true);

CREATE POLICY "Enable update access for all users" ON public.agentes_ia
FOR UPDATE USING (true);

-- Ensure grants are correct
GRANT SELECT, UPDATE ON public.agentes_ia TO anon, authenticated;
GRANT ALL ON public.agentes_ia TO service_role;
