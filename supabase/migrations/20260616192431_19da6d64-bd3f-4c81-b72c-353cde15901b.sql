
ALTER TABLE public.usuarios
  DROP COLUMN IF EXISTS clube_id,
  DROP COLUMN IF EXISTS clube_data_inicio,
  DROP COLUMN IF EXISTS clube_data_fim,
  DROP COLUMN IF EXISTS clube_valor_pago,
  DROP COLUMN IF EXISTS clube_historico;
