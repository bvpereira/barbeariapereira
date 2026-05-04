-- Backup and drop
DROP TABLE IF EXISTS public.integracoes;

-- Recreate exactly
CREATE TABLE public.integracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- DISABLE RLS for debugging
ALTER TABLE public.integracoes DISABLE ROW LEVEL SECURITY;
