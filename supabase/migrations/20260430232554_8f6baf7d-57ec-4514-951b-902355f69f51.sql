-- Recreate the table if there is any hidden issue with its schema
DROP TABLE IF EXISTS public.colaborador_servicos;

CREATE TABLE public.colaborador_servicos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE,
    tipo_comissao TEXT CHECK (tipo_comissao IN ('fixo', 'percentual')),
    valor_comissao NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.colaborador_servicos ENABLE ROW LEVEL SECURITY;

-- Create broad policies for debugging (can be tightened later)
CREATE POLICY "Public select colaborador_servicos" ON public.colaborador_servicos FOR SELECT USING (true);
CREATE POLICY "Public insert colaborador_servicos" ON public.colaborador_servicos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update colaborador_servicos" ON public.colaborador_servicos FOR UPDATE USING (true);
CREATE POLICY "Public delete colaborador_servicos" ON public.colaborador_servicos FOR DELETE USING (true);