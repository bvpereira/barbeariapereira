-- Drop old policy if exists
DROP POLICY IF EXISTS "Admins can do everything on integrations" ON public.integracoes;

-- Create a simplified policy for testing
CREATE POLICY "Allow management for all authenticated users" 
ON public.integracoes 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Also ensure the select policy doesn't conflict
DROP POLICY IF EXISTS "All authenticated users can view integrations" ON public.integracoes;
