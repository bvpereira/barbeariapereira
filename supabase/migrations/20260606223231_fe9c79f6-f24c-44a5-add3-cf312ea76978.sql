-- Adicionar colunas para imagens extras em servicos
ALTER TABLE public.servicos 
ADD COLUMN image_url_2 TEXT,
ADD COLUMN image_url_3 TEXT,
ADD COLUMN image_url_4 TEXT,
ADD COLUMN image_url_5 TEXT;

-- Adicionar colunas para imagens extras em colaboradores
ALTER TABLE public.colaboradores 
ADD COLUMN foto_url_2 TEXT,
ADD COLUMN foto_url_3 TEXT,
ADD COLUMN foto_url_4 TEXT,
ADD COLUMN foto_url_5 TEXT,
ADD COLUMN foto_url_6 TEXT,
ADD COLUMN foto_url_7 TEXT;
