-- Create colaboradores table
CREATE TABLE public.colaboradores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    resumo TEXT,
    login TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    salario_fixo DECIMAL(10, 2) DEFAULT 0,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for services
CREATE TABLE public.colaborador_servicos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE NOT NULL,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE NOT NULL,
    tipo_comissao TEXT CHECK (tipo_comissao IN ('fixo', 'percentual')) NOT NULL,
    valor_comissao DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_servicos ENABLE ROW LEVEL SECURITY;

-- Simple public policies for now
CREATE POLICY "Public select colaboradores" ON public.colaboradores FOR SELECT USING (true);
CREATE POLICY "Public insert colaboradores" ON public.colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update colaboradores" ON public.colaboradores FOR UPDATE USING (true);
CREATE POLICY "Public delete colaboradores" ON public.colaboradores FOR DELETE USING (true);

CREATE POLICY "Public select colaborador_servicos" ON public.colaborador_servicos FOR SELECT USING (true);
CREATE POLICY "Public insert colaborador_servicos" ON public.colaborador_servicos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update colaborador_servicos" ON public.colaborador_servicos FOR UPDATE USING (true);
CREATE POLICY "Public delete colaborador_servicos" ON public.colaborador_servicos FOR DELETE USING (true);

-- Create storage bucket for collaborator images
INSERT INTO storage.buckets (id, name, public) VALUES ('collaborator-images', 'collaborator-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies with unique names
CREATE POLICY "Public select collaborator images" ON storage.objects FOR SELECT USING (bucket_id = 'collaborator-images');
CREATE POLICY "Public insert collaborator images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'collaborator-images');
CREATE POLICY "Public update collaborator images" ON storage.objects FOR UPDATE USING (bucket_id = 'collaborator-images');
CREATE POLICY "Public delete collaborator images" ON storage.objects FOR DELETE USING (bucket_id = 'collaborator-images');