CREATE TABLE IF NOT EXISTS public.integracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

-- Allow Level 1 (Admins) to manage integrations
CREATE POLICY "Admins can do everything on integrations" 
ON public.integracoes 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() AND nivel = 1
    )
);

-- Allow all authenticated users to read integrations (to check if webhook should fire)
CREATE POLICY "All authenticated users can view integrations" 
ON public.integracoes 
FOR SELECT 
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_integracoes_updated_at
    BEFORE UPDATE ON public.integracoes
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();