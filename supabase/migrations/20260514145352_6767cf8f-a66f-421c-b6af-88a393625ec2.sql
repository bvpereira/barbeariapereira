CREATE POLICY "Acesso publico total update informacoes" 
ON public.informacoes 
FOR UPDATE 
USING (true)
WITH CHECK (true);