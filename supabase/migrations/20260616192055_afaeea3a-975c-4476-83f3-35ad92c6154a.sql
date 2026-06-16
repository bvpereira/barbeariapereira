
-- 1. Nova tabela
CREATE TABLE public.clube_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id uuid NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  clube_id uuid NOT NULL REFERENCES public.clube_assinatura(id) ON DELETE RESTRICT,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor_pago numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa',
  cancelada_em timestamptz,
  motivo_cancelamento text,
  criada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clube_usuarios_periodo_chk CHECK (data_fim >= data_inicio),
  CONSTRAINT clube_usuarios_status_chk CHECK (status IN ('ativa','expirada','cancelada','arquivada'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clube_usuarios TO authenticated;
GRANT ALL ON public.clube_usuarios TO service_role;

ALTER TABLE public.clube_usuarios ENABLE ROW LEVEL SECURITY;

-- Acesso só via RPCs SECURITY DEFINER (mesmo padrão de clube_assinatura)
CREATE POLICY "clube_usuarios_no_direct_access" ON public.clube_usuarios
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE INDEX clube_usuarios_barbearia_usuario_status_idx
  ON public.clube_usuarios (barbearia_id, usuario_id, status);
CREATE INDEX clube_usuarios_barbearia_clube_idx
  ON public.clube_usuarios (barbearia_id, clube_id);
CREATE UNIQUE INDEX clube_usuarios_uma_ativa_por_usuario_idx
  ON public.clube_usuarios (usuario_id) WHERE status = 'ativa';

CREATE OR REPLACE FUNCTION public.update_clube_usuarios_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_clube_usuarios_updated_at
  BEFORE UPDATE ON public.clube_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_clube_usuarios_updated_at();

-- 2. Backfill assinatura corrente
INSERT INTO public.clube_usuarios
  (barbearia_id, usuario_id, clube_id, data_inicio, data_fim, valor_pago, status)
SELECT u.barbearia_id, u.id, u.clube_id, u.clube_data_inicio, u.clube_data_fim,
       COALESCE(u.clube_valor_pago, 0),
       CASE WHEN u.clube_data_fim >= CURRENT_DATE THEN 'ativa' ELSE 'expirada' END
FROM public.usuarios u
WHERE u.clube_id IS NOT NULL
  AND u.clube_data_inicio IS NOT NULL
  AND u.clube_data_fim IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.clube_assinatura c WHERE c.id = u.clube_id);

-- 3. Backfill histórico (status = 'arquivada')
INSERT INTO public.clube_usuarios
  (barbearia_id, usuario_id, clube_id, data_inicio, data_fim, valor_pago, status, created_at)
SELECT u.barbearia_id, u.id,
       (h->>'clube_id')::uuid,
       (h->>'data_inicio')::date,
       (h->>'data_fim')::date,
       COALESCE((h->>'valor')::numeric, 0),
       'arquivada',
       COALESCE((h->>'arquivado_em')::timestamptz, now())
FROM public.usuarios u, jsonb_array_elements(COALESCE(u.clube_historico, '[]'::jsonb)) h
WHERE jsonb_typeof(u.clube_historico) = 'array'
  AND (h->>'clube_id') IS NOT NULL
  AND (h->>'data_inicio') IS NOT NULL
  AND (h->>'data_fim') IS NOT NULL
  AND (h->>'data_fim')::date >= (h->>'data_inicio')::date
  AND EXISTS (SELECT 1 FROM public.clube_assinatura c WHERE c.id = (h->>'clube_id')::uuid);

-- 4. Reescrever funções

-- set_cliente_clube: arquiva ativa atual e cria nova
CREATE OR REPLACE FUNCTION public.set_cliente_clube(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid,
  p_cliente_id uuid, p_clube_id uuid,
  p_data_inicio date, p_data_fim date, p_valor numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;
  IF p_data_fim < p_data_inicio THEN RAISE EXCEPTION 'Data final inválida.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id AND nivel = 3) THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clube_assinatura
    WHERE id = p_clube_id AND barbearia_id = p_barbearia_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Clube não encontrado.';
  END IF;

  UPDATE public.clube_usuarios
    SET status = 'arquivada'
  WHERE usuario_id = p_cliente_id AND status = 'ativa';

  INSERT INTO public.clube_usuarios
    (barbearia_id, usuario_id, clube_id, data_inicio, data_fim, valor_pago, status, criada_por)
  VALUES (p_barbearia_id, p_cliente_id, p_clube_id, p_data_inicio, p_data_fim,
          COALESCE(p_valor, 0), 'ativa', p_admin_id);
END $$;

-- remove_cliente_clube
CREATE OR REPLACE FUNCTION public.remove_cliente_clube(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid, p_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  UPDATE public.clube_usuarios
    SET status = 'cancelada',
        cancelada_em = now(),
        motivo_cancelamento = COALESCE(motivo_cancelamento, 'Removido pelo administrador.')
  WHERE usuario_id = p_cliente_id
    AND barbearia_id = p_barbearia_id
    AND status = 'ativa';
END $$;

-- get_cliente_clube_status
CREATE OR REPLACE FUNCTION public.get_cliente_clube_status(
  p_barbearia_id uuid, p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_atual public.clube_usuarios%ROWTYPE;
  v_clube public.clube_assinatura%ROWTYPE;
  v_regra jsonb; v_servico_nome text; v_usados int;
  v_servicos jsonb := '[]'::jsonb;
  v_historico jsonb := '[]'::jsonb;
BEGIN
  SELECT cu.* INTO v_atual FROM public.clube_usuarios cu
  WHERE cu.usuario_id = p_cliente_id AND cu.barbearia_id = p_barbearia_id
    AND cu.status IN ('ativa','expirada')
  ORDER BY (cu.status = 'ativa') DESC, cu.data_fim DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'clube_id', h.clube_id,
    'clube_nome', c.nome,
    'data_inicio', h.data_inicio,
    'data_fim', h.data_fim,
    'valor', h.valor_pago
  ) ORDER BY h.data_fim DESC), '[]'::jsonb)
  INTO v_historico
  FROM public.clube_usuarios h
  LEFT JOIN public.clube_assinatura c ON c.id = h.clube_id
  WHERE h.usuario_id = p_cliente_id AND h.barbearia_id = p_barbearia_id
    AND (v_atual.id IS NULL OR h.id <> v_atual.id);

  IF v_atual.id IS NULL THEN
    RETURN jsonb_build_object('ativo', false, 'historico', v_historico);
  END IF;

  SELECT * INTO v_clube FROM public.clube_assinatura WHERE id = v_atual.clube_id;

  FOR v_regra IN SELECT value FROM jsonb_array_elements(v_clube.regras_servicos) LOOP
    SELECT name INTO v_servico_nome FROM public.servicos
      WHERE id = (v_regra->>'servico_id')::uuid;
    SELECT COUNT(*) INTO v_usados
    FROM public.atendimento_servicos asv
    JOIN public.atendimentos a ON a.id = asv.atendimento_id
    WHERE a.cliente_id = p_cliente_id AND a.barbearia_id = p_barbearia_id
      AND asv.servico_id = (v_regra->>'servico_id')::uuid
      AND (a.data AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN v_atual.data_inicio AND v_atual.data_fim
      AND a.status IN ('Agendado','Finalizado');
    v_servicos := v_servicos || jsonb_build_object(
      'servico_id', v_regra->>'servico_id',
      'nome', COALESCE(v_servico_nome, 'Serviço'),
      'quantidade', (v_regra->>'quantidade')::int,
      'usados', v_usados,
      'restantes', GREATEST(0, (v_regra->>'quantidade')::int - v_usados),
      'tipo_desconto', v_regra->>'tipo_desconto',
      'valor_desconto', (v_regra->>'valor_desconto')::numeric,
      'dias_semana', v_regra->'dias_semana'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ativo', v_atual.status = 'ativa' AND v_atual.data_fim >= CURRENT_DATE,
    'expirado', v_atual.data_fim < CURRENT_DATE,
    'clube_id', v_clube.id, 'clube_nome', v_clube.nome, 'descricao', v_clube.descricao,
    'valor', v_atual.valor_pago, 'data_inicio', v_atual.data_inicio,
    'data_fim', v_atual.data_fim, 'servicos', v_servicos,
    'historico', v_historico
  );
END $$;

-- list_clubes_assinatura
CREATE OR REPLACE FUNCTION public.list_clubes_assinatura(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid)
RETURNS TABLE(id uuid, nome text, valor_mensal numeric, descricao text, ativo boolean,
  regras_servicos jsonb, created_at timestamptz, assinantes jsonb, total_assinantes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_admin_id
    AND u.barbearia_id = p_barbearia_id AND u.senha = p_admin_password AND u.nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.valor_mensal, c.descricao, c.ativo, c.regras_servicos, c.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u2.id, 'nome', u2.nome, 'data_fim', cu.data_fim)
                       ORDER BY u2.nome)
      FROM public.clube_usuarios cu
      JOIN public.usuarios u2 ON u2.id = cu.usuario_id
      WHERE cu.clube_id = c.id AND cu.barbearia_id = p_barbearia_id
        AND cu.status = 'ativa' AND cu.data_fim >= CURRENT_DATE
    ), '[]'::jsonb) AS assinantes,
    (SELECT count(*) FROM public.clube_usuarios cu
      WHERE cu.clube_id = c.id AND cu.barbearia_id = p_barbearia_id
        AND cu.status = 'ativa' AND cu.data_fim >= CURRENT_DATE)::bigint
  FROM public.clube_assinatura c
  WHERE c.barbearia_id = p_barbearia_id AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC;
END $$;

-- list_clube_expirando
CREATE OR REPLACE FUNCTION public.list_clube_expirando(
  p_admin_id uuid, p_admin_password text, p_barbearia_id uuid)
RETURNS TABLE(cliente_id uuid, cliente_nome text, cliente_login text,
  clube_id uuid, clube_nome text, data_fim date, dias_restantes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id
    AND barbearia_id = p_barbearia_id AND senha = p_admin_password AND nivel = 1) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nome, u.login, c.id, c.nome, cu.data_fim,
    (cu.data_fim - CURRENT_DATE)::int
  FROM public.clube_usuarios cu
  JOIN public.usuarios u ON u.id = cu.usuario_id
  JOIN public.clube_assinatura c ON c.id = cu.clube_id
  WHERE cu.barbearia_id = p_barbearia_id
    AND cu.status = 'ativa'
    AND cu.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
  ORDER BY cu.data_fim ASC;
END $$;

-- apply_clube_to_appointment
CREATE OR REPLACE FUNCTION public.apply_clube_to_appointment(
  p_atendimento_id uuid, p_barbearia_id uuid, p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_at record; v_cu public.clube_usuarios%ROWTYPE; v_clube record;
  v_data_local date; v_dow int;
  v_total_desc numeric(10,2) := 0; v_total_orig numeric(10,2) := 0;
  v_item record; v_servico_regra jsonb; v_usados int; v_disp int; v_desc_item numeric(10,2);
BEGIN
  SELECT * INTO v_at FROM public.atendimentos
  WHERE id = p_atendimento_id AND barbearia_id = p_barbearia_id AND cliente_id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;

  SELECT cu.* INTO v_cu FROM public.clube_usuarios cu
  WHERE cu.usuario_id = p_cliente_id AND cu.barbearia_id = p_barbearia_id
    AND cu.status = 'ativa'
  LIMIT 1;

  UPDATE public.atendimento_servicos SET
    valor_servico = valor_original, valor_desconto = 0
  WHERE atendimento_id = p_atendimento_id AND tipo_desconto_cupom IS NULL;
  UPDATE public.atendimentos SET clube_id = NULL, clube_desconto_aplicado = 0,
    valor = COALESCE(valor_original, valor),
    valor_desconto = COALESCE(valor_desconto, 0) - clube_desconto_aplicado
  WHERE id = p_atendimento_id;

  IF v_cu.id IS NULL OR v_cu.data_fim < CURRENT_DATE THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'Cliente sem clube ativo.');
  END IF;

  v_data_local := (v_at.data AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_data_local < v_cu.data_inicio OR v_data_local > v_cu.data_fim THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'Data fora do período do clube.');
  END IF;

  SELECT * INTO v_clube FROM public.clube_assinatura
  WHERE id = v_cu.clube_id AND ativo = true AND deleted_at IS NULL;
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
          AND (a2.data AT TIME ZONE 'America/Sao_Paulo')::date
            BETWEEN v_cu.data_inicio AND v_cu.data_fim
          AND a2.status IN ('Agendado','Finalizado');
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
END $$;

-- rollback_barbearia: incluir clube_usuarios
CREATE OR REPLACE FUNCTION public.rollback_barbearia(
  p_admin_id uuid, p_admin_login text, p_admin_senha text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = p_admin_id AND login = p_admin_login AND senha = p_admin_senha AND nivel = 0) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;
  DELETE FROM public.atendimento_servicos WHERE barbearia_id = p_id;
  DELETE FROM public.atendimentos WHERE barbearia_id = p_id;
  DELETE FROM public.horarios_colaboradores WHERE barbearia_id = p_id;
  DELETE FROM public.colaborador_servicos WHERE barbearia_id = p_id;
  DELETE FROM public.transacoes_financeiras WHERE barbearia_id = p_id;
  DELETE FROM public.gastos WHERE barbearia_id = p_id;
  DELETE FROM public.notificacoes WHERE barbearia_id = p_id;
  DELETE FROM public.mensagens WHERE barbearia_id = p_id;
  DELETE FROM public.blog WHERE barbearia_id = p_id;
  DELETE FROM public.promocao WHERE barbearia_id = p_id;
  DELETE FROM public.cupons_desconto WHERE barbearia_id = p_id;
  DELETE FROM public.clube_usuarios WHERE barbearia_id = p_id;
  DELETE FROM public.clube_assinatura WHERE barbearia_id = p_id;
  DELETE FROM public.dias_agenda WHERE barbearia_id = p_id;
  DELETE FROM public.integracoes WHERE barbearia_id = p_id;
  DELETE FROM public.agentes_ia WHERE barbearia_id = p_id;
  DELETE FROM public.informacoes WHERE barbearia_id = p_id;
  DELETE FROM public.servicos WHERE barbearia_id = p_id;
  DELETE FROM public.colaboradores WHERE barbearia_id = p_id;
  DELETE FROM public.usuarios WHERE barbearia_id = p_id;
  DELETE FROM public.barbearias WHERE id = p_id;
  RETURN true;
END $$;
