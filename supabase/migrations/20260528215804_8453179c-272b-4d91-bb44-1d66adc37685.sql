-- Create the agentes_ia table
CREATE TABLE public.agentes_ia (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    imagem_formato TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentes_ia TO authenticated;
GRANT ALL ON public.agentes_ia TO service_role;

-- Enable RLS
ALTER TABLE public.agentes_ia ENABLE ROW LEVEL SECURITY;

-- Create basic policies (allowing authenticated users to read)
CREATE POLICY "Allow authenticated to select agentes_ia" ON public.agentes_ia FOR SELECT TO authenticated USING (true);

-- Insert test data
INSERT INTO public.agentes_ia (imagem_formato) VALUES ('teste 1'), ('teste 2'), ('teste 3');

-- Create trigger for updated_at
CREATE TRIGGER update_agentes_ia_updated_at
BEFORE UPDATE ON public.agentes_ia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();