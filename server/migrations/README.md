# Migraciones de la base de datos

Copia en el repositorio de cada migración aplicada a la base de datos de Supabase (proyecto
`gdrmpxcpucmaxvtpljge`). La lista oficial es la tabla `supabase_migrations.schema_migrations`, donde
`apply_migration` registra cada una. Aquí está la misma lista, para revisarla en el diff y para saber qué se
ha hecho sin consultar la base de datos.

A 5 oct 2026 hay **23 migraciones registradas y las 23 están aquí**. Las 7 primeras (3-5 sep) se recuperaron
de `schema_migrations` el 5 oct, solo leyendo (H38 de `docs/mejoras-tecnicas.md`).

## Convención

- **Nombre:** `YYYYMMDDHHMMSS_nombre.sql`, con la `version` y el `name` de `schema_migrations`. La versión la
  pone `apply_migration` con la hora en que se aplica (UTC). Por eso la versión de una propuesta solo es una
  previsión, y el archivo se renombra con la versión real después de aplicarla.
- **Contenido:** copia exacta de lo que registra `schema_migrations` en `statements`, byte a byte (mismo MD5).
  Sin `BEGIN`/`COMMIT` ni `INSERT INTO schema_migrations`: `apply_migration` mete el SQL en una transacción y
  escribe el registro por su cuenta (ver `docs/tarea3-diseno.md`). Si lo registrado no acaba en salto de
  línea, el archivo tampoco.
- **`.down.sql`:** la reversión, escrita a mano, cuando tiene sentido. Lleva un comentario `ADVERTENCIA` si
  en producción no conviene ejecutarla (por ejemplo, porque borraría datos escritos después) y explica cómo
  corregir hacia delante. Se ejecuta solo si hace falta, y con el mismo permiso explícito que la migración.
- **Las 7 recuperadas no tienen `.down.sql`:** son historia. El estado de antes no consta en el repositorio
  (por ejemplo, qué políticas había antes de activar RLS). Escribir su reversión sería inventarla, y
  algunas no se pueden revertir: la limpieza del 5 sep borró columnas.

### Dos excepciones de antes de la convención (no se tocan)

Son copias anteriores a la regla de "byte a byte". El texto es el mismo, pero los bytes no:

| Archivos | Diferencia | Cómo se comprueba |
|---|---|---|
| Las 10 de `20260922115443` a `20261001212500` | El archivo tiene un salto de línea final que lo registrado no tiene | El MD5 coincide quitando ese último `\n` |
| `20261001220000_backfill_categorias_codigo.sql` (A3) | Se aplicó con fines de línea de Windows (`\r\n`), y el repositorio guarda `\n` | El MD5 coincide cambiando `\n` por `\r\n` y quitando el último |

La segunda no se puede arreglar en el archivo: `.gitattributes` (`* text=auto eol=lf`) guarda todo el texto
con `\n`. Las 5 desde `20261002121823` (y las 7 recuperadas) coinciden tal cual.

## Cómo se aplica una migración nueva

1. Propuesta en `docs/` con el SQL, la reversión y las comprobaciones de antes y después.
2. **Autorización explícita del usuario**, migración por migración.
3. Se aplica con `apply_migration` (servidor MCP de Supabase): `name` el nombre en minúsculas con guiones
   bajos, y `query` el contenido del archivo tal cual.
4. Se lee la versión que ha puesto (consulta de abajo), se renombra el archivo con ella y se comprueba el MD5.

**Nunca desde el SQL Editor de Supabase:** lo que se ejecuta ahí no queda en `schema_migrations`, y el
repositorio deja de reflejar la base de datos. Pasó una vez, con el último paso de la agrupación de fichas
(2 oct): `apply_migration` se colgaba con aquel `DELETE`, y se ejecutó en el editor. Está apuntado en
`docs/agrupar-fichas-propuesta.md`.

`CREATE INDEX CONCURRENTLY` no funciona con `apply_migration`, porque va dentro de una transacción. Se usa
`CREATE INDEX` normal: en estas tablas tarda milisegundos (`docs/tarea3-diseno.md`).

## Cómo comprobar que el repositorio y la base de datos coinciden

En la base de datos (solo lectura):

```sql
SELECT version, name, md5(array_to_string(statements, '')) AS md5
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

En el repositorio, desde `server/migrations/` (aplica las dos excepciones de arriba):

```bash
node <<'FIN'
const fs = require('fs'), md5 = (t) => require('crypto').createHash('md5').update(t).digest('hex');
for (const f of fs.readdirSync('.').filter((f) => /^\d{14}_.*\.sql$/.test(f) && !f.endsWith('.down.sql')).sort()) {
  const v = f.slice(0, 14);
  let t = fs.readFileSync(f, 'utf8');
  if (v === '20261001220000') t = t.replace(/\n/g, '\r\n').slice(0, -2); // A3: \r\n, sin el último
  else if (v >= '20260922115443' && v <= '20261001212500') t = t.slice(0, -1); // sin el \n final
  console.log(v, md5(t), f.slice(15, -4));
}
FIN
```

Las dos listas tienen que ser iguales. Así estaban el 5 oct 2026:

| Versión | Nombre | MD5 registrado | Archivo |
|---|---|---|---|
| 20260903091725 | `enable_rls_public_read_only` | `ef36cdee2a40abbb0eb9e8baba038a8b` | tal cual (recuperada) |
| 20260903121124 | `sync_disponible_from_estado_trigger` | `d8cade35d1568dd3c213b6e32b3ce7c2` | tal cual (recuperada) |
| 20260903121150 | `fix_search_path_sync_disponible_trigger` | `d1d5222833d8058300d429d153c59ce3` | tal cual (recuperada) |
| 20260904124456 | `add_categoria_padre_id` | `7b53f4a49afd6705f567783d1d45ffcb` | tal cual (recuperada) |
| 20260904152538 | `pedidos_soporte_checkout_multiproducto` | `17444db797c47f958adf5dca6bd26bf8` | tal cual (recuperada) |
| 20260905131103 | `cleanup_pedidos_phantom_columns_and_indexes` | `47b18feca2d43b62f59fbacbe3b31909` | tal cual (recuperada) |
| 20260905131118 | `move_http_extension_out_of_public` | `922e774012843f4b47cd6ce3a54e5c09` | tal cual (recuperada) |
| 20260922115443 | `add_muebles_categoria_id` | `894e57b32a057e7bda741ca286f56ce3` | sin el `\n` final |
| 20260922115825 | `index_muebles_categoria_id` | `278c0a9fe4874b97617c910b2371d613` | sin el `\n` final |
| 20260924133146 | `backfill_muebles_categoria_id` | `e0d9f25b36f18c0dac35e1f9116db0d1` | sin el `\n` final |
| 20260924195451 | `fix_pedidos_admin_policy` | `9b00fb67278dc62f13dcf54826e83a3d` | sin el `\n` final |
| 20260924195820 | `add_pedidos_cliente_id` | `c9e159e7ba156ef1703361f456b76fd4` | sin el `\n` final |
| 20260924195828 | `index_pedidos_cliente_id` | `e4a8b75e824136eebf8172c612aa8aa8` | sin el `\n` final |
| 20260926192617 | `backfill_pedidos_cliente_id` | `9d37d74ad4d577e03c65e12fb79afbf0` | sin el `\n` final |
| 20260926193731 | `create_refresh_tokens` | `74aea5aae5c8c03b4e6229e171201894` | sin el `\n` final |
| 20261001193100 | `add_categorias_codigo` | `76be83e46756f949ae7669a98e609aed` | sin el `\n` final |
| 20261001212500 | `add_muebles_referencia` | `0dc42c7b45c14bc0d6f4031d52d08b8e` | sin el `\n` final |
| 20261001220000 | `backfill_categorias_codigo` | `564ad21a0ba8c56a05f46a172b4d91ed` | con `\r\n` y sin el último |
| 20261002121823 | `backfill_muebles_referencia` | `85596bfc098e1d8a1e89cbff978a31a5` | tal cual |
| 20261002174749 | `add_categoria_espejos` | `d1c08882434e11bfcc0278e817a5b756` | tal cual |
| 20261002193936 | `respaldo_agrupacion_muebles` | `0d9f6a9254e6236f43b8fc9b7f9c1abe` | tal cual |
| 20261002200855 | `agrupar_fichas_juntar_fotos` | `31e2298996012855305c46eea9b37e6e` | tal cual |
| 20261005002322 | `create_mensajes_contacto` | `142abae3532f1684e28c8a940acb3d9b` | tal cual |

## Lo que no está aquí

- **El `CREATE TABLE` de `muebles`, `categorias`, `clientes` y `pedidos`.** No hay ninguna migración que las
  cree: ya existían antes de la primera (3 sep). No consta cómo se crearon. Con lo que hay aquí no se puede
  rehacer la base de datos desde cero. Para tenerlo, hay que volcar el esquema actual solo leyendo
  (`supabase db dump` o `pg_dump --schema-only`, con la cadena de conexión de la base de datos). Queda
  pendiente en H38.
- **Lo ejecutado desde el SQL Editor**, como el último paso de la agrupación de fichas (ver arriba).
