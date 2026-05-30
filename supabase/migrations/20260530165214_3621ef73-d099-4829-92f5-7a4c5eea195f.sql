-- Remove todas as políticas existentes para limpar o estado
DROP POLICY IF EXISTS "Acesso publico total leitura integracoes" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.integracoes;

-- Garante que o RLS está ativado
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

-- Política simples: Todos podem ver
CREATE POLICY "integracoes_select_policy" 
ON public.integracoes FOR SELECT 
USING (true);

-- Política simples: Autenticados podem fazer tudo (INSERT, UPDATE, DELETE)
-- Usamos ALL para simplificar e garantir que UPSERT funcione sem problemas de permissão cruzada
CREATE POLICY "integracoes_all_authenticated_policy" 
ON public.integracoes FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Garante permissões de acesso ao nível de role
GRANT ALL ON public.integracoes TO authenticated;
GRANT SELECT ON public.integracoes TO anon;
GRANT ALL ON public.integracoes TO service_role;