-- Criar tabela de atendimentos
CREATE TABLE public.atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Agendado', 'Finalizado', 'Não compareceu')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de serviços do atendimento (muitos para muitos)
CREATE TABLE public.atendimento_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  valor_servico DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_servicos ENABLE ROW LEVEL SECURITY;

-- Políticas para atendimentos (Ajustar conforme a lógica de admin/nível de acesso do projeto)
CREATE POLICY "Permitir acesso total a atendimentos para usuários autenticados" 
ON public.atendimentos FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir acesso total a atendimento_servicos para usuários autenticados" 
ON public.atendimento_servicos FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_atendimentos_updated_at
BEFORE UPDATE ON public.atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
