CREATE POLICY "Deleção de conteúdo" ON public.comunidade FOR DELETE TO authenticated 
USING (
  (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.nivel = 0)) -- Super Admin
  OR 
  (autor_id = auth.uid() AND status = 'pendente') -- Autor se estiver pendente
);
