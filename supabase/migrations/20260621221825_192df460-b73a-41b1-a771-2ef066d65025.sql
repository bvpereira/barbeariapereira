ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS extra BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_servicos_barbearia_extra ON public.servicos(barbearia_id, extra);