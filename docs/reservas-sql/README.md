# Reservas por fechas: migraciones R1 y R2 (aplicadas el 19 oct 2026)

Bloque R-a de `docs/reservas-diseno.md` (sección 11, pasos 1 a 3). **La tabla `reservas` de la R2 está aplicada
en producción desde el 19 oct 2026**, vacía y sin ningún código encendido que la use (los interruptores
`RESERVAS_ACTIVAS` y `VITE_RESERVAS_ACTIVAS` siguen apagados). Su copia está en `server/migrations/`, como dice
su `README.md`.

## Cómo se aplicó (19 oct 2026), con el OK escrito de Ashe

Al ir a aplicar R1 y R2 se encontró que **la base de producción ya tenía una tabla `reservas`**: dos migraciones
del 14 oct (`20261014110000 enable_btree_gist` y `20261014110001 create_reservas`), sin autor en
`schema_migrations` y con el texto en ninguna rama del repositorio. Era un borrador anterior de la R2: vacía, sin
`hora_entrega` ni `hora_recogida` (que usa todo el código de los bloques R-a a R-d), con otras restricciones,
índices y funciones, y el disparador de la devolución solo en `UPDATE`. El código nuevo habría fallado al
encender los interruptores.

- **R1:** no hizo falta aplicarla; `btree_gist` ya estaba activada en el esquema `extensions` (la migración
  `20261014110000` es el mismo `CREATE EXTENSION IF NOT EXISTS` de `r1_activar_btree_gist.sql`).
- **R2:** la migración `20261019233700 reemplazar_borrador_reservas_por_r2` renombra la tabla del borrador a
  `reservas_borrador` (y sus restricciones `reservas_pkey` y `reservas_sin_solape`, para liberar los nombres de
  los índices) y crea la tabla de `r2_crear_reservas.sql`. **No se borró la vieja porque el MCP de Supabase se
  cuelga con cualquier `DROP`** (incluso uno que no hace nada): queda `reservas_borrador`, vacía y con RLS, junto
  con sus dos funciones (`set_reservas_updated_at` y `sincronizar_fin_ocupacion_devuelta`). Ashe puede borrarlas
  desde el panel de Supabase cuando quiera; nada las usa.
- **Prueba desechable antes:** el texto de la migración más `r2_pruebas.sql` en una sola llamada a `execute_sql`
  terminó con el error `PRUEBA SUPERADA` y, después, la tabla del borrador, las 27 migraciones y las funciones
  seguían como estaban.
- **Después de aplicar** (solo lectura): MD5 de lo registrado igual al del archivo
  (`cec5d329ed7802b5900d5effa3c382af`); `btree_gist` en `extensions`; 0 filas en `reservas` y en
  `reservas_borrador`; RLS activada en las dos; 44 columnas, con `hora_entrega` y `hora_recogida`; las 8 CHECK con
  nombre, `reservas_sin_solape` y `reservas_sesion_mueble_key`; los índices de la R2; los dos disparadores
  (`trg_reservas_updated_at` y `trg_reservas_fin_ocupacion_al_devolver`); y el filtro de rangos de la
  disponibilidad (`rango_ocupado && '[hoy,)'`) da 0 filas para una pieza real.
- **Sin comprobar todavía:** `GET /api/muebles/<id>/disponibilidad` contra la API real. El despliegue de prueba
  de la rama no tiene `SUPABASE_SERVICE_ROLE_KEY` (cae al arrancar, también en rutas que no tocan reservas) y
  este entorno no puede llegar a Supabase desde fuera. Se comprobará al desplegar a `main`, o en un Preview con
  las claves: tiene que responder 200 con `ocupado: []`.
- **Detalle sin importancia:** mientras exista `reservas_borrador`, Postgres puso a las CHECK automáticas de la
  tabla nueva el sufijo `1` (`reservas_tipo_check1`, `reservas_estado_check1`...), porque sus nombres de siempre
  los tiene la vieja. Ningún código depende de esos nombres. Si se quiere, tras borrar la vieja se pueden
  renombrar con `ALTER TABLE ... RENAME CONSTRAINT`.

Lo que sigue valiendo del plan original: **todo cambio en producción pide el OK escrito de Ashe**, por separado
para la prueba desechable y para cada migración. Las decisiones que cambiaban la tabla ya estaban tomadas
(13 oct 2026): no hay alquileres de menos de un día, así que el calendario sigue por días, y los días se cobran
en bloques de 24 h desde la hora de entrega, así que cada alquiler guarda su hora de entrega y de recogida.

| Archivo | Qué hace |
|---|---|
| `r1_activar_btree_gist.sql` | Activa `btree_gist` en el esquema `extensions` (4.2). Hace falta para que la restricción de exclusión compare `uuid` |
| `r2_crear_reservas.sql` | La tabla `reservas` (3.2): columnas, CHECK por tipo, restricción de exclusión con margen, índices, RLS sin políticas y dos disparadores (`updated_at` y `fin_ocupacion` al devolver, 3.4) |
| `*.down.sql` | La reversión de cada una (R2 primero) |
| `r2_pruebas.sql` | La prueba desechable: los casos obligatorios del 4.3 y del 3.4 |

Con la tabla vacía, ninguno de los dos disparadores hace nada. En `main` ningún código la lee ni la escribe
todavía. En `feature/mejoras-tecnicas` la leen los endpoints de disponibilidad y la compra (paso 9), y solo
escriben en ella las reservas detrás de los interruptores, además de la fila de venta de cada compra pagada.
**Por eso `main` no debe recibir ese código antes de que esta tabla esté en producción, como ya lo está.**

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
- 19 oct: con los casos 6b a 6d (la venta repetida de una sesión da `23P01` mientras ocupa y `23505` ya
  cancelada, y una pieza que no existe da `23503`), la prueba sigue terminando en `PRUEBA SUPERADA`, y con la
  unicidad creada antes que la exclusión falla en el caso 6b.

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

El 19 oct 2026 se hizo así, pero con los tres `ALTER TABLE ... RENAME` de la migración
`20261019233700` delante del texto de R2 (la tabla `reservas` ya existía): `PRUEBA SUPERADA` y, después, nada
había cambiado. Ojo con una trampa: el MCP de Supabase se cuelga 60 s con cualquier `DROP` (también uno que no
hace nada), así que una prueba o una migración con `DROP` no se puede lanzar desde aquí.

## Comprobaciones después de aplicar R1 y R2

El resultado del 19 oct 2026 está en la sección «Cómo se aplicó», arriba. Solo lectura:

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
