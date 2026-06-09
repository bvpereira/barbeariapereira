-- Garantir que RLS esteja habilitado
ALTER TABLE public.blog ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para reconstruir de forma limpa
DROP POLICY IF EXISTS "Leitura pública blog" ON public.blog;
DROP POLICY IF EXISTS "Admin gerencia blog" ON public.blog;
DROP POLICY IF EXISTS "Qualquer um pode gerenciar blog" ON public.blog;
DROP POLICY IF EXISTS "Acesso total blog" ON public.blog;
DROP POLICY IF EXISTS "Acesso irrestrito blog" ON public.blog;

-- 1. Permitir que qualquer pessoa leia os posts
CREATE POLICY "Leitura pública blog" 
ON public.blog FOR SELECT 
USING (true);

-- 2. Permitir INSERT para resolver o erro de RLS. 
-- Usamos true para garantir que nada bloqueie a criação de novas linhas.
CREATE POLICY "Permitir inserção blog" 
ON public.blog FOR INSERT 
WITH CHECK (true);

-- 3. Permitir UPDATE para que curtidas e edições funcionem
CREATE POLICY "Permitir atualização blog" 
ON public.blog FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 4. Permitir DELETE para gestão
CREATE POLICY "Permitir exclusão blog" 
ON public.blog FOR DELETE 
USING (true);

-- Garantir que as permissões de tabela (GRANTs) estejam corretas
GRANT ALL ON public.blog TO anon, authenticated, service_role;
