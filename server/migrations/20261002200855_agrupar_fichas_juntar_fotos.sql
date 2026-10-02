-- Cada ficha principal recibe, tras las suyas, las fotos de las demás de su grupo (de la copia).
-- Referencias sin el prefijo "NAV-" para que la migración quepa en una llamada.
UPDATE public.muebles p SET
imagenes = p.imagenes || (SELECT array_agg(i.img ORDER BY o.n, i.n)
  FROM unnest(v.otras) WITH ORDINALITY o(ref, n)
  JOIN public.respaldo_agrupacion_muebles_20261002 x ON x.referencia = 'NAV-' || o.ref
  CROSS JOIN LATERAL unnest(x.imagenes) WITH ORDINALITY i(img, n)),
nombre = COALESCE(v.nombre, p.nombre)
FROM (VALUES
('PUE-003','{PUE-004,PUE-006,PUE-007,PUE-008,PUE-009}'::text[],NULL),
('ILU-001','{ILU-002,ILU-005}',NULL),
('OBJ-004','{OBJ-014}',NULL),
('OBJ-003','{OBJ-010}',NULL),
('OBJ-009','{OBJ-012,BID-022}',NULL),
('OBJ-011','{OBJ-016}',NULL),
('ILU-003','{ILU-004}','Lampara Globo Blanco Antigua'),
('JUG-001','{JUG-002,JUG-003,JUG-004,JUG-005}','Lote Coches Juguete'),
('OBJ-006','{OBJ-007}',NULL),
('OBJ-008','{OBJ-013}',NULL),
('SIL-003','{SIL-012}',NULL),
('SIL-008','{SIL-015}',NULL),
('BAU-014','{BAU-009}',NULL),
('BAU-019','{BAU-020,BAU-021}',NULL),
('BID-004','{BID-002,BID-006,BID-007,BID-012,BID-016,BID-018,BID-024,BID-001,BID-026}',NULL)
) AS v(principal, otras, nombre)
WHERE p.referencia = 'NAV-' || v.principal;