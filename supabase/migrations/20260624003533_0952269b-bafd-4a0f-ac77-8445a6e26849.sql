
DROP POLICY IF EXISTS cores_insert_auth ON public.cores;
DROP POLICY IF EXISTS cores_update_auth ON public.cores;

CREATE POLICY cores_insert_all ON public.cores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY cores_update_all ON public.cores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.cores TO anon, authenticated;
GRANT ALL ON public.cores TO service_role;
