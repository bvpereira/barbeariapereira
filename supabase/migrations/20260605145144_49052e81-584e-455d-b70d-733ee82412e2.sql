CREATE TABLE public.mensagens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    barbearia_id UUID UNIQUE REFERENCES public.barbearias(id) ON DELETE CASCADE,
    msg_wpp_colab_eve_criado_01 TEXT,
    msg_wpp_colab_eve_alterado_02 TEXT,
    msg_wpp_colab_eve_cancelado_03 TEXT,
    msg_wpp_cliente_eve_criado_04 TEXT,
    msg_wpp_cliente_eve_alterado_05 TEXT,
    msg_wpp_cliente_eve_cancelado_06 TEXT,
    msg_wpp_cliente_finalizado_07 TEXT,
    msg_wpp_cliente_naocompareceu_08 TEXT,
    msg_wpp_colab_avisofinal_09 TEXT,
    msg_wpp_cliente_avisofinal_10 TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;

-- Enable RLS
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Simple policy for now (matching existing patterns in the project)
CREATE POLICY "Acesso total para usuários autenticados" ON public.mensagens
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mensagens_updated_at
    BEFORE UPDATE ON public.mensagens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial rows for existing barber shops
INSERT INTO public.mensagens (barbearia_id) VALUES 
('01879baf-8f8b-4c3d-810f-7740b6432cd9'),
('139b84a5-baff-456f-91fb-f1a9a678319f');
