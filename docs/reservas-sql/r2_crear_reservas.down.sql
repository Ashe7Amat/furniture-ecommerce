-- ADVERTENCIA: borra la tabla y con ella todas las reservas. Mientras ningún código escriba en ella
-- (bloque R-a), está vacía y no tiene efecto. Después de R-b, antes hay que retirar ese código y
-- decidir qué se hace con las reservas que haya: borrarlas es perder contratos.
DROP TABLE public.reservas;
DROP FUNCTION public.reservas_actualizar_updated_at();
DROP FUNCTION public.reservas_fin_ocupacion_al_devolver();
