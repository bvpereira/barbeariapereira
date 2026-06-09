-- 1. CONFIGURAÇÃO DA TABELA COMUNIDADE
-- Garantir que RLS está habilitado
ALTER TABLE public.comunidade ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Permitir inserção comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir leitura comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir deleção comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Deleção de conteúdo" ON public.comunidade;
DROP POLICY IF EXISTS "Atualização de conteúdo" ON public.comunidade;
DROP POLICY IF EXISTS "Leitura de posts" ON public.comunidade;
DROP POLICY IF EXISTS "Inserção de conteúdo" ON public.comunidade;

-- Criar política de inserção para qualquer usuário autenticado
CREATE POLICY "insercao_comunidade_autenticado" ON public.comunidade
FOR INSERT TO authenticated
WITH CHECK (true);

-- Criar política de leitura para qualquer usuário autenticado
CREATE POLICY "leitura_comunidade_autenticado" ON public.comunidade
FOR SELECT TO authenticated
USING (true);

-- Criar política de exclusão (Super Admin ou Autor se pendente)
CREATE POLICY "delecao_comunidade_autenticado" ON public.comunidade
FOR DELETE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM public.usuarios WHERE usuarios.id = auth.uid() AND usuarios.nivel = 0))
  OR 
  (autor_id = auth.uid() AND status = 'pendente')
);

-- Criar política de atualização (Super Admin ou Aprovação)
CREATE POLICY "atualizacao_comunidade_autenticado" ON public.comunidade
FOR UPDATE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM public.usuarios WHERE usuarios.id = auth.uid() AND usuarios.nivel = 0))
  OR 
  (autor_id = auth.uid() AND status = 'pendente')
);


-- 2. CONFIGURAÇÃO DO STORAGE (BUCKET: comunidade_midia)
-- Nota: O bucket deve ser criado manualmente no painel como 'public'

-- Remover políticas de storage existentes para o bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
END $$;

-- Permitir que qualquer pessoa veja as imagens (bucket público)
CREATE POLICY "storage_leitura_publica" ON storage.objects
FOR SELECT USING (bucket_id = 'comunidade_midia');

-- Permitir que usuários autenticados façam upload
CREATE POLICY "storage_upload_autenticado" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comunidade_midia');

-- Permitir que usuários autenticados deletem objetos do bucket
CREATE POLICY "storage_delecao_autenticado" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'comunidade_midia');
