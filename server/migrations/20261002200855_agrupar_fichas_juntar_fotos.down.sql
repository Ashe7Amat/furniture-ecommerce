-- ADVERTENCIA: devuelve a las 15 fichas principales las fotos y el nombre que tenían antes de juntar
-- (desde la copia de seguridad). Si después se han editado en el panel, esos cambios se pierden.
UPDATE public.muebles m
SET imagenes = r.imagenes, nombre = r.nombre
FROM public.respaldo_agrupacion_muebles_20261002 r
WHERE m.id = r.id;