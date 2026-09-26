-- ADVERTENCIA: B3 rellenó exactamente estos dos pedidos (comprobado el 26 sep 2026, antes y después
-- de aplicarla). Esta reversión solo los devuelve a NULL a ellos, por id, para no tocar los pedidos
-- nuevos cuyo cliente_id rellena el código al registrarlos. Aun así, no debería hacer falta: B3 es
-- idempotente y solo asigna la cuenta si el email coincide con exactamente una, así que lo normal
-- ante un problema es corregir hacia delante, no deshacer.
UPDATE public.pedidos SET cliente_id = NULL
WHERE id IN ('6c4314d3-814d-485a-92c0-29e983fde766', '421aa7cb-cd53-4e40-92d0-caaee4fbe2e1');
