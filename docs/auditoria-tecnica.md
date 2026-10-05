# Auditoría técnica del código y las consultas

4 oct 2026, sobre `feature/mejoras-tecnicas` en `c4076cb`. **Solo lectura: no se ha arreglado nada.**

**Cómo se ha hecho:**
- Búsquedas en el código: `grep` de `console.*`, TODO/FIXME, `select('*')`, `.limit(`, bucles con consultas
  dentro, archivos y exportaciones que nadie importa, y dependencias que no se usan.
- El lint de los dos proyectos.
- **Índices:** salen de las migraciones que hay en `server/migrations/` y de lo documentado en `docs/`. **No se
  ha consultado la base de datos** (el encargo no lo autoriza). Lo que depende de ella queda como "sin
  comprobar".

**Severidad:**
- **ALTA:** fallo o riesgo real hoy.
- **MEDIA:** conviene arreglarlo antes de que crezca el uso o el equipo.
- **BAJA:** limpieza o mejora menor.

**Resumen:**
- **ALTA:** ninguna.
- **MEDIA:** 4.
  - el carrito de pago sin número máximo de piezas, con una consulta por pieza;
  - `select('*')` en los pedidos que se devuelven;
  - el listado de pedidos del panel sin límite;
  - las 7 primeras migraciones sin copia en el repositorio.
- **BAJA:** el resto.

## 1. `console.log` / `console.warn` innecesarios

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| `server/src/data/supabase.js:50` | `console.log` de la URL de Supabase y el tipo de clave en cada arranque (cada arranque en frío de Vercel). No es un secreto. | BAJA | Dejarlo solo fuera de producción, o quitarlo. |
| `server/src/utils/email.js` (líneas 141, 245, 310, 365, 412) | `console.log` del id de Resend de cada correo enviado. | BAJA | Útil para rastrear un correo; se puede quedar. |
| `server/src/utils/email.js` (líneas 117-118, 223-224, 293, 337-338, 381-383) | Datos de los correos en modo simulación. Solo con `EMAIL_DEBUG_DATOS=true` fuera de producción (H27). | — | Correcto así. |
| `server/src/seed.js:83, 90` | Mensajes del script de ejemplo. | BAJA | Ver "código muerto". |
| Cliente | Ningún `console.log`/`warn`/`info`/`debug` fuera de los tests. Hay 29 `console.error` en los `catch` de `services/api.js` y similares. | — | Correcto. |

Los `console.warn` del servidor tienen todos un motivo y no llevan datos personales:
- `stripeController` (firma de Stripe no válida);
- `authController` (refresh rechazado o reutilizado, contraseña actual incorrecta);
- `authRoutes` (límite de intentos);
- `altaMueble` (categoría sin código, colisión de referencia);
- `pagos` (los correos tardan);
- `email` (pedido sin email).

## 2. TODO / FIXME

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| — | No hay ningún `TODO`, `FIXME`, `HACK` ni `XXX` de verdad en `server/src`, `client/src`, `client/scripts` ni `.github`. Las únicas apariciones son palabras sueltas en mayúsculas ("TODOS") y la referencia de ejemplo `NAV-XXX-000`. | — | Nada que hacer. Los pendientes viven en `docs/mejoras-tecnicas.md`. |

## 3. Código muerto

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| `server/src/routes/mueblesRoutes.js:69` → `buscarMuebles` (`mueblesController.js:262`) | `GET /api/muebles/buscar` es pública, pero la web no la llama: el catálogo filtra en el navegador. Sigue respondiendo a cualquiera, sin límite de filas (ver 8). | BAJA | Quitarla, o usarla desde el catálogo cuando haya búsqueda en el servidor. |
| `client/src/services/api.js:341` `buscarMuebles` | La función del cliente de la ruta anterior: nadie la usa. | BAJA | Quitarla junto con la ruta. |
| `client/src/utils/images.js:7` `getImagen` | No se usa en ningún sitio (los componentes usan `imagenes?.[0] \|\| PLACEHOLDER_IMG`). | BAJA | Quitarla o usarla en esos componentes. |
| `server/src/utils/referencia.js:77` `generarReferencia` | Solo la usan los tests. El alta usa `obtenerCodigoCategoria` + `calcularSiguienteReferencia` por separado (ahora en `utils/altaMueble.js`). | BAJA | Quitarla y sus tests, o dejarla como atajo documentado. |
| `server/src/utils/refreshTokens.js:173` `limpiarExpirados` | No la llama nada: no hay tareas programadas. Está documentada como mantenimiento manual. | BAJA | Programarla (Vercel Cron) o ejecutar la consulta de vez en cuando. |
| `server/src/seed.js` | Script suelto para poblar una base de ejemplo con la clave anon. Con la RLS de `muebles` (solo lectura pública), su `insert` ya no funcionaría. | BAJA | Quitarlo, o pasarlo a una base de desarrollo con `service_role`. |
| `public.respaldo_agrupacion_muebles_20261002` (base de datos) | La copia de la agrupación del 2 oct. Hace falta para deshacerla. | BAJA | Borrarla con su `.down.sql` cuando el cliente dé la agrupación por buena. |

## 4. Dependencias sin usar

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| `server/package.json` | Las 15 dependencias se usan (`require` en `server/src` o `server/api`). | — | — |
| `client/package.json` (`@types/react`, `@types/react-dom`) | El proyecto es JavaScript sin TypeScript. Solo ayudan al autocompletado del editor. | BAJA | Se pueden quitar; no afectan al build. |

## 5. Imports sin usar

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| Cliente y servidor | `no-unused-vars` está activa en los dos ESLint. El cliente corre con `--max-warnings 0`, y el lint del servidor no da ningún aviso. No hay imports sin usar. | — | — |
| `server/package.json` → `"lint": "eslint src/"` | En el servidor, `no-unused-vars` es `warn` y el script no lleva `--max-warnings 0`: un aviso nuevo no pararía la CI. | BAJA | Añadir `--max-warnings 0`, como en el cliente. |

## 6. Variables sin usar

Igual que el punto 5: ninguna, según ESLint. Lo único es lo exportado que solo usan los tests: constantes
como `MAX_FILAS_IMPORTACION`, `PAGE_SIZE` o `DURACION_MS`, que se exportan a propósito para que los tests no
repitan el número.

## 7. `select('*')` donde no hace falta

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| `server/src/controllers/pedidosController.js:22` (`GET /api/pedidos/mios`) | Devuelve **al cliente** todas las columnas de sus pedidos. Cualquier columna interna que se añada a `pedidos` saldría sin que nadie lo decida. Es lo mismo que H26 arregló en `muebles` y `categorias`. | MEDIA | Elegir las columnas, como `COLUMNAS_PUBLICAS_MUEBLE`. |
| `server/src/controllers/pedidosController.js:39` (`GET /api/pedidos`, panel) | Lo mismo, pero solo para administradores. | BAJA | Elegir columnas a la vez que el anterior. |
| `server/src/controllers/mueblesController.js:287` (`construirLineasDesdeCarrito`) | Lee el mueble entero para usar solo el nombre, los precios y el estado. No se devuelve. | BAJA | Elegir columnas. |
| `server/src/controllers/authController.js:122, 185, 314` | Leen la fila entera de `clientes` (con el hash de la contraseña, que hace falta para comparar). No se devuelve: la respuesta arma su propio objeto `user`. | BAJA | Elegir columnas para no cargar más de lo necesario. |

## 8. Consultas sin límite

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| `pedidosController.js:35` (`GET /api/pedidos`, panel) | Todos los pedidos de la historia en cada carga del panel. Crece sin fin con las ventas. | MEDIA | Paginar o limitar (los últimos N, con "ver más"). |
| `pedidosController.js:13` (`GET /api/pedidos/mios`) | Todos los pedidos del cliente. Un cliente tiene pocos. | BAJA | — |
| `mueblesController.js:262` (`GET /api/muebles/buscar`) | Pública y sin límite. Con 77 piezas no importa, pero no la usa nadie (ver 3). | BAJA | Quitarla o limitarla. |
| `mueblesController.js:46` y `:75`, `catalogoCsvController.js` (catálogo público, inventario, exportación) | El catálogo entero. Es lo que se quiere y son 77 filas. | — | Revisar si el catálogo pasa de algunos miles. |
| `mensajesController.js` | Limitado a 500 a propósito. | — | — |

## 9. Posibles N+1

| Dónde | Qué | Severidad | Recomendación |
|---|---|---|---|
| `mueblesController.js:282` (`construirLineasDesdeCarrito`, en `POST /api/muebles/crear-sesion-pago`) | Una consulta por pieza del carrito, una detrás de otra. **`schemaCarritoPago` no pone máximo de piezas**: con el límite del cuerpo JSON (100 KB, el de `express.json()` por defecto) caben unos miles, y cada petición pública haría esas consultas antes de llegar a Stripe. El limitador (20 por IP cada 15 min, H29) lo frena, pero no lo evita. | MEDIA | Leer todas las piezas con una sola consulta `.in('id', ids)` y poner `.max(...)` al carrito (una tienda de piezas únicas no necesita más de unas decenas). |
| `utils/pagos.js:101` (`marcarPiezas`) | Un `update` condicional por línea. Es a propósito: cada pieza se marca con su condición `estado = 'disponible'`, sin carreras. | — | Correcto; el carrito real es pequeño. |
| `utils/pagos.js:193` (`detectarConflictos`) | Una consulta de pedidos por línea, después de cobrar. | BAJA | Se podría hacer en una, pero solo corre una vez por pago. |
| `catalogoCsvController.js` (importar, modo `apply`) | Un alta por fila (más la consulta de la siguiente referencia). Es a propósito: las referencias salen seguidas y sin chocar. Como mucho 500 filas, solo administradores. | — | Correcto. |
| `categoriasController` (estadísticas del panel) | Dos consultas en total (categorías y muebles) y el cruce en memoria: no hay N+1. | — | — |

## 10. Índices que faltan

Las 7 migraciones del 3 al 5 de septiembre no tienen copia en `server/migrations/`:
- `enable_rls_public_read_only`;
- `sync_disponible_from_estado_trigger`;
- `fix_search_path_sync_disponible_trigger`;
- `add_categoria_padre_id`;
- `pedidos_soporte_checkout_multiproducto`;
- `cleanup_pedidos_phantom_columns_and_indexes`;
- `move_http_extension_out_of_public`.

Las tablas base (`muebles`, `categorias`, `clientes`, `pedidos`) tampoco: se crearon antes de usar migraciones. Por eso lo que sigue es **"sin comprobar en la base de datos"** salvo donde se indica.

| Consulta | Índice que la cubriría | Severidad | Recomendación |
|---|---|---|---|
| `pedidos` por `cliente_info->>email` con `ilike` (`GET /api/pedidos/mios`) | No consta. `ilike` con un patrón sin comodines no usa un índice btree normal. | BAJA | Hoy hay pocos pedidos. Al crecer: filtrar por `cliente_id` (ya tiene índice, `idx_pedidos_cliente_id`) o un índice sobre `lower(cliente_info->>'email')`. |
| `pedidos.items @> [...]` (`detectarConflictos`) | No consta un índice GIN sobre `items`. | BAJA | Añadirlo si los pedidos crecen mucho. |
| `muebles` ordenado por `created_at` (catálogo, inventario, exportación) | No consta. | BAJA | Con 77 filas, Postgres lo ordena en memoria. Añadirlo con miles de piezas. |
| `categorias.nombre = ...` (`resolverCategoriaIdPorNombre`, en cada alta o edición sin `categoria_id`) | No consta un índice ni que sea único. | BAJA | Hay 13 categorías: da igual en rendimiento. Un `UNIQUE` evitaría dos categorías con el mismo nombre, que el código trata como una. |
| `muebles.referencia LIKE 'NAV-COD-%' ORDER BY referencia DESC LIMIT 1` | `UNIQUE` de `referencia` (A2), que crea un btree. Que lo use con `LIKE` depende de la collation. | — | Con 77 filas no importa. |
| `pedidos.stripe_session_id` | Índice único `pedidos_stripe_session_id_key`, aplicado en producción (`docs/tarea3-diseno.md` y `docs/mejoras-tecnicas.md`). | — | Correcto. |
| `mensajes_contacto` (pendiente) | `leido` y `created_at DESC` en la migración preparada. | — | — |

## Hallazgos que merecen entrada en `mejoras-tecnicas.md`

1. **Carrito sin número máximo de piezas, con una consulta por pieza** (MEDIA, punto 9).
2. **`GET /api/pedidos/mios` con `select('*')`** (MEDIA, punto 7). Es el mismo patrón que H26.
3. **El panel trae todos los pedidos de la historia** (MEDIA, punto 8).
4. **Faltan las copias de las 7 primeras migraciones y de las tablas base** (MEDIA, punto 10): no se puede
   reconstruir la base de datos desde el repositorio.
