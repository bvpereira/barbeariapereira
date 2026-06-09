-- 1. TABELA COMUNIDADE (Liberar para anon e authenticated)
ALTER TABLE public.comunidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insercao_comunidade_autenticado" ON public.comunidade;
DROP POLICY IF EXISTS "leitura_comunidade_autenticado" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir inserção comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir leitura comunidade" ON public.comunidade;

-- Permitir inserção para todos (anon e authenticated)
CREATE POLICY "comunidade_permitir_insercao_publica" ON public.comunidade
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Permitir leitura para todos
CREATE POLICY "comunidade_permitir_leitura_publica" ON public.comunidade
FOR SELECT TO anon, authenticated
USING (true);

-- Permitir deleção/atualização (precisa de verificação por autor_id ou admin)
CREATE POLICY "comunidade_permitir_gestao_publica" ON public.comunidade
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);


-- 2. STORAGE (BUCKET: comunidade_midia)
-- Como o usuário não está logado no Supabase Auth, precisamos permitir o papel 'anon'

DROP POLICY IF EXISTS "storage_leitura_publica" ON storage.objects;
DROP POLICY IF EXISTS "storage_upload_autenticado" ON storage.objects;
DROP POLICY IF EXISTS "storage_delecao_autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Permitir leitura pública
CREATE POLICY "storage_comunidade_leitura" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'comunidade_midia');

-- Permitir upload público
CREATE POLICY "storage_comunidade_upload" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'comunidade_midia');

-- Permitir deleção pública
CREATE POLICY "storage_comunidade_delecao" ON storage.objects
FOR DELETE TO anon, authenticated
USING (bucket_id = 'comunidade_midia');
