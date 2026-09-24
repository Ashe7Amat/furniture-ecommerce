-- ADVERTENCIA: solo para revertir B1 en un entorno de desarrollo/prueba. En producción, en cuanto
-- el código de la migración B o el backfill B3 hayan rellenado cliente_id, borrar la columna pierde
-- el vínculo de cada pedido con su cuenta. Si algo falla, se corrige hacia delante: la columna
-- admite NULL y el código que no la conoce la ignora.
ALTER TABLE public.pedidos DROP COLUMN cliente_id;
