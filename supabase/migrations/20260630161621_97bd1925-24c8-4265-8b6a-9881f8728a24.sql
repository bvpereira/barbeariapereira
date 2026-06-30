
CREATE OR REPLACE FUNCTION public.fn_recalc_cashback_atendimento(p_atendimento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_at RECORD;
  v_cu RECORD;
  v_clube RECORD;
  v_clube_loaded BOOLEAN := false;
  v_data_local DATE;
  v_dow INT;
  v_item RECORD;
  v_serv RECORD;
  v_perc NUMERIC(5,2);
  v_ativo BOOLEAN;
  v_coberto_clube BOOLEAN;
  v_regra JSONB;
  v_usados INT;
  v_total NUMERIC(10,2) := 0;
  v_cashback_item NUMERIC(10,2);
  v_fator NUMERIC(10,6);
BEGIN
  SELECT * INTO v_at FROM public.atendimentos WHERE id = p_atendimento_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT cu.* INTO v_cu FROM public.clube_usuarios cu
  WHERE cu.usuario_id = v_at.cliente_id
    AND cu.barbearia_id = v_at.barbearia_id
    AND cu.status = 'ativa'
  LIMIT 1;

  IF v_cu.id IS NOT NULL THEN
    SELECT * INTO v_clube FROM public.clube_assinatura
      WHERE id = v_cu.clube_id AND ativo = true AND deleted_at IS NULL;
    IF FOUND THEN v_clube_loaded := true; END IF;
  END IF;

  v_data_local := (v_at.data AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow := EXTRACT(DOW FROM v_data_local)::int;

  FOR v_item IN
    SELECT * FROM public.atendimento_servicos
    WHERE atendimento_id = p_atendimento_id
    ORDER BY id
  LOOP
    SELECT cashback_ativo, COALESCE(cashback_percentual, 0) AS perc
      INTO v_serv FROM public.servicos WHERE id = v_item.servico_id;

    v_ativo := COALESCE(v_item.cashback_ativo_override, v_serv.cashback_ativo);
    v_perc := COALESCE(v_item.cashback_percentual_override, v_serv.perc, 0);
    v_cashback_item := 0;

    IF v_ativo IS TRUE AND v_perc > 0 AND COALESCE(v_item.valor_original,0) > 0 THEN
      v_coberto_clube := false;
      IF v_clube_loaded AND v_cu.data_inicio <= v_data_local AND v_cu.data_fim >= v_data_local THEN
        SELECT value INTO v_regra FROM jsonb_array_elements(v_clube.regras_servicos) value
          WHERE (value->>'servico_id')::uuid = v_item.servico_id LIMIT 1;
        IF v_regra IS NOT NULL THEN
          IF EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_regra->'dias_semana') d
            WHERE (d::text)::int = v_dow
          ) THEN
            SELECT COUNT(*) INTO v_usados
            FROM public.atendimento_servicos asv2
            JOIN public.atendimentos a2 ON a2.id = asv2.atendimento_id
            WHERE a2.cliente_id = v_at.cliente_id
              AND a2.barbearia_id = v_at.barbearia_id
              AND asv2.servico_id = v_item.servico_id
              AND (a2.data AT TIME ZONE 'America/Sao_Paulo')::date
                  BETWEEN v_cu.data_inicio AND v_cu.data_fim
              AND a2.status IN ('Agendado','Finalizado');
            IF v_usados <= (v_regra->>'quantidade')::int THEN
              v_coberto_clube := true;
            END IF;
          END IF;
        END IF;
      END IF;

      IF NOT v_coberto_clube THEN
        IF COALESCE(v_item.valor_desconto, 0) > 0 AND v_item.tipo_desconto_cupom IS NOT NULL THEN
          v_fator := GREATEST(0, (v_item.valor_original - v_item.valor_desconto)) / v_item.valor_original;
          v_cashback_item := ROUND(v_item.valor_original * v_perc / 100 * v_fator, 2);
        ELSE
          v_cashback_item := ROUND(v_item.valor_original * v_perc / 100, 2);
        END IF;
      END IF;
    END IF;

    UPDATE public.atendimento_servicos
      SET cashback_gerado_item = v_cashback_item
      WHERE id = v_item.id;

    v_total := v_total + v_cashback_item;
  END LOOP;

  UPDATE public.atendimentos SET cashback_gerado = v_total WHERE id = p_atendimento_id;
END $function$;
