-- Remover política restritiva anterior
DROP POLICY IF EXISTS "Permitir inserção pública para cadastro de clientes" ON public.usuarios;

-- Criar nova política que permite inserção de colaboradores (nivel 2) e clientes (nivel 3)
CREATE POLICY "Permitir inserção de colaboradores e clientes" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (nivel IN (2, 3));

-- Garantir que a política de update também cubra os colaboradores se necessário
-- (Já existe uma política "Usuários podem atualizar seus próprios dados" com qual: true ou uid check)
