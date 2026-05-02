-- Criar enum para tipos de transação se necessário, ou usar TEXT com check constraint
CREATE TYPE tipo_transacao AS ENUM ('receita', 'despesa');

-- Criar tabela de transações financeiras
CREATE TABLE public.transacoes_financeiras (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo tipo_transacao NOT NULL,
    categoria TEXT NOT NULL, -- Ex: 'Atendimento', 'Gasto Fixo', 'Comissão', 'Salário'
    descricao TEXT,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    data TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    referencia_id UUID, -- ID opcional para linkar com atendimentos ou gastos específicos
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para usuários autenticados" 
ON public.transacoes_financeiras FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" 
ON public.transacoes_financeiras FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização para usuários autenticados" 
ON public.transacoes_financeiras FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Permitir exclusão para usuários autenticados" 
ON public.transacoes_financeiras FOR DELETE 
TO authenticated 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_transacoes_financeiras_updated_at
BEFORE UPDATE ON public.transacoes_financeiras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Se a tabela de gastos já existe, podemos migrar os dados ou integrá-la. 
-- Para manter a simplicidade e persistência solicitada, vamos garantir que gastos e atendimentos alimentem essa visão ou que ela seja a fonte da verdade.
