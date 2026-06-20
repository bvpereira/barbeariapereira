ALTER TABLE public.superadmin
  ADD COLUMN IF NOT EXISTS instancia_reserva_evo TEXT,
  ADD COLUMN IF NOT EXISTS instancia_reserva_api TEXT,
  ADD COLUMN IF NOT EXISTS instancia_reserva_numero TEXT;