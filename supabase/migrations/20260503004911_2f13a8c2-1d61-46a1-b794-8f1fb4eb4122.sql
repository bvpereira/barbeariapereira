-- Remover políticas existentes para o bucket informacoes_imagens
DROP POLICY IF EXISTS "Imagens informacoes são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para usuários autenticados" ON storage.objects;

-- Criar novas políticas de acesso total (públicas) para o bucket informacoes_imagens
CREATE POLICY "Acesso total público para informacoes_imagens - SELECT"
ON storage.objects FOR SELECT
USING (bucket_id = 'informacoes_imagens');

CREATE POLICY "Acesso total público para informacoes_imagens - INSERT"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'informacoes_imagens');

CREATE POLICY "Acesso total público para informacoes_imagens - UPDATE"
ON storage.objects FOR UPDATE
USING (bucket_id = 'informacoes_imagens')
WITH CHECK (bucket_id = 'informacoes_imagens');

CREATE POLICY "Acesso total público para informacoes_imagens - DELETE"
ON storage.objects FOR DELETE
USING (bucket_id = 'informacoes_imagens');