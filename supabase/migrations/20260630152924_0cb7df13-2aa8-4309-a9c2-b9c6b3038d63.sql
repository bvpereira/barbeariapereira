DROP POLICY IF EXISTS "estoque_all_authenticated" ON public.estoque;
DROP POLICY IF EXISTS "estoque_mov_all_authenticated" ON public.estoque_movimentos;

CREATE POLICY "estoque_all_public" ON public.estoque FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "estoque_mov_all_public" ON public.estoque_movimentos FOR ALL TO public USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentos TO anon;