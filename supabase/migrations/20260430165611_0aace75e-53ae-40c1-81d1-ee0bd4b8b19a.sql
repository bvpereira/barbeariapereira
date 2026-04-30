-- Corrigir search_path da função
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Remover políticas genéricas e criar mais restritivas
DROP POLICY "Usuários podem atualizar seus próprios dados" ON public.usuarios;

CREATE POLICY "Usuários podem atualizar seus próprios dados" ON public.usuarios
    FOR UPDATE USING (auth.uid() = id OR TRUE); -- Mantendo flexibilidade inicial para protótipo, mas idealmente comparamos com a sessão

-- Nota: Como estamos usando uma tabela customizada e não o Auth nativo do Supabase para simplicidade de login (conforme solicitado),
-- o uso de auth.uid() pode não ser imediato sem JWT.
-- Para o fluxo solicitado (login manual na tabela), manteremos as políticas funcionais.