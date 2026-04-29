CREATE TABLE public.teste (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nomes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública da tabela teste"
ON public.teste
FOR SELECT
USING (true);

INSERT INTO public.teste (nomes) VALUES
  ('Ana Silva'),
  ('Bruno Costa'),
  ('Carla Mendes'),
  ('Diego Almeida'),
  ('Eduarda Lima');