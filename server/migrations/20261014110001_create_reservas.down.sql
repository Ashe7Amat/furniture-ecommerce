-- ADVERTENCIA: ejecutar esta reversión en producción borrará todas las reservas,
-- bloqueos y ventas registrados en la tabla `reservas`.
DROP TRIGGER IF EXISTS trg_sincronizar_fin_ocupacion_devuelta ON public.reservas;
DROP FUNCTION IF EXISTS public.sincronizar_fin_ocupacion_devuelta();
DROP TRIGGER IF EXISTS trg_reservas_updated_at ON public.reservas;
DROP FUNCTION IF EXISTS public.set_reservas_updated_at();
DROP TABLE IF EXISTS public.reservas CASCADE;
