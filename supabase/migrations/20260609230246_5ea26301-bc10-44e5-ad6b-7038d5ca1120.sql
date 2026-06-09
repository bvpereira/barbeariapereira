-- Políticas de Storage para o bucket 'blog_midia' na tabela storage.objects
-- Nota: Não tentamos criar o bucket aqui para evitar bloqueios de SQL.

CREATE POLICY "blog_midia_read" ON storage.objects FOR SELECT USING (bucket_id = 'blog_midia');
CREATE POLICY "blog_midia_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'blog_midia');
CREATE POLICY "blog_midia_update" ON storage.objects FOR UPDATE USING (bucket_id = 'blog_midia') WITH CHECK (bucket_id = 'blog_midia');
CREATE POLICY "blog_midia_delete" ON storage.objects FOR DELETE USING (bucket_id = 'blog_midia');
