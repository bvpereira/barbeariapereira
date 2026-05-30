INSERT INTO public.integracoes (tipo, webhook_url)
SELECT 'ia_gerarimagem', 'https://n8n.servidorpereira.shop/webhook-test/ia_gerar imagem'
WHERE NOT EXISTS (
    SELECT 1 FROM public.integracoes WHERE tipo = 'ia_gerarimagem'
);