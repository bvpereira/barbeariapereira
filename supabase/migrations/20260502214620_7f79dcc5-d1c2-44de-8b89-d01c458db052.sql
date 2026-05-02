-- Adicionar política de exclusão para a tabela usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir exclusão para todos os usuários" 
ON public.usuarios 
FOR DELETE 
USING (true);
