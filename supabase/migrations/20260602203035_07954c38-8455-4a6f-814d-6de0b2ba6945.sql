INSERT INTO public.agentes_ia (
  barbearia_id,
  imagem_campanha,
  imagem_comlogo,
  imagem_criada_ia,
  imagem_estilovisual,
  imagem_formato,
  imagem_imareferencia,
  imagem_informacoes,
  imagem_objetivo,
  linha,
  prompt_imagem
)
SELECT 
  '139b84a5-baff-456f-91fb-f1a9a678319f' as barbearia_id,
  imagem_campanha,
  imagem_comlogo,
  imagem_criada_ia,
  imagem_estilovisual,
  imagem_formato,
  imagem_imareferencia,
  imagem_informacoes,
  imagem_objetivo,
  linha,
  prompt_imagem
FROM public.agentes_ia
WHERE barbearia_id = '01879baf-8f8b-4c3d-810f-7740b6432cd9'
LIMIT 1;