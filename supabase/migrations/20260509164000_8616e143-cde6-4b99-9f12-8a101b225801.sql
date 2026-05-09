-- Criar política para permitir que QUALQUER UM atualize o recovery_token de um usuário
-- Isso é necessário para salvar o token temporário antes de disparar o webhook
CREATE POLICY "Permitir atualização pública de recovery_token" 
ON public.usuarios 
FOR UPDATE 
USING (true)
WITH CHECK (true);
