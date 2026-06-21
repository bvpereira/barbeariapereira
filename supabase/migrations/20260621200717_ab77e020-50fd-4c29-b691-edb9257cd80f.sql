
CREATE OR REPLACE FUNCTION public.informacoes_force_envio_via()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.instancia_reserva_evo, '') <> COALESCE(NEW.instancia_evo, '') THEN
    NEW.envio_via := 'Whatsapp';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS informacoes_force_envio_via_trg ON public.informacoes;
CREATE TRIGGER informacoes_force_envio_via_trg
BEFORE INSERT OR UPDATE ON public.informacoes
FOR EACH ROW EXECUTE FUNCTION public.informacoes_force_envio_via();

CREATE OR REPLACE FUNCTION public.superadmin_force_envio_via()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.instancia_reserva_evo, '') <> COALESCE(NEW.instancia_principal_evo, '') THEN
    NEW.envio_via := 'Whatsapp';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS superadmin_force_envio_via_trg ON public.superadmin;
CREATE TRIGGER superadmin_force_envio_via_trg
BEFORE INSERT OR UPDATE ON public.superadmin
FOR EACH ROW EXECUTE FUNCTION public.superadmin_force_envio_via();

UPDATE public.informacoes
SET envio_via = 'Whatsapp'
WHERE COALESCE(instancia_reserva_evo, '') <> COALESCE(instancia_evo, '');

UPDATE public.superadmin
SET envio_via = 'Whatsapp'
WHERE COALESCE(instancia_reserva_evo, '') <> COALESCE(instancia_principal_evo, '');
