ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_nivel_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_nivel_check CHECK (nivel IN (0, 1, 2, 3, 10));

ALTER TABLE public.usuarios ALTER COLUMN barbearia_id DROP NOT NULL;

INSERT INTO public.usuarios (id, nome, login, senha, nivel) 
VALUES (gen_random_uuid(), 'Super Admin', '00000000011', '123456', 0);