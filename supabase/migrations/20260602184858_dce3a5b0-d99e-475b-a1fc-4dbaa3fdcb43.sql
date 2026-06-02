-- 1. Criar a tabela de barbearias
CREATE TABLE public.barbearias (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Conceder permissões para a nova tabela
GRANT SELECT ON public.barbearias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbearias TO authenticated;
GRANT ALL ON public.barbearias TO service_role;

-- 3. Habilitar RLS na tabela barbearias
ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Barbearias são visíveis por todos" ON public.barbearias FOR SELECT USING (true);

-- 4. Criar a barbearia inicial (tenant padrão)
INSERT INTO public.barbearias (nome, slug) VALUES ('Barbearia Pereira', 'barb0');

-- 5. Adicionar a coluna barbearia_id em todas as tabelas
-- Pegamos o ID da barbearia criada acima
DO $$ 
DECLARE 
    default_id UUID;
BEGIN
    SELECT id INTO default_id FROM public.barbearias WHERE slug = 'barb0';

    -- Lista de tabelas para atualizar
    -- usuarios, servicos, transacoes_financeiras, promocao, colaboradores, colaborador_servicos, dias_agenda, horarios_colaboradores, informacoes, gastos, atendimentos, atendimento_servicos, integracoes, agentes_ia
    
    -- Tabela usuarios
    ALTER TABLE public.usuarios ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.usuarios SET barbearia_id = default_id;
    ALTER TABLE public.usuarios ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_usuarios_barbearia_id ON public.usuarios(barbearia_id);

    -- Tabela servicos
    ALTER TABLE public.servicos ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.servicos SET barbearia_id = default_id;
    ALTER TABLE public.servicos ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_servicos_barbearia_id ON public.servicos(barbearia_id);

    -- Tabela transacoes_financeiras
    ALTER TABLE public.transacoes_financeiras ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.transacoes_financeiras SET barbearia_id = default_id;
    ALTER TABLE public.transacoes_financeiras ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_transacoes_barbearia_id ON public.transacoes_financeiras(barbearia_id);

    -- Tabela promocao
    ALTER TABLE public.promocao ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.promocao SET barbearia_id = default_id;
    ALTER TABLE public.promocao ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_promocao_barbearia_id ON public.promocao(barbearia_id);

    -- Tabela colaboradores
    ALTER TABLE public.colaboradores ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.colaboradores SET barbearia_id = default_id;
    ALTER TABLE public.colaboradores ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_colaboradores_barbearia_id ON public.colaboradores(barbearia_id);

    -- Tabela colaborador_servicos
    ALTER TABLE public.colaborador_servicos ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.colaborador_servicos SET barbearia_id = default_id;
    ALTER TABLE public.colaborador_servicos ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_colaborador_servicos_barbearia_id ON public.colaborador_servicos(barbearia_id);

    -- Tabela dias_agenda
    ALTER TABLE public.dias_agenda ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.dias_agenda SET barbearia_id = default_id;
    ALTER TABLE public.dias_agenda ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_dias_agenda_barbearia_id ON public.dias_agenda(barbearia_id);

    -- Tabela horarios_colaboradores
    ALTER TABLE public.horarios_colaboradores ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.horarios_colaboradores SET barbearia_id = default_id;
    ALTER TABLE public.horarios_colaboradores ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_horarios_colab_barbearia_id ON public.horarios_colaboradores(barbearia_id);

    -- Tabela informacoes
    ALTER TABLE public.informacoes ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.informacoes SET barbearia_id = default_id;
    ALTER TABLE public.informacoes ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_informacoes_barbearia_id ON public.informacoes(barbearia_id);

    -- Tabela gastos
    ALTER TABLE public.gastos ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.gastos SET barbearia_id = default_id;
    ALTER TABLE public.gastos ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_gastos_barbearia_id ON public.gastos(barbearia_id);

    -- Tabela atendimentos
    ALTER TABLE public.atendimentos ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.atendimentos SET barbearia_id = default_id;
    ALTER TABLE public.atendimentos ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_atendimentos_barbearia_id ON public.atendimentos(barbearia_id);

    -- Tabela atendimento_servicos
    ALTER TABLE public.atendimento_servicos ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.atendimento_servicos SET barbearia_id = default_id;
    ALTER TABLE public.atendimento_servicos ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_atendimento_servicos_barbearia_id ON public.atendimento_servicos(barbearia_id);

    -- Tabela integracoes
    ALTER TABLE public.integracoes ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.integracoes SET barbearia_id = default_id;
    ALTER TABLE public.integracoes ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_integracoes_barbearia_id ON public.integracoes(barbearia_id);

    -- Tabela agentes_ia
    ALTER TABLE public.agentes_ia ADD COLUMN barbearia_id UUID REFERENCES public.barbearias(id);
    UPDATE public.agentes_ia SET barbearia_id = default_id;
    ALTER TABLE public.agentes_ia ALTER COLUMN barbearia_id SET NOT NULL;
    CREATE INDEX idx_agentes_ia_barbearia_id ON public.agentes_ia(barbearia_id);

END $$;

-- 6. Atualizar a constraint UNIQUE de login em usuarios para ser composta (login + barbearia_id)
-- Isso permite o mesmo telefone em barbearias diferentes
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_login_key;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_login_barbearia_unique UNIQUE (login, barbearia_id);

-- 7. Atualizar triggers de data se necessário (assumindo que já existem funções genéricas)
-- Nenhuma alteração necessária nas funções de timestamp se forem genéricas.
