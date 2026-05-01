-- Create dias_agenda table
CREATE TABLE public.dias_agenda (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    data DATE NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create horarios_colaboradores table
CREATE TABLE public.horarios_colaboradores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE NOT NULL,
    data DATE NOT NULL,
    manha_inicio TIME,
    manha_fim TIME,
    tarde_inicio TIME,
    tarde_fim TIME,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(colaborador_id, data)
);

-- Enable RLS
ALTER TABLE public.dias_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_colaboradores ENABLE ROW LEVEL SECURITY;

-- Create public policies (following the "Admin/Public" pattern observed in previous steps)
CREATE POLICY "Public read dias_agenda" ON public.dias_agenda FOR SELECT USING (true);
CREATE POLICY "Public insert dias_agenda" ON public.dias_agenda FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update dias_agenda" ON public.dias_agenda FOR UPDATE USING (true);
CREATE POLICY "Public delete dias_agenda" ON public.dias_agenda FOR DELETE USING (true);

CREATE POLICY "Public read horarios_colaboradores" ON public.horarios_colaboradores FOR SELECT USING (true);
CREATE POLICY "Public insert horarios_colaboradores" ON public.horarios_colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update horarios_colaboradores" ON public.horarios_colaboradores FOR UPDATE USING (true);
CREATE POLICY "Public delete horarios_colaboradores" ON public.horarios_colaboradores FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dias_agenda_updated_at
BEFORE UPDATE ON public.dias_agenda
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_horarios_colaboradores_updated_at
BEFORE UPDATE ON public.horarios_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
