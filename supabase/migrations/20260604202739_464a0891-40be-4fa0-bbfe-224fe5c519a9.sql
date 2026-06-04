-- Primeiro, remover a constraint de unicidade composta se existir
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integracoes_tipo_barbearia_id_key') THEN
        ALTER TABLE public.integracoes DROP CONSTRAINT integracoes_tipo_barbearia_id_key;
    END IF;
END $$;

-- Remover índice único se existir
DROP INDEX IF EXISTS public.integracoes_tipo_barbearia_id_idx;

-- Deduplicar mantendo apenas o mais recente por tipo
DELETE FROM public.integracoes a
USING public.integracoes b
WHERE a.tipo = b.tipo 
  AND a.created_at < b.created_at;

-- Tornar barbearia_id nulo e limpar valores antigos (já que agora é global)
ALTER TABLE public.integracoes ALTER COLUMN barbearia_id DROP NOT NULL;
UPDATE public.integracoes SET barbearia_id = NULL;

-- Adicionar nova constraint única apenas por tipo
ALTER TABLE public.integracoes ADD CONSTRAINT integracoes_tipo_unique UNIQUE (tipo);

-- Garantir privilégios (padrão do projeto)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integracoes TO authenticated;
GRANT ALL ON public.integracoes TO service_role;
GRANT SELECT ON public.integracoes TO anon;