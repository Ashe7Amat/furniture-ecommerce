# Propuesta: rellenar la referencia de los muebles existentes (A8)

**Estado: APLICADA el 2 oct 2026 a las 12:18 UTC, con autorización expresa del usuario.** Versión real
`20261002121823` (la asigna `apply_migration`; la `20261002115522` que figuraba en la propuesta era solo una
previsión). Copia en `server/migrations/20261002121823_backfill_muebles_referencia.sql` (y su `.down.sql`),
igual byte a byte que lo registrado: MD5 `85596bfc098e1d8a1e89cbff978a31a5`, 750 caracteres, sin salto de
línea final, como A1-A3. Resultado, en "Comprobaciones después de aplicarla".

## Por qué

Los 114 muebles actuales tienen `referencia` vacía: A1-A4 solo dan referencia a los muebles nuevos (ver
`docs/reporte-a5-a7.md`). Sin esto, el catálogo y el panel no enseñan ninguna referencia en las piezas que
ya hay.

## Cómo se aplica: el mismo patrón que A1-A3

A1-A3 se aplicaron con `apply_migration` de Supabase, y así están registradas (comprobado en solo lectura el
2 oct 2026): `schema_migrations` guarda solo la sentencia, en `statements`, sin `BEGIN`, `COMMIT` ni
`INSERT`. `apply_migration` envuelve el SQL en una transacción implícita (comprobado en la tarea 3, ver
`docs/tarea3-diseno.md`) y escribe la fila de `schema_migrations` por su cuenta. Así que:

- **No** se escribe `BEGIN; … INSERT INTO schema_migrations …; COMMIT;` a mano. Duplicaría el registro y la
  copia en `server/migrations/` dejaría de coincidir con lo registrado.
- Se aplica con `apply_migration`, con estos datos:
  - **version:** la asigna `apply_migration` con la hora de aplicación (quedó `20261002121823`)
  - **name:** `backfill_muebles_referencia`
  - **query:** el bloque de abajo, tal cual.
- Si algún día hubiera que lanzarlo a mano en el editor SQL de Supabase, sí habría que envolverlo en
  `BEGIN; … COMMIT;`. Pero entonces no quedaría registrado en `schema_migrations`, y se rompería el patrón.
  No se recomienda.

## La migración

Archivo: `server/migrations/20261002121823_backfill_muebles_referencia.sql`

```sql
WITH ultimos AS (
  SELECT c.id AS categoria_id, c.codigo,
         COALESCE((SELECT max(substring(m2.referencia FROM '[0-9]+$')::int)
                   FROM public.muebles m2
                   WHERE m2.referencia LIKE 'NAV-' || c.codigo || '-%'), 0) AS ultimo
  FROM public.categorias c
  WHERE c.codigo IS NOT NULL
),
numerados AS (
  SELECT m.id, u.codigo,
         u.ultimo + row_number() OVER (PARTITION BY m.categoria_id ORDER BY m.created_at, m.id) AS n
  FROM public.muebles m
  JOIN ultimos u ON u.categoria_id = m.categoria_id
  WHERE m.referencia IS NULL
)
UPDATE public.muebles m
SET referencia = 'NAV-' || nu.codigo || '-' || CASE WHEN nu.n < 1000 THEN lpad(nu.n::text, 3, '0') ELSE nu.n::text END
FROM numerados nu
WHERE m.id = nu.id;
```

Qué hace, línea a línea:
- **Solo toca los muebles sin referencia** (`referencia IS NULL`). Es idempotente: una segunda ejecución no
  cambia nada.
- **Numera por categoría y por antigüedad:** el mueble más antiguo de cada categoría (por `created_at`, y por
  `id` si dos tienen la misma fecha) se lleva 001.
- **Sigue la numeración que ya haya** (`ultimos`): si para entonces algún mueble nuevo ya tiene, por ejemplo,
  `NAV-SIL-003`, los existentes de esa categoría empiezan en 004. Hoy no hay ninguna, así que todos empiezan
  en 001. Es la misma regla que `calcularSiguienteReferencia`, y tampoco reutiliza huecos.
- **El formato es el del servidor:** `NAV-` + código + `-` + número con tres cifras (`padStart(3, '0')`). Con
  1000 o más, `lpad` cortaría el número; el `CASE` lo deja entero, igual que `padStart`. Hoy la categoría
  con más muebles tiene 28.
- **Usa `categoria_id`**, igual que el servidor al crear un mueble. Un mueble sin categoría, o de una categoría
  sin código, se queda sin referencia. Hoy no hay ninguno.
- **Si choca con el índice único** (por ejemplo, si alguien crea un mueble justo a la vez con la versión del
  servidor que ya genera referencias), la transacción entera falla y no se cambia nada. Se vuelve a lanzar
  sin más, porque es idempotente.

## Simulacro (solo lectura, 2 oct 2026)

La misma consulta, cambiando el `UPDATE` por un `SELECT` agrupado, contra la base real:

| Código | Muebles | Números |
|--------|---------|---------|
| BAU | 21 | 001-021 |
| BID | 28 | 001-028 |
| ILU | 5 | 001-005 |
| JUG | 5 | 001-005 |
| MES | 13 | 001-013 |
| OBJ | 16 | 001-016 |
| PLA | 2 | 001-002 |
| PUE | 9 | 001-009 |
| SIL | 15 | 001-015 |
| **Total** | **114** | sin repetidos en ninguna categoría |

- Muebles sin referencia: 114. Se rellenarían los 114.
- Sin categoría o con una categoría sin código: 0.
- Sin `created_at`: 0.
- MOB, DEC y PIE (las categorías generales) no tienen muebles y no salen.

## Reversión

Archivo: `server/migrations/20261002121823_backfill_muebles_referencia.down.sql`

```sql
-- ADVERTENCIA: borra TODAS las referencias de muebles, también las que el servidor haya dado después
-- (A4). Solo para desarrollo/prueba. En producción, la reversión correcta es restaurar un backup, o no
-- revertir: las referencias no se pueden "deshacer" una vez enseñadas al público.
UPDATE public.muebles SET referencia = NULL;
```

Es el mismo criterio que el `.down.sql` de A3: una reversión global con advertencia, porque, una vez aplicada,
no se distingue una referencia del relleno de una dada después por el servidor.

## Comprobaciones después de aplicarla (solo lectura)

```sql
-- 1. Ningún mueble sin referencia (esperado: 0)
SELECT count(*) FROM public.muebles WHERE referencia IS NULL;

-- 2. Por código: cuántos y hasta qué número (esperado: la tabla del simulacro)
SELECT split_part(referencia, '-', 2) AS codigo, count(*), min(referencia), max(referencia)
FROM public.muebles GROUP BY 1 ORDER BY 1;

-- 3. Cada referencia con el código de su categoría (esperado: 0)
SELECT count(*) FROM public.muebles m JOIN public.categorias c ON c.id = m.categoria_id
WHERE split_part(m.referencia, '-', 2) <> c.codigo;

-- 4. El formato (esperado: 0)
SELECT count(*) FROM public.muebles WHERE referencia !~ '^NAV-[A-Z]{3}-[0-9]{3,}$';

-- 5. Registrada en schema_migrations, y su texto igual al del archivo
SELECT version, name, md5(array_to_string(statements, '')) FROM supabase_migrations.schema_migrations
WHERE name = 'backfill_muebles_referencia';
```

**Resultado (2 oct 2026, 12:18 UTC, todas en solo lectura):**
- Simulacro repetido justo antes: igual que el de la propuesta (114 muebles, 9 categorías, sin repetidos, 0 fuera).
- 1. Muebles sin referencia: **0** (de 114).
- 2. Por código: BAU 21 (001-021), BID 28 (001-028), ILU 5 (001-005), JUG 5 (001-005), MES 13 (001-013),
  OBJ 16 (001-016), PLA 2 (001-002), PUE 9 (001-009), SIL 15 (001-015). **Igual que el simulacro.** 114
  referencias distintas.
- 3. Referencias con un código distinto del de su categoría: **0**.
- 4. Referencias con formato incorrecto: **0**.
- 5. Registrada como `20261002121823` / `backfill_muebles_referencia`, con 1 sentencia y MD5
  `85596bfc098e1d8a1e89cbff978a31a5`: **el mismo** que el del archivo copiado a `server/migrations/`.

## Orden respecto al despliegue

Se puede aplicar antes o después de desplegar A4-A7, y en cualquier caso es seguro:
- **Antes** (lo recomendado): el código que está ahora en producción no lee `referencia`, así que no cambia
  nada visible. Al desplegar A6, el catálogo ya sale con todas las referencias.
- **Después:** mientras tanto, los muebles nuevos ya tendrían referencia (y el relleno seguiría su
  numeración, ver `ultimos`), y los antiguos saldrían sin ella hasta aplicarlo.
