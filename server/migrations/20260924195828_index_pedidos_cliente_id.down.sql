-- ADVERTENCIA: pensado para desarrollo/prueba. Borrar el índice no pierde datos, pero en producción
-- las consultas por cliente_id pasarían a recorrer la tabla entera. Si hay que revertir B1, este
-- va primero (el índice depende de la columna).
DROP INDEX idx_pedidos_cliente_id;
