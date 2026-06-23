
CREATE OR REPLACE FUNCTION public.trg_atendimento_cashback_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.cashback_usado, 0) > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cashback_movimentos
      WHERE atendimento_id = OLD.id
        AND tipo = 'estorno_debito'
    ) THEN
      INSERT INTO public.cashback_movimentos(barbearia_id, cliente_id, atendimento_id, tipo, valor, descricao)
        VALUES (OLD.barbearia_id, OLD.cliente_id, OLD.id, 'estorno_debito', OLD.cashback_usado, 'Exclusão de atendimento');
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_atendimento_cashback_del ON public.atendimentos;
CREATE TRIGGER trg_atendimento_cashback_del
BEFORE DELETE ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.trg_atendimento_cashback_delete();
