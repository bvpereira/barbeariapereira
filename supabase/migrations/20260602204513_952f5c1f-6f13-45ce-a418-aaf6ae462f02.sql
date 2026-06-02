-- Remover o índice de unicidade global na coluna 'data'
ALTER TABLE public.dias_agenda DROP CONSTRAINT IF EXISTS dias_agenda_data_key;

-- Criar um novo índice de unicidade composto por 'data' e 'barbearia_id'
-- Isso permite que o mesmo dia exista para diferentes barbearias, mas não duplicado na mesma barbearia.
ALTER TABLE public.dias_agenda ADD CONSTRAINT dias_agenda_data_barbearia_unique UNIQUE (data, barbearia_id);
