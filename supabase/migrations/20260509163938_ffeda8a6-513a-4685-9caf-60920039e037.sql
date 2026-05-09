-- Garantir que RLS está ativado
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informacoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Permitir leitura pública de integrações" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir leitura pública de informacoes" ON public.informacoes;
DROP POLICY IF EXISTS "Permitir leitura para o próprio usuário" ON public.usuarios;

-- Criar política para permitir que QUALQUER UM (incluindo não logados) busque um usuário pelo login
-- Isso é necessário para verificar se o número existe e pegar o nome/token antes de disparar o webhook
CREATE POLICY "Permitir busca pública de usuário por login" 
ON public.usuarios 
FOR SELECT 
USING (true);

-- Criar política para permitir que QUALQUER UM busque as configurações de integração
CREATE POLICY "Permitir leitura pública de integrações" 
ON public.integracoes 
FOR SELECT 
USING (true);

-- Criar política para permitir que QUALQUER UM busque as informações de contato
CREATE POLICY "Permitir leitura pública de informacoes" 
ON public.informacoes 
FOR SELECT 
USING (true);
