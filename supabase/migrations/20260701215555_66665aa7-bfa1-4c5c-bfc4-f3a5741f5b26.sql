DROP POLICY IF EXISTS atend_produtos_all_authenticated ON public.atendimento_produtos;
CREATE POLICY "Acesso total atendimento_produtos" ON public.atendimento_produtos FOR ALL TO public USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimento_produtos TO anon;