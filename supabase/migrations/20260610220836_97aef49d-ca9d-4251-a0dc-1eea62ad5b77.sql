ALTER TABLE public.agentes_ia 
ADD COLUMN IF NOT EXISTS texto_endereco TEXT,
ADD COLUMN IF NOT EXISTS texto_instagram TEXT,
ADD COLUMN IF NOT EXISTS texto_telcontato TEXT,
ADD COLUMN IF NOT EXISTS imagem_endereco TEXT,
ADD COLUMN IF NOT EXISTS imagem_instagram TEXT,
ADD COLUMN IF NOT EXISTS imagem_telcontato TEXT;