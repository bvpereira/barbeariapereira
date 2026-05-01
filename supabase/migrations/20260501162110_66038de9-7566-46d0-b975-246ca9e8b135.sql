-- Create the gastos table
CREATE TABLE public.gastos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    data TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- Create policies (permissive as per project current state)
CREATE POLICY "Enable all operations for all users on gastos" 
ON public.gastos 
FOR ALL 
USING (true)
WITH CHECK (true);
