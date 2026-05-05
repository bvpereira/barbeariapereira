DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'informacoes' AND column_name = 'whatsapp') THEN
        ALTER TABLE public.informacoes DROP COLUMN whatsapp;
    END IF;
END $$;

-- Comentário para forçar atualização do cache do PostgREST
COMMENT ON TABLE public.informacoes IS 'Tabela de informações do sistema - Atualizada em 2026-05-05';