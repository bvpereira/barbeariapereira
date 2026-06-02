-- Adicionar uma política para permitir que qualquer barbearia autenticada leia as integrações configuradas
-- (Caso já não exista uma política permissiva o suficiente)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'integracoes' 
        AND policyname = 'Permitir leitura de integrações por todos autenticados'
    ) THEN
        CREATE POLICY "Permitir leitura de integrações por todos autenticados" 
        ON public.integracoes 
        FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;
END $$;
