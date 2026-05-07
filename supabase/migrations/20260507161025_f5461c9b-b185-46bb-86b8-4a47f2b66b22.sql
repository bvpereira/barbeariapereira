ALTER TABLE public.atendimento_servicos ADD COLUMN name_servico TEXT;

UPDATE public.atendimento_servicos AS aser
SET name_servico = s.name
FROM public.servicos AS s
WHERE aser.servico_id = s.id;

CREATE OR REPLACE FUNCTION public.sync_atendimento_servico_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT name INTO NEW.name_servico
  FROM public.servicos
  WHERE id = NEW.servico_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_atendimento_servico_name
BEFORE INSERT OR UPDATE OF servico_id ON public.atendimento_servicos
FOR EACH ROW
EXECUTE FUNCTION public.sync_atendimento_servico_name();