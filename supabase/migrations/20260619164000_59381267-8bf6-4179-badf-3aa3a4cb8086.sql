-- Store schedule timestamps as wall-clock (no time zone) so values are saved exactly as entered.
-- Existing rows are converted from UTC to America/Sao_Paulo wall-clock to preserve current displayed values.
ALTER TABLE public.atendimentos
  ALTER COLUMN data TYPE timestamp without time zone
  USING (data AT TIME ZONE 'America/Sao_Paulo');

ALTER TABLE public.gastos
  ALTER COLUMN data TYPE timestamp without time zone
  USING (data AT TIME ZONE 'America/Sao_Paulo');

ALTER TABLE public.promocao
  ALTER COLUMN data_promo TYPE timestamp without time zone
  USING (data_promo AT TIME ZONE 'America/Sao_Paulo');