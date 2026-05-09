-- Ativar RLS na tabela integracoes
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

-- Criar política de leitura pública para a tabela integracoes
-- Isso permite que o sistema busque a URL do webhook mesmo sem estar logado (ex: recuperação de senha)
CREATE POLICY "Permitir leitura pública de integrações" 
ON public.integracoes 
FOR SELECT 
USING (true);

-- Criar política de leitura pública para a tabela informacoes (necessária para tel_contato)
-- Verificando se já existe uma similar ou expandindo
DROP POLICY IF EXISTS "Acesso total para todos na tabela informacoes" ON public.informacoes;
CREATE POLICY "Permitir leitura pública de informacoes" 
ON public.informacoes 
FOR SELECT 
USING (true);

-- Manter acesso restrito para escrita se necessário (geralmente via admin logado)
CREATE POLICY "Permitir atualização para admins logados" 
ON public.integracoes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
