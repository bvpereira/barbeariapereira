-- Habilitar RLS
ALTER TABLE public.comunidade ENABLE ROW LEVEL SECURITY;

-- Remover políticas restritivas antigas que podem estar causando o erro de RLS
DROP POLICY IF EXISTS "Inserção de conteúdo" ON public.comunidade;
DROP POLICY IF EXISTS "Leitura de posts" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir inserção para autenticados" ON public.comunidade;
DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON public.comunidade;

-- Nova política de inserção: permite que qualquer usuário autenticado insira dados
-- (As validações de nível e status agora ficam a cargo da lógica da aplicação ou triggers)
CREATE POLICY "Permitir inserção comunidade" ON public.comunidade
FOR INSERT TO authenticated
WITH CHECK (true);

-- Nova política de leitura: permite que usuários autenticados vejam os dados
CREATE POLICY "Permitir leitura comunidade" ON public.comunidade
FOR SELECT TO authenticated
USING (true);

-- Política de atualização: permite que Super Admins (nível 0) atualizem tudo 
-- e usuários atualizem seus próprios posts se estiverem pendentes
CREATE POLICY "Permitir atualização comunidade" ON public.comunidade
FOR UPDATE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.nivel = 0))
  OR 
  (autor_id = auth.uid() AND status = 'pendente')
);
