WITH ultimos AS (
  SELECT c.id AS categoria_id, c.codigo,
         COALESCE((SELECT max(substring(m2.referencia FROM '[0-9]+$')::int)
                   FROM public.muebles m2
                   WHERE m2.referencia LIKE 'NAV-' || c.codigo || '-%'), 0) AS ultimo
  FROM public.categorias c
  WHERE c.codigo IS NOT NULL
),
numerados AS (
  SELECT m.id, u.codigo,
         u.ultimo + row_number() OVER (PARTITION BY m.categoria_id ORDER BY m.created_at, m.id) AS n
  FROM public.muebles m
  JOIN ultimos u ON u.categoria_id = m.categoria_id
  WHERE m.referencia IS NULL
)
UPDATE public.muebles m
SET referencia = 'NAV-' || nu.codigo || '-' || CASE WHEN nu.n < 1000 THEN lpad(nu.n::text, 3, '0') ELSE nu.n::text END
FROM numerados nu
WHERE m.id = nu.id;