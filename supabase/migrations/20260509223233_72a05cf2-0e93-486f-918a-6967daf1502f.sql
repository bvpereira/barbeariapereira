ALTER TABLE public.informacoes ADD COLUMN IF NOT EXISTS tempo_marcar INTEGER DEFAULT 60;
ALTER TABLE public.informacoes ADD COLUMN IF NOT EXISTS tempo_excluir INTEGER DEFAULT 60;

-- Atualiza o registro existente do administrador com os valores padrão atuais
UPDATE public.informacoes SET tempo_marcar = 60, tempo_excluir = 60 WHERE userrr = 'admin';