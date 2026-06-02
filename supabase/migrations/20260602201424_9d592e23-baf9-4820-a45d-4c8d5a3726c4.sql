INSERT INTO public.informacoes (
  barbearia_id,
  user_id,
  usuario_id,
  email,
  google_avaliacao,
  imagem_1,
  imagem_2,
  imagem_3,
  imagem_4,
  imagem_5,
  imagem_6,
  imagem_7,
  imagem_8,
  imagem_logo,
  instancia_evo,
  tel_contato,
  tempo_excluir,
  tempo_marcar,
  userrr,
  video_local
)
SELECT 
  '139b84a5-baff-456f-91fb-f1a9a678319f', -- ID da barb1
  user_id,
  usuario_id,
  email,
  google_avaliacao,
  imagem_1,
  imagem_2,
  imagem_3,
  imagem_4,
  imagem_5,
  imagem_6,
  imagem_7,
  imagem_8,
  imagem_logo,
  instancia_evo,
  tel_contato,
  tempo_excluir,
  tempo_marcar,
  userrr,
  video_local
FROM public.informacoes 
WHERE barbearia_id = '01879baf-8f8b-4c3d-810f-7740b6432cd9'
LIMIT 1;