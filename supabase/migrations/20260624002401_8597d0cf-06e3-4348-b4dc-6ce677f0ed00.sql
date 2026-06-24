
CREATE TABLE IF NOT EXISTS public.cores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id UUID NOT NULL UNIQUE REFERENCES public.barbearias(id) ON DELETE CASCADE,
  preset TEXT NOT NULL DEFAULT 'custom',
  modo TEXT NOT NULL DEFAULT 'light',

  background TEXT, foreground TEXT,
  card TEXT, card_foreground TEXT,
  popover TEXT, popover_foreground TEXT,
  "primary" TEXT, primary_foreground TEXT,
  secondary TEXT, secondary_foreground TEXT,
  muted TEXT, muted_foreground TEXT,
  accent TEXT, accent_foreground TEXT,
  destructive TEXT, destructive_foreground TEXT,
  border TEXT, input TEXT, ring TEXT,
  titulo TEXT, subtitulo TEXT,
  sidebar TEXT, sidebar_foreground TEXT,
  sidebar_primary TEXT, sidebar_primary_foreground TEXT,
  sidebar_accent TEXT, sidebar_accent_foreground TEXT,
  sidebar_border TEXT, sidebar_ring TEXT,

  dark_background TEXT, dark_foreground TEXT,
  dark_card TEXT, dark_card_foreground TEXT,
  dark_popover TEXT, dark_popover_foreground TEXT,
  dark_primary TEXT, dark_primary_foreground TEXT,
  dark_secondary TEXT, dark_secondary_foreground TEXT,
  dark_muted TEXT, dark_muted_foreground TEXT,
  dark_accent TEXT, dark_accent_foreground TEXT,
  dark_destructive TEXT, dark_destructive_foreground TEXT,
  dark_border TEXT, dark_input TEXT, dark_ring TEXT,
  dark_titulo TEXT, dark_subtitulo TEXT,
  dark_sidebar TEXT, dark_sidebar_foreground TEXT,
  dark_sidebar_primary TEXT, dark_sidebar_primary_foreground TEXT,
  dark_sidebar_accent TEXT, dark_sidebar_accent_foreground TEXT,
  dark_sidebar_border TEXT, dark_sidebar_ring TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cores TO authenticated;
GRANT ALL ON public.cores TO service_role;

ALTER TABLE public.cores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cores_select_all" ON public.cores;
CREATE POLICY "cores_select_all" ON public.cores
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cores_insert_auth" ON public.cores;
CREATE POLICY "cores_insert_auth" ON public.cores
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cores_update_auth" ON public.cores;
CREATE POLICY "cores_update_auth" ON public.cores
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_cores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_cores_updated_at ON public.cores;
CREATE TRIGGER trg_cores_updated_at
  BEFORE UPDATE ON public.cores
  FOR EACH ROW EXECUTE FUNCTION public.update_cores_updated_at();
