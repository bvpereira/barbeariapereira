INSERT INTO promocao (
  barbearia_id,
  data_promo,
  imagem_ia,
  imagem_promo,
  numero_promo,
  prompt_imagem,
  prompt_texto,
  testada,
  texto_ia,
  texto_promo,
  texto_promo_ia_2,
  texto_promo_ia_3
)
SELECT 
  '139b84a5-baff-456f-91fb-f1a9a678319f',
  data_promo,
  imagem_ia,
  imagem_promo,
  numero_promo,
  prompt_imagem,
  prompt_texto,
  testada,
  texto_ia,
  texto_promo,
  texto_promo_ia_2,
  texto_promo_ia_3
FROM promocao 
WHERE barbearia_id = '01879baf-8f8b-4c3d-810f-7740b6432cd9';