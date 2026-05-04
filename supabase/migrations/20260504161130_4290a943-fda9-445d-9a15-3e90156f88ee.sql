-- Drop old policy if exists
DROP POLICY IF EXISTS "Admins can do everything on integrations" ON public.integracoes;

-- Create a more robust policy for Level 1 users
CREATE POLICY "Admins can do everything on integrations" 
ON public.integracoes 
FOR ALL 
TO authenticated
USING (
    (SELECT nivel FROM usuarios WHERE id = auth.uid()) = 1
)
WITH CHECK (
    (SELECT nivel FROM usuarios WHERE id = auth.uid()) = 1
);

-- Ensure RLS is enabled
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;