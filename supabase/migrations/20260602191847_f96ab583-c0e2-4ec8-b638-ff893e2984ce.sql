-- Inserir a nova barbearia
INSERT INTO public.barbearias (nome, slug, config)
VALUES ('Barbearia Pereira (Unidade 2)', 'barb1', '{}'::jsonb);

-- Obter o ID da barbearia recém-criada e inserir o usuário administrador
-- Usando uma subquery para garantir o vínculo correto
INSERT INTO public.usuarios (nome, login, senha, nivel, barbearia_id, registro)
SELECT 
  'Administrador Barb1', 
  '00000000000', 
  '123456', 
  1, 
  id,
  'sim'
FROM public.barbearias 
WHERE slug = 'barb1'
LIMIT 1;
