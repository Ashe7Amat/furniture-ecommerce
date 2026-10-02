-- ADVERTENCIA: borra TODAS las referencias de muebles, también las que el servidor haya dado después
-- (A4). Solo para desarrollo/prueba. En producción, la reversión correcta es restaurar un backup, o no
-- revertir: las referencias no se pueden "deshacer" una vez enseñadas al público.
UPDATE public.muebles SET referencia = NULL;
