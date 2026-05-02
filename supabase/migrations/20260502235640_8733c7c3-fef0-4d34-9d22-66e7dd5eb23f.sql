-- Create informacoes table
CREATE TABLE IF NOT EXISTS public.informacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tel_contato TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.informacoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own information" 
ON public.informacoes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own information" 
ON public.informacoes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own information" 
ON public.informacoes FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.informacoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();