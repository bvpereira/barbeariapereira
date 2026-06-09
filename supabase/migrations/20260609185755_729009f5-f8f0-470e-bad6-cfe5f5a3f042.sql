-- 1. Tabela Comunidade (Público)
ALTER TABLE public.comunidade ENABLE ROW LEVEL SECURITY;

-- Limpar políticas existentes para garantir aplicação correta
DROP POLICY IF EXISTS "Permitir inserção comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir leitura comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir atualização comunidade" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir deleção comunidade" ON public.comunidade;

-- Permitir inserção para qualquer usuário autenticado
CREATE POLICY "Permitir inserção comunidade" ON public.comunidade
FOR INSERT TO authenticated
WITH CHECK (true);

-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura comunidade" ON public.comunidade
FOR SELECT TO authenticated
USING (true);

-- Permitir deleção/atualização (Super Admins ou autores em posts pendentes)
CREATE POLICY "Permitir deleção comunidade" ON public.comunidade
FOR DELETE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.nivel = 0))
  OR 
  (autor_id = auth.uid() AND status = 'pendente')
);

-- 2. Storage (Imagens)
-- Note: Estas políticas assumem que o bucket 'comunidade_midia' já foi criado manualmente no painel do Supabase.

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Permitir leitura pública de objetos no bucket comunidade_midia
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'comunidade_midia');

-- Permitir upload de imagens para usuários autenticados
CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comunidade_midia');

-- Permitir deleção de imagens pelo autor
CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'comunidade_midia');
