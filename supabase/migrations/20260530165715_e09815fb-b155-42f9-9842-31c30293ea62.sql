-- Desabilita temporariamente o RLS para permitir que o usuário trabalhe enquanto investigamos
ALTER TABLE public.integracoes DISABLE ROW LEVEL SECURITY;

-- Garante permissões básicas
GRANT ALL ON public.integracoes TO anon;
GRANT ALL ON public.integracoes TO authenticated;
GRANT ALL ON public.integracoes TO service_role;