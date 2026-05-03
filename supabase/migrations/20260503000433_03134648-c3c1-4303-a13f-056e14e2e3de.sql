-- Add image columns to informacoes table
ALTER TABLE public.informacoes 
ADD COLUMN IF NOT EXISTS imagem_1 TEXT,
ADD COLUMN IF NOT EXISTS imagem_2 TEXT,
ADD COLUMN IF NOT EXISTS imagem_3 TEXT,
ADD COLUMN IF NOT EXISTS imagem_4 TEXT,
ADD COLUMN IF NOT EXISTS imagem_5 TEXT,
ADD COLUMN IF NOT EXISTS imagem_6 TEXT,
ADD COLUMN IF NOT EXISTS imagem_7 TEXT,
ADD COLUMN IF NOT EXISTS imagem_8 TEXT;

-- Create storage bucket for images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('informacoes_imagens', 'informacoes_imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
CREATE POLICY "Imagens informacoes são públicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'informacoes_imagens');

CREATE POLICY "Usuários podem fazer upload de suas próprias imagens" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'informacoes_imagens' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem deletar suas próprias imagens" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'informacoes_imagens' AND auth.uid()::text = (storage.foldername(name))[1]);