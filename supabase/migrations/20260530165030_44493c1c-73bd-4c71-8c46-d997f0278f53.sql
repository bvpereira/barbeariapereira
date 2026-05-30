-- Remove a política antiga que estava causando problemas de ambiguidade no WITH CHECK
DROP POLICY IF EXISTS "Permitir atualização para admins logados" ON public.integracoes;

-- Cria políticas explícitas para SELECT, INSERT, UPDATE e DELETE para usuários autenticados
CREATE POLICY "Permitir leitura para todos" 
ON public.integracoes FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" 
ON public.integracoes FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização para usuários autenticados" 
ON public.integracoes FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir exclusão para usuários autenticados" 
ON public.integracoes FOR DELETE 
TO authenticated 
USING (true);