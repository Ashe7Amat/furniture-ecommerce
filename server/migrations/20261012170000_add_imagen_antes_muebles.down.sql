-- ADVERTENCIA: borra la columna y con ella las fotos de antes que se hayan puesto desde el panel (los
-- archivos siguen en Storage, pero ninguna pieza los enlaza). Antes hay que retirar el código que la lee:
-- sin la columna, las lecturas públicas de muebles (COLUMNAS_PUBLICAS_MUEBLE) fallan y el catálogo no carga.
ALTER TABLE public.muebles DROP COLUMN imagen_antes;
