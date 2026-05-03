-- Remover política existente
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados na tabela informacoes" ON public.informacoes;

-- Criar política mais abrangente para evitar erros de RLS
CREATE POLICY "Acesso total para todos na tabela informacoes"
ON public.informacoes
FOR ALL
USING (true)
WITH CHECK (true);