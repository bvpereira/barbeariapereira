-- Drop existing restrictive policies for informacoes_imagens
DROP POLICY IF EXISTS "Usuários podem fazer upload de suas próprias imagens" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias imagens" ON storage.objects;

-- Create more permissive policies for the custom auth system
-- Since we are using a custom 'usuarios' table and the user_id in 'informacoes' refers to that,
-- and storage.foldername(name) expects a Supabase Auth UUID which might not match or be present,
-- we'll allow authenticated uploads to this specific bucket.

CREATE POLICY "Permitir upload para usuários autenticados"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'informacoes_imagens');

CREATE POLICY "Permitir exclusão para usuários autenticados"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'informacoes_imagens');

CREATE POLICY "Permitir atualização para usuários autenticados"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'informacoes_imagens');
