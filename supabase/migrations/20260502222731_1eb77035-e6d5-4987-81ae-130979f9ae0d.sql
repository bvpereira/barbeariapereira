-- Atualizar a política de inserção para permitir o nível 10
DROP POLICY IF EXISTS "Permitir inserção de colaboradores e clientes" ON public.usuarios;
CREATE POLICY "Permitir inserção de colaboradores e clientes" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (nivel IN (2, 3, 10));

-- Adicionar um check constraint para garantir que o nível 10 não consiga realizar certas ações se necessário, 
-- ou simplesmente garantir que a política de UPDATE também permita o nível 10.
-- A política de UPDATE atual já possui "qual: ((auth.uid() = id) OR true)", o que é bem permissivo.

-- Nota: O bloqueio de login propriamente dito geralmente é feito na lógica de autenticação 
-- comparando o nível do usuário após o retorno do banco.
