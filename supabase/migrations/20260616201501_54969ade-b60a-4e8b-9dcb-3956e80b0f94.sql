CREATE OR REPLACE FUNCTION public.validate_cupom_desconto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  regra jsonb;
  servico_uuid uuid;
BEGIN
  -- Pular validação em soft-delete ou em cupons já excluídos
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à data inicial.';
  END IF;
  IF array_length(NEW.dias_semana, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um dia da semana.';
  END IF;
  IF NEW.limite_por_cliente NOT IN ('1', 'ilimitado') THEN
    RAISE EXCEPTION 'Limite por cliente inválido.';
  END IF;
  IF NEW.inatividade_dias IS NOT NULL AND NEW.inatividade_dias <= 0 THEN
    RAISE EXCEPTION 'O tempo de inatividade deve ser positivo.';
  END IF;
  IF NEW.valor_minimo_total IS NOT NULL THEN
    IF NEW.valor_minimo_total <= 0 THEN
      RAISE EXCEPTION 'O valor mínimo deve ser positivo.';
    END IF;
    IF NEW.tipo_desconto_total NOT IN ('percentual', 'fixo') OR NEW.valor_desconto_total IS NULL OR NEW.valor_desconto_total <= 0 THEN
      RAISE EXCEPTION 'Informe um desconto total válido.';
    END IF;
    IF NEW.tipo_desconto_total = 'percentual' AND NEW.valor_desconto_total > 100 THEN
      RAISE EXCEPTION 'O desconto percentual não pode ultrapassar 100%%.';
    END IF;
  ELSE
    NEW.tipo_desconto_total := NULL;
    NEW.valor_desconto_total := NULL;
  END IF;
  IF jsonb_typeof(NEW.regras_servicos) <> 'array' OR jsonb_array_length(NEW.regras_servicos) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço.';
  END IF;

  FOR regra IN SELECT value FROM jsonb_array_elements(NEW.regras_servicos)
  LOOP
    BEGIN
      servico_uuid := (regra->>'servico_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Serviço inválido nas regras do cupom.';
    END;
    IF NOT EXISTS (
      SELECT 1 FROM public.servicos s
      WHERE s.id = servico_uuid AND s.barbearia_id = NEW.barbearia_id
    ) THEN
      RAISE EXCEPTION 'Um serviço selecionado não pertence à barbearia.';
    END IF;
    IF NEW.valor_minimo_total IS NULL THEN
      IF regra->>'tipo_desconto' NOT IN ('percentual', 'fixo')
         OR COALESCE((regra->>'valor_desconto')::numeric, 0) <= 0 THEN
        RAISE EXCEPTION 'Informe o desconto de cada serviço selecionado.';
      END IF;
      IF regra->>'tipo_desconto' = 'percentual' AND (regra->>'valor_desconto')::numeric > 100 THEN
        RAISE EXCEPTION 'O desconto percentual não pode ultrapassar 100%%.';
      END IF;
    END IF;
  END LOOP;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;