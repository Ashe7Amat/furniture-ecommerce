# Reservas por fechas: migraciones R1 y R2 (propuesta, sin aplicar)

Bloque R-a de `docs/reservas-diseno.md` (sección 11, pasos 1 a 3). **Nada de esto está aplicado.** Cuando se
aplique, cada migración se copia a `server/migrations/` con la versión real, como dice su `README.md`.

**Antes de aplicar hace falta el OK explícito de Ashe**, por separado para la prueba desechable y para cada
migración. Las decisiones que cambiaban la tabla ya están tomadas (13 oct 2026): no hay alquileres de menos de un
día, así que el calendario sigue por días, y los días se cobran en bloques de 24 h desde la hora de entrega, así
que cada alquiler guarda su hora de entrega y de recogida.

| Archivo | Qué hace |
|---|---|
| `r1_activar_btree_gist.sql` | Activa `btree_gist` en el esquema `extensions` (4.2). Hace falta para que la restricción de exclusión compare `uuid` |
| `r2_crear_reservas.sql` | La tabla `reservas` (3.2): columnas, CHECK por tipo, restricción de exclusión con margen, índices, RLS sin políticas y dos disparadores (`updated_at` y `fin_ocupacion` al devolver, 3.4) |
| `*.down.sql` | La reversión de cada una (R2 primero) |
| `r2_pruebas.sql` | La prueba desechable: los casos obligatorios del 4.3 y del 3.4 |

Con la tabla vacía, ninguno de los dos disparadores hace nada, y ningún código la lee ni la escribe todavía.

## Diferencias con el borrador del diseño

- **`hora_entrega` y `hora_recogida`** (`time`, hora de Madrid): obligatorias en los alquileres y vacías en
  bloqueos y ventas. Salen de la respuesta de Ashe a la pregunta 3 (días en bloques de 24 h desde la hora de
  entrega). Solo cuentan para el precio: el calendario se sigue ocupando por días, con el margen.
- El disparador de `fin_ocupacion` es `BEFORE INSERT OR UPDATE` (de cualquier columna) con
`WHEN (NEW.estado = 'devuelta' AND NEW.devuelta_en IS NOT NULL)`, en vez de `BEFORE UPDATE OF estado,
devuelta_en`. Así también cubre una reserva que se da de alta ya devuelta, y que alguien cambie
`fin_ocupacion` a mano en una reserva devuelta (el caso 8d de la prueba). Sigue tocando solo su propia fila.

## Comprobado en local (13 oct 2026, también después de añadir las horas)

Con PostgreSQL 16.15 y unas tablas `muebles`, `clientes` y `pedidos` mínimas (Supabase usa la 17.6):
- R1 + R2 + `r2_pruebas.sql` en una transacción terminan con el error a propósito `PRUEBA SUPERADA`, y
  después no queda ni la tabla ni la extensión.
- La prueba detecta los fallos: se rompió la migración de 9 formas (sin margen en el rango, sin el disparador,
  sin los `IS NOT NULL` de la CHECK, sin el índice de una provisional por cliente, con `devuelta` fuera de la
  restricción, con UTC en vez de hora de Madrid, sin `updated_at`, sin exigir las horas en un alquiler y
  aceptándolas en un bloqueo), y en cada una falló el caso que tocaba.
- R1 y R2 aplicadas de verdad, y después sus `.down.sql`: no queda ni la tabla, ni las funciones, ni la
  extensión.

## La prueba desechable contra la base real (paso 1 de R-a)

Comprueba en Supabase lo que la prueba local no puede: la versión 17.6, el esquema `extensions` y las tablas
reales. **No deja rastro:** no usa `DELETE`, no toca ninguna fila existente, y termina siempre con un error a
propósito que deshace todo, también la extensión y la tabla.

1. Con `execute_sql` del MCP de Supabase, **en una sola llamada**, el texto de `r1_activar_btree_gist.sql`,
   `r2_crear_reservas.sql` y `r2_pruebas.sql`, uno detrás de otro. Postgres ejecuta así todo en una sola
   transacción.
2. **Resultado bueno:** el error `PRUEBA SUPERADA`. Cualquier otro error es un fallo (`FALLO 1a`, etc.).
3. Después, solo lectura: `SELECT to_regclass('public.reservas'), (SELECT count(*) FROM pg_extension WHERE
   extname = 'btree_gist');` tiene que dar `null` y `0`.

Necesita dos muebles y dos clientes cualesquiera (hoy hay de sobra). Solo los lee.

## Comprobaciones después de aplicar R1 y R2

Solo lectura:

```sql
SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname = 'btree_gist';
-- btree_gist | extensions

SELECT count(*) FROM public.reservas;
-- 0

SELECT conname FROM pg_constraint WHERE conrelid = 'public.reservas'::regclass ORDER BY conname;
-- incluye reservas_sin_solape y las 8 CHECK con nombre

SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reservas'::regclass;
-- true
```

Después, con la tabla ya creada (y vacía), comprobar contra la base real que
`GET /api/muebles/<id>/disponibilidad` responde 200 con `ocupado: []`: confirma que PostgREST acepta el filtro
de rangos (`rango_ocupado=ov.[hoy,)`) que fija `queryContractReservas.test.js`. El contrato del `23P01` (4.3)
va con la primera escritura, en R-b.
