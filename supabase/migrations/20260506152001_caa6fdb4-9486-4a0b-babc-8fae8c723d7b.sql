-- Add 'tipo' column to 'integracoes' table
ALTER TABLE public.integracoes ADD COLUMN IF NOT EXISTS tipo TEXT;

-- Clear existing data to ensure correct setup as requested
TRUNCATE TABLE public.integracoes;

-- Insert the requested rows
INSERT INTO public.integracoes (tipo, webhook_url)
VALUES 
  ('atendimentos', '/integracoes'),
  ('promocao', '/promocao');