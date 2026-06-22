DROP TRIGGER IF EXISTS trg_atend_serv_cashback ON public.atendimento_servicos;

CREATE TRIGGER trg_atend_serv_cashback
AFTER INSERT OR DELETE OR UPDATE OF servico_id, valor_original, valor_desconto, valor_servico, tipo_desconto_cupom, valor_regra_cupom
ON public.atendimento_servicos
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalc_cashback_atendimento();