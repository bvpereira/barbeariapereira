-- Adiciona uma restrição de unicidade na coluna 'tipo' para evitar duplicatas e permitir upserts seguros
ALTER TABLE public.integracoes ADD CONSTRAINT integracoes_tipo_key UNIQUE (tipo);