-- Remover políticas restritivas da tabela promocao
DROP POLICY IF EXISTS "Promoções são visíveis por todos" ON public.promocao;
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar promoções" ON public.promocao;

-- Criar política de acesso total para a tabela promocao
CREATE POLICY "Acesso total público para promocao"
ON public.promocao
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Remover políticas restritivas do storage para o bucket promocoes
DROP POLICY IF EXISTS "Imagens de promoções são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem enviar imagens de promoções" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar imagens de promoções" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar imagens de promoções" ON storage.objects;

-- Criar políticas públicas para o bucket promocoes
CREATE POLICY "Acesso de leitura público para promocoes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'promocoes');

CREATE POLICY "Acesso de inserção público para promocoes"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'promocoes');

CREATE POLICY "Acesso de atualização público para promocoes"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'promocoes')
WITH CHECK (bucket_id = 'promocoes');

CREATE POLICY "Acesso de deleção público para promocoes"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'promocoes');