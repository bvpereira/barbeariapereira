-- Desativar RLS temporariamente para garantir acesso total
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.informacoes DISABLE ROW LEVEL SECURITY;

-- Recriar políticas de forma extremamente permissiva para garantir o funcionamento
DROP POLICY IF EXISTS "Permitir busca pública de usuário por login" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura pública de integrações" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir leitura pública de informacoes" ON public.informacoes;
DROP POLICY IF EXISTS "Permitir atualização pública de recovery_token" ON public.usuarios;

-- Reativar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informacoes ENABLE ROW LEVEL SECURITY;

-- Criar política de leitura TOTALMENTE ABERTA para as 3 tabelas
CREATE POLICY "Acesso publico total leitura usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Acesso publico total leitura integracoes" ON public.integracoes FOR SELECT USING (true);
CREATE POLICY "Acesso publico total leitura informacoes" ON public.informacoes FOR SELECT USING (true);

-- Criar política de atualização TOTALMENTE ABERTA para usuarios (necessário para o token)
CREATE POLICY "Acesso publico total update usuarios" ON public.usuarios FOR UPDATE USING (true) WITH CHECK (true);
