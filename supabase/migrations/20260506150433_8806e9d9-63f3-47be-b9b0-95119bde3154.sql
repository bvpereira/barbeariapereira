INSERT INTO storage.buckets (id, name, public) 
VALUES ('promocoes', 'promocoes', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public access to promotion images
CREATE POLICY "Imagens de promoções são públicas" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'promocoes');

-- Policies for authenticated users to upload promotion images
CREATE POLICY "Usuários autenticados podem enviar imagens de promoções" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'promocoes' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar imagens de promoções" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'promocoes' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar imagens de promoções" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'promocoes' AND auth.role() = 'authenticated');