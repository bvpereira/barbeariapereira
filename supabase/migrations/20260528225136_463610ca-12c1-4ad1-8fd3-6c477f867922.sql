-- Add the 'linha' column
ALTER TABLE public.agentes_ia ADD COLUMN linha INTEGER;

-- Update existing rows with a sequence starting from 1
WITH updated AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as row_num
  FROM public.agentes_ia
)
UPDATE public.agentes_ia
SET linha = updated.row_num
FROM updated
WHERE public.agentes_ia.id = updated.id;

-- Insert the fixed row with value 0
INSERT INTO public.agentes_ia (linha, imagem_formato)
VALUES (0, '');

-- Update Grant
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentes_ia TO authenticated;
GRANT SELECT ON public.agentes_ia TO anon;
GRANT ALL ON public.agentes_ia TO service_role;
