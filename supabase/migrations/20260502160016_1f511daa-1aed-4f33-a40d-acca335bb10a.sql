-- Add 'ativo' column to colaboradores
ALTER TABLE public.colaboradores 
ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;

-- Add 'comissao' column to atendimentos
ALTER TABLE public.atendimentos 
ADD COLUMN comissao NUMERIC NOT NULL DEFAULT 0;

-- Refresh existing views or triggers if any (none detected that would break)
