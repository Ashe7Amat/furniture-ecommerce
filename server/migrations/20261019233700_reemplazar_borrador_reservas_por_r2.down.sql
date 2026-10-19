-- ADVERTENCIA: borra la tabla reservas de la R2 y con ella todas las reservas que haya. Solo tiene sentido
-- mientras la tabla siga vacía (o sin reservas reales). Después devuelve el nombre `reservas` a la tabla del
-- borrador anterior (20261014110001), que faltará si ya se borró `reservas_borrador`: en ese caso, no ejecutar
-- los tres últimos ALTER. El MCP de Supabase se cuelga con cualquier DROP: hay que ejecutarlo en el SQL
-- Editor, y entonces no queda registrado en schema_migrations.
DROP TABLE public.reservas;
DROP FUNCTION public.reservas_actualizar_updated_at();
DROP FUNCTION public.reservas_fin_ocupacion_al_devolver();
ALTER TABLE public.reservas_borrador RENAME TO reservas;
ALTER TABLE public.reservas RENAME CONSTRAINT reservas_borrador_pkey TO reservas_pkey;
ALTER TABLE public.reservas RENAME CONSTRAINT reservas_borrador_sin_solape TO reservas_sin_solape;
