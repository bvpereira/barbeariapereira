
ALTER TABLE public.cores ADD COLUMN IF NOT EXISTS nome_perfil TEXT NOT NULL DEFAULT 'Perfil 1';
ALTER TABLE public.cores ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT false;

UPDATE public.cores SET ativo = true WHERE ativo = false;

ALTER TABLE public.cores DROP CONSTRAINT IF EXISTS cores_barbearia_id_key;
ALTER TABLE public.cores DROP CONSTRAINT IF EXISTS cores_barbearia_nome_perfil_key;
ALTER TABLE public.cores ADD CONSTRAINT cores_barbearia_nome_perfil_key UNIQUE (barbearia_id, nome_perfil);

CREATE UNIQUE INDEX IF NOT EXISTS cores_barbearia_ativo_unico
  ON public.cores (barbearia_id) WHERE ativo = true;

DO $$
DECLARE
  r RECORD;
  cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='cores'
    AND column_name NOT IN ('id','barbearia_id','nome_perfil','ativo','created_at','updated_at');

  FOR r IN
    SELECT id, barbearia_id FROM public.cores c1
    WHERE nome_perfil = 'Perfil 1'
      AND NOT EXISTS (SELECT 1 FROM public.cores c2 WHERE c2.barbearia_id = c1.barbearia_id AND c2.nome_perfil = 'Perfil 2')
  LOOP
    EXECUTE format(
      'INSERT INTO public.cores (barbearia_id, nome_perfil, ativo, %s) SELECT barbearia_id, ''Perfil 2'', false, %s FROM public.cores WHERE id = %L',
      cols, cols, r.id
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_perfil_cores_ativo(_perfil_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barbearia uuid;
BEGIN
  SELECT barbearia_id INTO v_barbearia FROM public.cores WHERE id = _perfil_id;
  IF v_barbearia IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  UPDATE public.cores SET ativo = false WHERE barbearia_id = v_barbearia AND id <> _perfil_id AND ativo = true;
  UPDATE public.cores SET ativo = true WHERE id = _perfil_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_perfil_cores_ativo(uuid) TO authenticated, anon, service_role;
