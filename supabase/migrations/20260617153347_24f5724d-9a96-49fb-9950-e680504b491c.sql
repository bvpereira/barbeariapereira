UPDATE public.promocao h
SET promo_para_quem = d.promo_para_quem
FROM public.promocao d
WHERE h.numero_promo > 0
  AND h.promo_para_quem IS NULL
  AND d.numero_promo = 0
  AND d.barbearia_id = h.barbearia_id
  AND d.promo_para_quem IS NOT NULL;