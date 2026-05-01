-- Remover políticas restritivas antigas
DROP POLICY IF EXISTS "Permitir acesso total a atendimentos para usuários autenticados" ON public.atendimentos;
DROP POLICY IF EXISTS "Permitir acesso total a atendimento_servicos para usuários autenticados" ON public.atendimento_servicos;

-- Criar novas políticas que permitem acesso total (ajustado para o fluxo do sistema atual)
CREATE POLICY "Acesso total atendimentos" ON public.atendimentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total atendimento_servicos" ON public.atendimento_servicos FOR ALL USING (true) WITH CHECK (true);
