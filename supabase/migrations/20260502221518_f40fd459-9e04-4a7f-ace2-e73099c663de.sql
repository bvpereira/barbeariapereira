-- Sincronizar níveis de acesso dos colaboradores ativos
UPDATE public.usuarios u
SET nivel = 2
FROM public.colaboradores c
WHERE u.login = c.login
AND c.ativo = true
AND u.nivel != 2;

-- Opcionalmente desativar acesso de colaboradores inativos (ajustar nível conforme necessário, ex: 3)
UPDATE public.usuarios u
SET nivel = 3
FROM public.colaboradores c
WHERE u.login = c.login
AND c.ativo = false
AND u.nivel = 2;