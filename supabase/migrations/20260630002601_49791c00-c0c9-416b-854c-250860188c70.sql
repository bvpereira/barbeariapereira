
-- 1. Tabela principal de estoque
CREATE TABLE public.estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('consumivel','revenda')),
  quantidade_atual numeric(12,3) NOT NULL DEFAULT 0,
  alerta_estoque numeric(12,3) NOT NULL DEFAULT 0,
  preco_revenda numeric(10,2),
  custo_medio numeric(10,4) NOT NULL DEFAULT 0,
  categoria text,
  marca text,
  unidade_medida text DEFAULT 'un',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_estoque_barb_tipo ON public.estoque(barbearia_id, tipo) WHERE deleted_at IS NULL;
CREATE INDEX idx_estoque_barb_nome ON public.estoque(barbearia_id, lower(nome)) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque TO authenticated;
GRANT ALL ON public.estoque TO service_role;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estoque_all_authenticated" ON public.estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Histórico de movimentações
CREATE TABLE public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbearia_id uuid NOT NULL,
  estoque_id uuid NOT NULL REFERENCES public.estoque(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade numeric(12,3) NOT NULL,
  saldo_apos numeric(12,3) NOT NULL,
  custo_unitario numeric(10,4),
  origem text,           -- 'gasto','venda','ajuste_manual','inicial'
  origem_id uuid,        -- id do gasto / atendimento_produto
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_mov_estoque ON public.estoque_movimentos(estoque_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentos TO authenticated;
GRANT ALL ON public.estoque_movimentos TO service_role;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estoque_mov_all_authenticated" ON public.estoque_movimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Produtos vendidos em atendimentos
CREATE TABLE public.atendimento_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  barbearia_id uuid NOT NULL,
  estoque_id uuid REFERENCES public.estoque(id) ON DELETE SET NULL,
  nome_produto text NOT NULL,
  quantidade numeric(12,3) NOT NULL DEFAULT 1,
  valor_unitario numeric(10,2) NOT NULL,
  valor_total numeric(10,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_atend_produtos_atend ON public.atendimento_produtos(atendimento_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimento_produtos TO authenticated;
GRANT ALL ON public.atendimento_produtos TO service_role;
ALTER TABLE public.atendimento_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atend_produtos_all_authenticated" ON public.atendimento_produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Vínculo gasto → estoque
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS estoque_id uuid REFERENCES public.estoque(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade_comprada numeric(12,3);

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_estoque_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_estoque_updated_at BEFORE UPDATE ON public.estoque
FOR EACH ROW EXECUTE FUNCTION public.update_estoque_updated_at();

-- 6. Função utilitária: aplica movimento (registra histórico e atualiza saldo + custo médio)
CREATE OR REPLACE FUNCTION public.aplicar_movimento_estoque(
  p_estoque_id uuid, p_barbearia_id uuid, p_tipo text, p_qtd numeric,
  p_custo_unit numeric, p_origem text, p_origem_id uuid, p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_saldo numeric; v_custo numeric; v_novo_saldo numeric;
BEGIN
  IF p_estoque_id IS NULL OR COALESCE(p_qtd,0) = 0 THEN RETURN; END IF;
  SELECT quantidade_atual, custo_medio INTO v_saldo, v_custo
    FROM public.estoque WHERE id = p_estoque_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_tipo = 'entrada' THEN
    v_novo_saldo := v_saldo + p_qtd;
    -- Custo médio ponderado
    IF p_custo_unit IS NOT NULL AND v_novo_saldo > 0 THEN
      UPDATE public.estoque SET
        quantidade_atual = v_novo_saldo,
        custo_medio = ((v_saldo * v_custo) + (p_qtd * p_custo_unit)) / v_novo_saldo
      WHERE id = p_estoque_id;
    ELSE
      UPDATE public.estoque SET quantidade_atual = v_novo_saldo WHERE id = p_estoque_id;
    END IF;
  ELSIF p_tipo = 'saida' THEN
    v_novo_saldo := v_saldo - p_qtd;
    UPDATE public.estoque SET quantidade_atual = v_novo_saldo WHERE id = p_estoque_id;
  ELSE -- ajuste
    v_novo_saldo := p_qtd; -- nesse caso p_qtd é o saldo final desejado
    UPDATE public.estoque SET quantidade_atual = v_novo_saldo WHERE id = p_estoque_id;
  END IF;

  INSERT INTO public.estoque_movimentos
    (barbearia_id, estoque_id, tipo, quantidade, saldo_apos, custo_unitario, origem, origem_id, motivo)
  VALUES (p_barbearia_id, p_estoque_id, p_tipo,
          CASE WHEN p_tipo='ajuste' THEN (v_novo_saldo - v_saldo) ELSE p_qtd END,
          v_novo_saldo, p_custo_unit, p_origem, p_origem_id, p_motivo);
END $$;

-- 7. Trigger gastos → estoque
CREATE OR REPLACE FUNCTION public.trg_gastos_estoque() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_custo_unit numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estoque_id IS NOT NULL AND COALESCE(OLD.quantidade_comprada,0) > 0 THEN
      PERFORM public.aplicar_movimento_estoque(OLD.estoque_id, OLD.barbearia_id, 'saida',
        OLD.quantidade_comprada, NULL, 'gasto_delete', OLD.id, 'Exclusão de gasto');
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estoque_id IS NOT NULL AND COALESCE(NEW.quantidade_comprada,0) > 0 THEN
      v_custo_unit := NEW.valor / NEW.quantidade_comprada;
      PERFORM public.aplicar_movimento_estoque(NEW.estoque_id, NEW.barbearia_id, 'entrada',
        NEW.quantidade_comprada, v_custo_unit, 'gasto', NEW.id, NEW.nome);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: reverte antigo e aplica novo
  IF OLD.estoque_id IS NOT NULL AND COALESCE(OLD.quantidade_comprada,0) > 0 THEN
    PERFORM public.aplicar_movimento_estoque(OLD.estoque_id, OLD.barbearia_id, 'saida',
      OLD.quantidade_comprada, NULL, 'gasto_update', OLD.id, 'Edição de gasto');
  END IF;
  IF NEW.estoque_id IS NOT NULL AND COALESCE(NEW.quantidade_comprada,0) > 0 THEN
    v_custo_unit := NEW.valor / NEW.quantidade_comprada;
    PERFORM public.aplicar_movimento_estoque(NEW.estoque_id, NEW.barbearia_id, 'entrada',
      NEW.quantidade_comprada, v_custo_unit, 'gasto', NEW.id, NEW.nome);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_gastos_estoque
AFTER INSERT OR UPDATE OR DELETE ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.trg_gastos_estoque();

-- 8. Trigger atendimento_produtos → estoque
CREATE OR REPLACE FUNCTION public.trg_atend_produtos_estoque() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estoque_id IS NOT NULL THEN
      PERFORM public.aplicar_movimento_estoque(OLD.estoque_id, OLD.barbearia_id, 'entrada',
        OLD.quantidade, NULL, 'venda_delete', OLD.id, 'Remoção de produto do atendimento');
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.estoque_id IS NOT NULL THEN
      PERFORM public.aplicar_movimento_estoque(NEW.estoque_id, NEW.barbearia_id, 'saida',
        NEW.quantidade, NULL, 'venda', NEW.id, NEW.nome_produto);
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: reverte antigo e aplica novo
  IF OLD.estoque_id IS NOT NULL THEN
    PERFORM public.aplicar_movimento_estoque(OLD.estoque_id, OLD.barbearia_id, 'entrada',
      OLD.quantidade, NULL, 'venda_update', OLD.id, 'Edição de produto');
  END IF;
  IF NEW.estoque_id IS NOT NULL THEN
    PERFORM public.aplicar_movimento_estoque(NEW.estoque_id, NEW.barbearia_id, 'saida',
      NEW.quantidade, NULL, 'venda', NEW.id, NEW.nome_produto);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_atend_produtos_estoque
AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_produtos
FOR EACH ROW EXECUTE FUNCTION public.trg_atend_produtos_estoque();

-- 9. RPC para ajuste manual de saldo
CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
  p_estoque_id uuid, p_novo_saldo numeric, p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_barb uuid;
BEGIN
  SELECT barbearia_id INTO v_barb FROM public.estoque WHERE id = p_estoque_id;
  IF v_barb IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  PERFORM public.aplicar_movimento_estoque(p_estoque_id, v_barb, 'ajuste',
    p_novo_saldo, NULL, 'ajuste_manual', NULL, COALESCE(p_motivo,'Ajuste manual'));
END $$;

GRANT EXECUTE ON FUNCTION public.ajustar_estoque_manual(uuid, numeric, text) TO authenticated;
