-- Copia de las 52 fichas que la agrupación cambia o borra. RLS sin políticas: solo la lee el servidor.
CREATE TABLE public.respaldo_agrupacion_muebles_20261002 AS
SELECT now() AS respaldado_en, m.* FROM public.muebles m
WHERE m.referencia IN ('NAV-PUE-003', 'NAV-ILU-001', 'NAV-OBJ-004', 'NAV-OBJ-003', 'NAV-OBJ-009', 'NAV-OBJ-011', 'NAV-ILU-003', 'NAV-JUG-001', 'NAV-OBJ-006', 'NAV-OBJ-008', 'NAV-SIL-003', 'NAV-SIL-008', 'NAV-BAU-014', 'NAV-BAU-019', 'NAV-BID-004', 'NAV-PUE-004', 'NAV-PUE-006', 'NAV-PUE-007', 'NAV-PUE-008', 'NAV-PUE-009', 'NAV-ILU-002', 'NAV-ILU-005', 'NAV-OBJ-014', 'NAV-OBJ-010', 'NAV-OBJ-012', 'NAV-BID-022', 'NAV-OBJ-016', 'NAV-ILU-004', 'NAV-JUG-002', 'NAV-JUG-003', 'NAV-JUG-004', 'NAV-JUG-005', 'NAV-OBJ-007', 'NAV-OBJ-013', 'NAV-SIL-012', 'NAV-SIL-015', 'NAV-BAU-009', 'NAV-BAU-020', 'NAV-BAU-021', 'NAV-BID-002', 'NAV-BID-006', 'NAV-BID-007', 'NAV-BID-012', 'NAV-BID-016', 'NAV-BID-018', 'NAV-BID-024', 'NAV-BID-001', 'NAV-BID-026', 'NAV-MES-001', 'NAV-MES-003', 'NAV-MES-002', 'NAV-MES-009');
ALTER TABLE public.respaldo_agrupacion_muebles_20261002 ENABLE ROW LEVEL SECURITY;
DO 'BEGIN
  IF (SELECT count(*) FROM public.respaldo_agrupacion_muebles_20261002) <> 52 THEN
    RAISE EXCEPTION ''Faltan fichas de la agrupación: no se cambia nada.'';
  END IF;
END';