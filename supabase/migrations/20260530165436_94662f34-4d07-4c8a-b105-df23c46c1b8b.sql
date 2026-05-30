-- Recria as permissões de acesso (GRANTs) que parecem estar faltando
GRANT ALL ON public.integracoes TO authenticated;
GRANT SELECT ON public.integracoes TO anon;
GRANT ALL ON public.integracoes TO service_role;
GRANT ALL ON public.integracoes TO postgres;

-- Garante que o RLS está habilitado
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

-- Remove qualquer política residual
DROP POLICY IF EXISTS "integracoes_all_authenticated_policy" ON public.integracoes;
DROP POLICY IF EXISTS "integracoes_select_policy" ON public.integracoes;
DROP POLICY IF EXISTS "Acesso publico total leitura integracoes" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.integracoes;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON public.integracoes;

-- Cria políticas definitivas usando uma abordagem mais ampla
CREATE POLICY "public_select" ON public.integracoes FOR SELECT USING (true);
CREATE POLICY "authenticated_all" ON public.integracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.integracoes FOR ALL TO service_role USING (true) WITH CHECK (true);