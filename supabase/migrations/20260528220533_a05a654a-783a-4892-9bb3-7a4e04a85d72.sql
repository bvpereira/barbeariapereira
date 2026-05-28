-- Drop existing policy if it exists and recreate it to be explicitly public
DROP POLICY IF EXISTS "Allow authenticated to select agentes_ia" ON public.agentes_ia;

CREATE POLICY "Allow public read access to agentes_ia"
ON public.agentes_ia
FOR SELECT
TO public
USING (true);

-- Ensure anon has grant
GRANT SELECT ON public.agentes_ia TO anon;