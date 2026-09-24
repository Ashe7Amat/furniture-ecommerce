-- ADVERTENCIA: solo para revertir A3 en un entorno de desarrollo/prueba
-- ANTES de que el código nuevo escriba datos. En producción, ejecutar esto
-- dejaría sin categoria_id también las filas creadas o editadas después de A3,
-- que ya dependen de este campo. La reversión correcta en producción es
-- restaurar un backup o, mejor, volver a ejecutar A3 hacia delante (es idempotente).
UPDATE public.muebles SET categoria_id = NULL WHERE categoria_id IS NOT NULL;
