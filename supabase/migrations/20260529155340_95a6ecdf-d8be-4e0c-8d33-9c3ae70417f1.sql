INSERT INTO public.integracoes (tipo, webhook_url)
SELECT 'ia_codconsumi', 'https://n8n.servidorpereira.shop/webhook-test/ia_codiconsumi'
WHERE NOT EXISTS (SELECT 1 FROM public.integracoes WHERE tipo = 'ia_codconsumi');