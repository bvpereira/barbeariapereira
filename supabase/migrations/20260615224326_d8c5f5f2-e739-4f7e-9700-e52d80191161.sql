-- Corrige URLs das imagens do "/minhaconta" da barb0
-- Os arquivos reais estão na pasta do antigo user_id (978e8f2a-...), 
-- enquanto o DB apontava para uma pasta inexistente (dd3d7cbe-...).
UPDATE public.informacoes
SET
  imagem_1 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440347710.jpg',
  imagem_2 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440352162.jpg',
  imagem_3 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440357124.jpg',
  imagem_4 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440361210.jpg',
  imagem_5 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440365081.jpg',
  imagem_6 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440369781.jpg',
  imagem_7 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440373222.jpg',
  imagem_8 = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/1780440377217.jpg',
  imagem_logo = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/logos/978e8f2a-6432-4da7-a3f9-6eebc878dc35_1780431088764_mc_logo.png',
  video_local = 'https://iwuzpxaaqkmacfuohqla.supabase.co/storage/v1/object/public/informacoes_imagens/978e8f2a-6432-4da7-a3f9-6eebc878dc35/video_1780440383874_localizacao_barbearia_pereira_2222.mp4',
  foto_perfil = NULL
WHERE barbearia_id = '01879baf-8f8b-4c3d-810f-7740b6432cd9';