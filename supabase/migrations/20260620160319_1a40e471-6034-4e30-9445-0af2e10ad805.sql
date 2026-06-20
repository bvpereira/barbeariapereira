ALTER TABLE public.informacoes RENAME COLUMN userrr TO nome_admin;

UPDATE public.informacoes i
SET nome_admin = u.nome
FROM public.usuarios u
WHERE u.barbearia_id = i.barbearia_id AND u.nivel = 1;