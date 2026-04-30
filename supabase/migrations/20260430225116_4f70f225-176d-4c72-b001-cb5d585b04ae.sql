-- Drop existing strict policies
DROP POLICY IF EXISTS "Authenticated users can manage servicos" ON public.servicos;
DROP POLICY IF EXISTS "Authenticated users can manage services" ON public.servicos;

-- Create more permissive policy for management (using true for testing purposes)
CREATE POLICY "Enable all operations for all users" 
ON public.servicos FOR ALL 
USING (true)
WITH CHECK (true);

-- Drop existing storage policies
DROP POLICY IF EXISTS "Authenticated users can upload service images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update service images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete service images" ON storage.objects;

-- Create permissive storage policies
CREATE POLICY "Public upload access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-images');

CREATE POLICY "Public update access"
ON storage.objects FOR UPDATE
USING (bucket_id = 'service-images');

CREATE POLICY "Public delete access"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-images');