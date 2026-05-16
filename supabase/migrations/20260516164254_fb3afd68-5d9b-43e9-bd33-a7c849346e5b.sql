ALTER TABLE public.atendimentos ADD COLUMN IF NOT EXISTS pedido_exclusao BOOLEAN DEFAULT false;

-- Garantir que as políticas de RLS permitam a atualização da nova coluna
-- Como o sistema parece usar uma chave de API de serviço ou permissões amplas no frontend via Supabase client,
-- vamos apenas garantir que a coluna exista. Se houver políticas específicas, elas precisarão ser revisadas.
