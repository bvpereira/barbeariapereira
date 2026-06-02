-- Update barb0 info ownership
UPDATE public.informacoes 
SET user_id = 'dd3d7cbe-7131-4a6a-b930-ec8070dea4b1', 
    usuario_id = 'dd3d7cbe-7131-4a6a-b930-ec8070dea4b1' 
WHERE barbearia_id = '01879baf-8f8b-4c3d-810f-7740b6432cd9';

-- Update barb1 info ownership
UPDATE public.informacoes 
SET user_id = '978e8f2a-6432-4da7-a3f9-6eebc878dc35', 
    usuario_id = '978e8f2a-6432-4da7-a3f9-6eebc878dc35' 
WHERE barbearia_id = '139b84a5-baff-456f-91fb-f1a9a678319f';