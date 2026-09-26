UPDATE public.pedidos p SET cliente_id = c.id
FROM public.clientes c
WHERE p.cliente_id IS NULL
  AND lower(p.cliente_info->>'email') = lower(c.email)
  AND (SELECT count(*) FROM public.clientes c2 WHERE lower(c2.email) = lower(c.email)) = 1;
