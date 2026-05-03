-- Adiciona a coluna registro se não existir
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS registro TEXT DEFAULT 'nao' CHECK (registro IN ('sim', 'nao'));

-- Atualiza usuários existentes que podem estar nulos
UPDATE public.usuarios SET registro = 'nao' WHERE registro IS NULL;

-- Garante que o valor padrão seja 'nao' para novos registros
ALTER TABLE public.usuarios ALTER COLUMN registro SET DEFAULT 'nao';