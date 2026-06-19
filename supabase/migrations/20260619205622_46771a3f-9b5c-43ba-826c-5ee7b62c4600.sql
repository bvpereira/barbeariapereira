CREATE TABLE public.superadmin (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_principal_evo TEXT,
  instancia_principal_api TEXT,
  instancia_principal_numero TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.superadmin TO anon, authenticated;
GRANT ALL ON public.superadmin TO service_role;
ALTER TABLE public.superadmin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read superadmin" ON public.superadmin FOR SELECT USING (true);
CREATE POLICY "Public can insert superadmin" ON public.superadmin FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update superadmin" ON public.superadmin FOR UPDATE USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_superadmin_updated_at BEFORE UPDATE ON public.superadmin FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.superadmin (instancia_principal_evo, instancia_principal_api, instancia_principal_numero) VALUES (NULL, NULL, NULL);