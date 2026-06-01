UPDATE public.agentes_ia 
SET imagem_imareferencia = NULL 
WHERE linha != 0;

UPDATE public.agentes_ia 
SET imagem_imareferencia = 'Sem imagem de referência' 
WHERE linha = 0;