ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS recovery_token TEXT;
CREATE INDEX IF NOT EXISTS idx_usuarios_recovery_token ON public.usuarios(recovery_token);