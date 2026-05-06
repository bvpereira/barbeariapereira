CREATE TABLE public.promocao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_promo INTEGER NOT NULL,
  imagem_promo TEXT,
  texto_promo TEXT,
  data_promo TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.promocao ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Promoções são visíveis por todos" 
ON public.promocao 
FOR SELECT 
USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar promoções" 
ON public.promocao 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Insert initial row (current promotion)
INSERT INTO public.promocao (numero_promo) VALUES (0);