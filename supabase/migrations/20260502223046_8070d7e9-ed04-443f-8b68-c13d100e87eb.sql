-- Remover a restrição antiga
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_nivel_check;

-- Adicionar a nova restrição permitindo o nível 10
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_nivel_check CHECK (nivel IN (1, 2, 3, 10));
