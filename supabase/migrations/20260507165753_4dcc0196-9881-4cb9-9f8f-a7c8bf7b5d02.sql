-- Add the column to atendimentos
ALTER TABLE public.atendimentos ADD COLUMN IF NOT EXISTS servicos_atendimento TEXT;

-- Create function to get concatenated service names
CREATE OR REPLACE FUNCTION public.get_atendimento_servicos_names(atendimento_id_val UUID)
RETURNS TEXT AS $$
DECLARE
    names TEXT;
BEGIN
    SELECT string_agg(s.name, ', ')
    INTO names
    FROM public.atendimento_servicos as ASV
    JOIN public.servicos s ON ASV.servico_id = s.id
    WHERE ASV.atendimento_id = atendimento_id_val;
    
    RETURN COALESCE(names, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing records
UPDATE public.atendimentos a
SET servicos_atendimento = public.get_atendimento_servicos_names(a.id);

-- Create function for the trigger
CREATE OR REPLACE FUNCTION public.sync_atendimentos_servicos_string()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.atendimentos
        SET servicos_atendimento = public.get_atendimento_servicos_names(OLD.atendimento_id)
        WHERE id = OLD.atendimento_id;
        RETURN OLD;
    ELSE
        UPDATE public.atendimentos
        SET servicos_atendimento = public.get_atendimento_servicos_names(NEW.atendimento_id)
        WHERE id = NEW.atendimento_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on atendimento_servicos
DROP TRIGGER IF EXISTS trigger_sync_atendimentos_servicos_string ON public.atendimento_servicos;
CREATE TRIGGER trigger_sync_atendimentos_servicos_string
AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_servicos
FOR EACH ROW
EXECUTE FUNCTION public.sync_atendimentos_servicos_string();
