-- Add new columns to agentes_ia
ALTER TABLE public.agentes_ia 
ADD COLUMN IF NOT EXISTS imagem_objetivo TEXT,
ADD COLUMN IF NOT EXISTS imagem_campanha TEXT,
ADD COLUMN IF NOT EXISTS imagem_estilovisual TEXT,
ADD COLUMN IF NOT EXISTS imagem_informacoes TEXT,
ADD COLUMN IF NOT EXISTS imagem_imareferencia TEXT,
ADD COLUMN IF NOT EXISTS imagem_comlogo TEXT;

-- Seed data for Teste 1 (linha 1)
UPDATE public.agentes_ia 
SET 
  imagem_objetivo = 'Teste 1',
  imagem_campanha = 'Teste 1',
  imagem_estilovisual = 'Teste 1',
  imagem_informacoes = 'Teste 1',
  imagem_imareferencia = 'Teste 1',
  imagem_comlogo = 'Teste 1'
WHERE linha = 1;

-- Seed data for Teste 2 (linha 2)
UPDATE public.agentes_ia 
SET 
  imagem_objetivo = 'Teste 2',
  imagem_campanha = 'Teste 2',
  imagem_estilovisual = 'Teste 2',
  imagem_informacoes = 'Teste 2',
  imagem_imareferencia = 'Teste 2',
  imagem_comlogo = 'Teste 2'
WHERE linha = 2;

-- Seed data for Teste 3 (linha 3)
UPDATE public.agentes_ia 
SET 
  imagem_objetivo = 'Teste 3',
  imagem_campanha = 'Teste 3',
  imagem_estilovisual = 'Teste 3',
  imagem_informacoes = 'Teste 3',
  imagem_imareferencia = 'Teste 3',
  imagem_comlogo = 'Teste 3'
WHERE linha = 3;
