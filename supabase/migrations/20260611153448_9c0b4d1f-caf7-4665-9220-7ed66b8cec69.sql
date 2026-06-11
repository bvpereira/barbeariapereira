ALTER TABLE public.agentes_ia 
ADD COLUMN IF NOT EXISTS tom_comunicacao TEXT,
ADD COLUMN IF NOT EXISTS imagem_paleta TEXT,
ADD COLUMN IF NOT EXISTS imagem_elem_central TEXT;