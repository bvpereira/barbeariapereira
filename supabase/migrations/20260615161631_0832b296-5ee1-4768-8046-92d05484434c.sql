CREATE OR REPLACE FUNCTION public.get_cliente_clube_status(p_barbearia_id uuid, p_cliente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente record; v_clube record; v_regra jsonb; v_servico record;
  v_usados int; v_servicos jsonb := '[]'::jsonb;
BEGIN
  SELECT clube_id, clube_data_inicio, clube_data_fim, clube_valor_pago, clube_historico
    INTO v_cliente FROM public.usuarios
  WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id;
  IF NOT FOUND OR v_cliente.clube_id IS NULL THEN
    RETURN jsonb_build_object('ativo', false, 'historico', COALESCE(v_cliente.clube_historico, '[]'::jsonb));
  END IF;

  SELECT * INTO v_clube FROM public.clube_assinatura WHERE id = v_cliente.clube_id;

  FOR v_regra IN SELECT value FROM jsonb_array_elements(v_clube.regras_servicos) LOOP
    SELECT name INTO v_servico FROM public.servicos WHERE id = (v_regra->>'servico_id')::uuid;
    SELECT COUNT(*) INTO v_usados
    FROM public.atendimento_servicos asv
    JOIN public.atendimentos a ON a.id = asv.atendimento_id
    WHERE a.cliente_id = p_cliente_id AND a.barbearia_id = p_barbearia_id
      AND asv.servico_id = (v_regra->>'servico_id')::uuid
      AND (a.data AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_cliente.clube_data_inicio AND v_cliente.clube_data_fim
      AND a.status IN ('Agendado', 'Finalizado');
    v_servicos := v_servicos || jsonb_build_object(
      'servico_id', v_regra->>'servico_id',
      'nome', COALESCE(v_servico.name, 'Serviço'),
      'quantidade', (v_regra->>'quantidade')::int,
      'usados', v_usados,
      'restantes', GREATEST(0, (v_regra->>'quantidade')::int - v_usados),
      'tipo_desconto', v_regra->>'tipo_desconto',
      'valor_desconto', (v_regra->>'valor_desconto')::numeric,
      'dias_semana', v_regra->'dias_semana'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ativo', v_cliente.clube_data_fim >= CURRENT_DATE,
    'expirado', v_cliente.clube_data_fim < CURRENT_DATE,
    'clube_id', v_clube.id, 'clube_nome', v_clube.nome, 'descricao', v_clube.descricao,
    'valor', v_cliente.clube_valor_pago, 'data_inicio', v_cliente.clube_data_inicio,
    'data_fim', v_cliente.clube_data_fim, 'servicos', v_servicos,
    'historico', COALESCE(v_cliente.clube_historico, '[]'::jsonb)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.apply_clube_to_appointment(p_atendimento_id uuid, p_barbearia_id uuid, p_cliente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_at record; v_cliente record; v_clube record;
  v_data_local date; v_dow int;
  v_total_desc numeric(10,2) := 0; v_total_orig numeric(10,2) := 0;
  v_item record; v_servico_regra jsonb; v_usados int; v_disp int; v_desc_item numeric(10,2);
BEGIN
  SELECT * INTO v_at FROM public.atendimentos
  WHERE id = p_atendimento_id AND barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;

  SELECT clube_id, clube_data_inicio, clube_data_fim INTO v_cliente
  FROM public.usuarios WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id;

  UPDATE public.atendimento_servicos SET
    valor_servico = valor_original, valor_desconto = 0
  WHERE atendimento_id = p_atendimento_id AND tipo_desconto_cupom IS NULL;
  UPDATE public.atendimentos SET clube_id = NULL, clube_desconto_aplicado = 0,
    valor = COALESCE(valor_original, valor), valor_desconto = COALESCE(valor_desconto, 0) - clube_desconto_aplicado
  WHERE id = p_atendimento_id;

  IF v_cliente.clube_id IS NULL OR v_cliente.clube_data_fim IS NULL OR v_cliente.clube_data_fim < CURRENT_DATE THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'Cliente sem clube ativo.');
  END IF;

  v_data_local := (v_at.data AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_data_local < v_cliente.clube_data_inicio OR v_data_local > v_cliente.clube_data_fim THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'Data fora do período do clube.');
  END IF;

  SELECT * INTO v_clube FROM public.clube_assinatura
  WHERE id = v_cliente.clube_id AND ativo = true AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('aplicado', false, 'motivo', 'Clube inativo.'); END IF;

  v_dow := EXTRACT(DOW FROM v_data_local)::int;

  FOR v_item IN
    SELECT id, servico_id, valor_original FROM public.atendimento_servicos
    WHERE atendimento_id = p_atendimento_id ORDER BY id
  LOOP
    v_total_orig := v_total_orig + v_item.valor_original;
    v_servico_regra := NULL;
    SELECT value INTO v_servico_regra FROM jsonb_array_elements(v_clube.regras_servicos) value
    WHERE (value->>'servico_id')::uuid = v_item.servico_id LIMIT 1;

    v_desc_item := 0;
    IF v_servico_regra IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_servico_regra->'dias_semana') d
        WHERE (d::text)::int = v_dow) THEN
        SELECT COUNT(*) INTO v_usados
        FROM public.atendimento_servicos asv2
        JOIN public.atendimentos a2 ON a2.id = asv2.atendimento_id
        WHERE a2.cliente_id = p_cliente_id AND a2.barbearia_id = p_barbearia_id
          AND a2.id <> p_atendimento_id
          AND asv2.servico_id = v_item.servico_id
          AND (a2.data AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_cliente.clube_data_inicio AND v_cliente.clube_data_fim
          AND a2.status IN ('Agendado', 'Finalizado');
        v_disp := (v_servico_regra->>'quantidade')::int - v_usados;
        IF v_disp > 0 THEN
          IF v_servico_regra->>'tipo_desconto' = 'percentual' THEN
            v_desc_item := round(v_item.valor_original * (v_servico_regra->>'valor_desconto')::numeric / 100, 2);
          ELSE
            v_desc_item := LEAST((v_servico_regra->>'valor_desconto')::numeric, v_item.valor_original);
          END IF;
        END IF;
      END IF;
    END IF;

    UPDATE public.atendimento_servicos SET
      valor_desconto = COALESCE(valor_desconto, 0) + v_desc_item,
      valor_servico = GREATEST(v_item.valor_original - (COALESCE(valor_desconto, 0) + v_desc_item), 0)
    WHERE id = v_item.id;
    v_total_desc := v_total_desc + v_desc_item;
  END LOOP;

  UPDATE public.atendimentos SET
    clube_id = v_clube.id,
    clube_desconto_aplicado = v_total_desc,
    valor_original = v_total_orig,
    valor_desconto = COALESCE(valor_desconto, 0) + v_total_desc,
    valor = GREATEST(valor - v_total_desc, 0)
  WHERE id = p_atendimento_id;

  RETURN jsonb_build_object('aplicado', v_total_desc > 0, 'desconto', v_total_desc,
    'valor_original', v_total_orig, 'valor_final', GREATEST(v_total_orig - v_total_desc, 0));
END $function$;