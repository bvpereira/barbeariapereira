-- Tentar novamente liberar a tabela blog de forma robusta
DROP POLICY IF EXISTS "Qualquer um pode gerenciar blog" ON public.blog;
DROP POLICY IF EXISTS "Acesso total blog" ON public.blog;

CREATE POLICY "Acesso irrestrito blog" ON public.blog FOR ALL USING (true) WITH CHECK (true);

-- Garantir GRANTs
GRANT ALL ON public.blog TO anon, authenticated, service_role;
