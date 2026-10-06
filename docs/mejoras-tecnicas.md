# Rama `feature/mejoras-tecnicas`: registro de trabajo

Este documento recoge el estado de las mejoras técnicas de la rama, lo que queda por hacer a mano y los
hallazgos detectados, con su estado (la auditoría de seguridad se cerró el 29 sep 2026; resumen en
"Hallazgos"), para que no dependan del historial de una conversación.

## 🔄 Bloque A (referencias de muebles): A1-A7 hechas, 2 oct 2026

Sesiones del 1-2 oct 2026. **A1-A7 completadas** (A5-A7: informe en `docs/reporte-a5-a7.md`).
**Pendiente:** rellenar la referencia de los 114 muebles que ya existen (migración, necesita permiso) y el
bloque C (`MOSTRAR_PRECIOS`), en otra sesión.

| Migración | Version | Nombre | Estado |
|-----------|---------|--------|--------|
| A1: `categorias.codigo` | `20261001193100` | `add_categorias_codigo` | ✅ Aplicada en BD |
| A2: `muebles.referencia` | `20261001212500` | `add_muebles_referencia` | ✅ Aplicada en BD |
| A3: backfill códigos | `20261001220000` | `backfill_categorias_codigo` | ✅ Aplicada en BD |
| A4: `generarReferencia` (servidor) | — (no toca BD) | — | ✅ Commiteado (`1fcef7c`) |
| A9 — backfill de referencias de muebles (los 114 existentes) | `20261002121823` | `backfill_muebles_referencia` | ✅ Aplicada en BD (2 oct, 12:18 UTC) |
| Categoría nueva "Espejos" (ESP, id 28, dentro de "Decoración y hogar") | `20261002174749` | `add_categoria_espejos` | ✅ Aplicada en BD (2 oct, 17:47 UTC) |
| Agrupación (1/3): copia de seguridad de las 52 fichas afectadas | `20261002193936` | `respaldo_agrupacion_muebles` | ✅ Aplicada en BD (2 oct, 19:39 UTC) |
| Agrupación (2/3): las 15 fichas principales reciben las fotos de su grupo; 2 cambian de nombre | `20261002200855` | `agrupar_fichas_juntar_fotos` | ✅ Aplicada en BD (2 oct, 20:08 UTC) |
| Agrupación (3/3): borrar las 37 fichas restantes (114 → 77) | — (no consta en `schema_migrations`) | — | ✅ Ejecutada por el cliente en el SQL Editor (2 oct): `apply_migration` se colgaba con `DELETE`. SQL y reversión en `docs/agrupar-fichas-propuesta.md` |
| Tabla `mensajes_contacto` (panel de mensajes de contacto) | `20261005002322` | `create_mensajes_contacto` | ✅ Aplicada en BD (5 oct, 00:23 UTC) |

**Códigos aplicados en las 12 categorías:**
ILU (7), MOB (17), DEC (18), PIE (19), SIL (20), MES (21), PUE (22), OBJ (23), PLA (24), BAU (25), BID (26), JUG (27).
El 2 oct se añadió una 13.ª, ESP (28) "Espejos", con autorización del usuario, para los 5 espejos del PDF
`Espejos_Props_NAVE5_01_10_2026`. Hasta que se den de alta, sale vacía en el catálogo.

**Formato de referencia:** `NAV-COD-NNN` (p. ej. `NAV-SIL-001`). Lógica en `server/src/utils/referencia.js`.
Reintento en colisión UNIQUE (código Postgres 23505, constraint `muebles_referencia_key`), hasta 3 intentos.
Usa `ORDER BY referencia DESC LIMIT 1` — no reutiliza huecos, no trae todo el catálogo.

**A5-A7 (2 oct 2026, ver `docs/reporte-a5-a7.md`):**
- A5 (`d4efb45`): referencia en el panel (columna, búsqueda, solo lectura al editar, aviso al crear),
  `GET /api/admin/muebles` y código de 3 letras en las categorías (crear, editar, validar, tarjeta).
- A6 (`c0a90e1`): referencia bajo el nombre en el catálogo público; fuera la "Ref. SKU-…" inventada de la
  ficha.
- A7 (`941fc94`): tests de integración de las referencias.

**Después del cierre (2 oct 2026), decisiones del usuario:**
- Relleno de las referencias de los muebles existentes: **sí**. **Aplicado el 2 oct 2026 a las 12:18 UTC**, con
  autorización expresa (A9 — backfill de referencias de muebles, versión `20261002121823`, `backfill_muebles_referencia`): los 114 muebles tienen
  referencia, de 001 en adelante por categoría y por antigüedad, y las 5 comprobaciones salen bien. Detalle en
  `docs/propuesta-backfill-referencias.md`.
- Celda vacía en el inventario cuando no hay referencia: se queda así (con el relleno no habrá ninguna).
- Buscador del inventario: pasa a "Buscar por nombre o referencia...", con los tests de caracterización
  actualizados ("CAMBIADO A PROPÓSITO").
- Cambiar el código de una categoría con muebles con referencia: pedirá confirmación (pendiente de hacer).
- El freeze de los tests de caracterización del panel se levanta (ver `docs/tarea4-diseno.md`, sección 8).

**Pendiente:**
- La confirmación al cambiar el código de una categoría.
- Comprobación en el navegador con sesión de administrador.

**Nota:** No mergear a `main` sin decidir antes lo de las referencias de los muebles existentes y revisar el
gate completo.

## ✅ Fase C (ocultar precios al público): hecha, 2 oct 2026

Informe en `docs/reporte-fase-c.md`. Commits `296b741` (C1, servidor), `2c0fa80` (C2), `b736e8b` (C3) y
`9d97017` (C4).
- `MOSTRAR_PRECIOS` (servidor): solo `true` enseña precios. **Sin poner, los precios quedan ocultos**: las
  lecturas públicas devuelven los precios a null, la web pone "Consultar precio" y "Preguntar por esta pieza"
  (lleva a contacto con la pieza en el mensaje), y `crear-sesion-pago` responde 403. El panel ve siempre los
  precios reales.
- La cesta no suma las líneas sin precio y no deja pagar con ellas.
- **Antes del merge:** decidir con el cliente el valor de `MOSTRAR_PRECIOS` en Vercel y ponerlo. Sin él,
  producción deja de enseñar precios y de vender en cuanto se despliegue.
- "Ordenar por precio" se oculta cuando ninguna pieza tiene precio (`45502c4`, hallazgo 6 del informe).
- **Comprobado en el navegador** (Chromium, en el contenedor, con el servidor de la rama y una muestra real de
  9 muebles y las 12 categorías en memoria, porque el contenedor no llega a Supabase): 21 comprobaciones con
  `MOSTRAR_PRECIOS=false` y 14 con `true`, todas bien, y la API respondiendo 403 al pago con los precios
  ocultos.
- **`MOSTRAR_PRECIOS=false` en Vercel** (`nave5-api`, Production, tipo *Encrypted* para poder ver el valor).
- **Merge a `main` y despliegue:** `7fa8ff2` (merge `--no-ff` de `feature/mejoras-tecnicas`, padres `80ed786` y
  `fc7123f`, sin conflictos; gate completo en verde justo antes: servidor 442/442, cliente 636/636). Push a las
  14:04:54 UTC del 2 oct 2026. `nave5-demo` READY a las 14:05:11 UTC y `nave5-api` a las 14:05:36 UTC.
- **En producción, comprobado a las 14:06 UTC** (lectura por la conexión de Vercel; el contenedor no llega a la
  web): `GET /api/muebles` y `/api/muebles/:id` devuelven los precios a `null` y la referencia
  (`NAV-SIL-010`...), sin servir de caché (`x-vercel-cache: MISS`), y la web carga. Lo que se ve en pantalla
  (tarjetas, ficha, "Preguntar por esta pieza", panel con sesión) queda para la comprobación en el navegador
  del usuario.

## ✅ Merge a `main` del 4 oct 2026: agrupación de fichas, espejos y `CONTACT_EMAILS`

- **Merge:** `fd9e5ab` (`--no-ff` de `feature/mejoras-tecnicas` sobre `7fa8ff2`, sin conflictos). Gate en
  verde justo antes: servidor 448/448 (cobertura 96,04 / 87,00 / 98,77), cliente 636/636 (88,57 / 94,04 /
  88,07) y build. Push a las **16:29:37 UTC**. `nave5-demo` READY a las **16:29:51 UTC**
  (`dpl_AZKSQDHXsYStMRvDz2K2fToXSyZG`) y `nave5-api` a las **16:30:14 UTC**
  (`dpl_Chx1ZiyR6PdSTYW4i4czji6nk5H4`).
- **Qué llevaba (10 commits):** el buscador del inventario alineado (`7fe0972`, CSS), `CONTACT_EMAILS`
  (`37f21f3`) y documentación: H33, H34, la lista de duplicados, la propuesta de agrupación y las migraciones
  del 2 oct (que ya estaban aplicadas en la base de datos antes del merge).
- **Comprobado en producción a las 16:30 UTC** (lectura por la conexión de Vercel; el contenedor no llega a la
  web): la portada y `/admin` sirven el build nuevo (200); `GET /api/categorias` incluye "Espejos";
  `GET /api/muebles/buscar?q=Lote` devuelve "Lote Coches Juguete" (NAV-JUG-001) con 15 fotos y los precios a
  `null`. La base de datos tiene 77 fichas. **Sin comprobar:** lo que se ve en pantalla (la redirección de
  `/admin` a `/login` se hace en el navegador) y el buscador del inventario con sesión iniciada; queda para
  el navegador del usuario.
- **Correo en producción (visto en Vercel el 4 oct):** `nave5-api` no tiene `RESEND_FROM` ni `ADMIN_EMAIL`, así
  que se usan los valores por defecto del código: remitente `onboarding@resend.dev` (sandbox) y destinatario
  el email del dueño. `CONTACT_EMAILS` **no se ha puesto a propósito**: con el remitente sandbox, Resend
  rechaza con 403 cualquier envío con un destinatario que no sea el de la cuenta, así que añadir el email
  del cliente haría fallar el formulario de contacto entero. Primero hay que verificar `nave5barcelona.com`
  en Resend y poner `RESEND_FROM` con ese dominio; después, `CONTACT_EMAILS`.

### Pendiente (4 oct 2026)

- **Verificar el dominio en Resend** y poner `RESEND_FROM` (y luego `CONTACT_EMAILS`) en Vercel. Lo decide
  el cliente.
- **Dar de alta 5 espejos** (categoría "Espejos", ESP, ya creada) y **14 sillas** de los PDF del 1 oct. Hay
  que subir las fotos desde el panel; antes, mirar si alguna silla ya está en la tienda (SIL-001, SIL-011,
  SIL-014...).
- **Revisar `docs/duplicados-candidatos.md` con el cliente:** 9 de las 25 filas ya están anotadas tras la
  agrupación; las otras 16 siguen pendientes.
- **H33:** pasar `JWT_SECRET` y `STRIPE_SECRET_KEY` de *Encrypted* a *Sensitive* (deuda aceptada; ver H33).
- Sin cambios: reservas por fechas (decisiones del cliente), H18, H23 y H34.

## 🔄 Sesión de accesibilidad del 6 oct 2026: H47-H50

En `feature/mejoras-tecnicas`, sin merge: producción sigue en `3b3accf`. Informe en
`docs/reporte-sesion-ux.md` (sección "Sesión de accesibilidad del 6 oct").

| Tarea | Estado | Commit |
|---|---|---|
| 1. H47 (crítico), Mi cuenta: etiquetas, contraste y un solo `<main>` | ✅ | `2d39756` |
| 2. H48 (grave), contraste del enlace del aviso de cookies | ✅ | `a5b6f54` |
| 3. H49, solo la primera foto del hero al cargar | ✅ | `26d0ff8` |
| 4. H50, "Mis pedidos" del pie vuelve a pedidos tras el login | ✅ | `d287d31` |

- **Cobertura (líneas / ramas / funciones):**
  - cliente: de 98,63 / 95,71 / 93,06 a 98,65 / 95,73 / 93,08 (807 tests, antes 796);
  - servidor: igual, 99,06 / 91,82 / 99,54 (556; esta sesión no lo ha tocado).
- **Umbrales:** sin cambios (cliente 97 / 95 / 92; servidor 98 / 91 / 99).
- **E2E:** 39 (antes 26): 7 de Mi cuenta, 2 del aviso de cookies, 2 del hero y 2 del pie.
- **Mutantes del panel:** 127, como antes: 126 detectados y 1 superviviente esperado (más el de control, que muere en la comprobación previa). Pasados al final de la sesión, sobre `d287d31`: "Todos los mutantes detectados".
- **Cambios de comportamiento a propósito:**
  - las fotos del hero solo existen cuando se piden (los tests que las daban por presentes llevan
    `CAMBIADO A PROPÓSITO`);
  - "Mi cuenta" y "Mis pedidos" del pie apuntan a `/cuenta`, también sin sesión.
- **Hallazgo nuevo:** H53.

## 🔄 Sesión UX del 5 oct 2026 (noche): H41, H43, H45, H38 y H42

En `feature/mejoras-tecnicas`, sin merge: producción sigue en `035cffa`. Informe completo en
`docs/reporte-sesion-ux.md`.

| Tarea | Estado | Commit |
|---|---|---|
| 1. H41, categorías del catálogo con el teclado | ✅ | `5babdb3` |
| 2. H43, orden de los títulos y `h1` en el inicio de sesión | ✅ (sin cambios a la vista, medido) | `329a947` |
| 3. H45, volver a la página pedida tras iniciar sesión | ✅ | `a49c25d` |
| 4. H38, migraciones antiguas en el repositorio | ✅ las 7 migraciones; quedan las tablas base | `f5070b8` |
| 5. H42, fotos del hero para el móvil | ✅ | `498e0c3` |

- **Cobertura (líneas / ramas / funciones):**
  - cliente: de 98,39 / 95,67 / 93,02 a 98,63 / 95,71 / 93,06 (796 tests, antes 737);
  - servidor: igual, 99,06 / 91,82 / 99,54 (556 tests; esta sesión no ha tocado el servidor).
- **Umbrales:** sin cambios (cliente 97 / 95 / 92; servidor 98 / 91 / 99).
- **E2E:** 26 (antes 19): 6 de títulos con axe y 1 de H45.
- **Mutantes del panel:** 127 (126 detectados y 1 superviviente esperado), comprobado al final de la sesión.
- **Base de datos:** solo lectura (`schema_migrations`, para H38). No se ha escrito nada.
- **Cambios de comportamiento a propósito:**
  - los nombres de las piezas del catálogo son `h2` (antes `h3`); los tests que los buscaban como `h3` llevan
    `CAMBIADO A PROPÓSITO`;
  - la foto de cada categoría del catálogo lleva `alt=""` (el nombre ya lo da el botón);
  - tras iniciar sesión, se vuelve a la página pedida (antes, siempre a la portada).
- **Hallazgos nuevos:** H47, H48, H49 y H50, abajo en "Hallazgos".

## 🔄 Sesión autónoma del 5 oct 2026: emails, H35-H40, accesibilidad, rendimiento y cobertura

En `feature/mejoras-tecnicas`, sin merge: producción sigue en `87359d6`. Informe completo en
`docs/reporte-sesion-autonoma.md`.

| Tarea | Estado | Commit |
|---|---|---|
| 1. Rediseño de los emails de contacto y de confirmación al comprador | ✅ (`docs/capturas-emails/`) | `f110fb0` |
| 2.1 H39, búsqueda en el móvil | ✅ | `6b53791` |
| 2.2 H40, estados vacíos y 404 | ✅ | `aaa6ee8` |
| 2.3 Desbordamiento del panel en el móvil | ✅ (barra lateral, 40 px, y campos de "Añadir Mueble", 12 px) | `32a8761` |
| 3.1 H35, tope del carrito y consulta única | ✅ | `72393f0` |
| 3.2 H36, columnas de "Mis pedidos" | ✅ | `6e3b682` |
| 3.3 H37, paginación de pedidos | ✅ | `9849118` |
| 4.1 Accesibilidad | ✅ (`docs/auditoria-accesibilidad.md`) | `5db945b` |
| 4.2 Rendimiento | ✅ (`docs/auditoria-rendimiento.md`) | `72c8b2e` |
| 5. Cobertura | ✅ | `ab0c623` |

- **Cobertura (líneas / ramas / funciones):**
  - cliente: de 91,44 / 94,17 / 89,47 a 98,39 / 95,67 / 93,02;
  - servidor: de 96,49 / 88,41 / 99,00 a 99,06 / 91,82 / 99,54.
- **Umbrales**, subidos a lo medido menos medio punto:
  - cliente: 97 / 95 / 92 (antes 81 / 93 / 86);
  - servidor: 98 / 91 / 99 (antes 94 / 83 / 98).
- **Mutantes del panel:** 127 (126 detectados y 1 superviviente esperado), comprobado después de H37.
- **Hallazgos nuevos:** H41, H42, H43 y H44, abajo en "Hallazgos".
- **Cambios de comportamiento a propósito:**
  - carrito de 20 piezas como máximo;
  - `GET /api/pedidos` paginado;
  - `getPedidos`, `null` si falla;
  - `--danger-color` algo más oscuro en modo claro.

## 🔄 Bloque de trabajo autónomo (4 oct 2026): CSV, mensajes, auditoría, E2E y estilos

En `feature/mejoras-tecnicas`, sin merge (producción sigue en `fd9e5ab`). Informe completo en
`docs/reporte-trabajo-autonomo.md`.

| Tarea | Estado | Commit |
|---|---|---|
| 1. Exportar el catálogo a CSV (`GET /api/admin/muebles/export` + botón en el inventario) | ✅ Hecha | `ab71e84` |
| 2. Importar el catálogo desde CSV (`POST /api/admin/muebles/import`, previsualizar y aplicar, + modal) | ✅ Hecha | `8787838` |
| 3. Panel de mensajes de contacto | ✅ Hecha. Migración `mensajes_contacto` aplicada el 5 oct 2026, versión `20261005002322` (`server/migrations/20261005002322_create_mensajes_contacto.sql`; detalles en `docs/propuesta-mensajes-contacto.md`) | `c4076cb`, `45cdc96` |
| 4. Auditoría técnica (solo lectura) | ✅ Hecha: `docs/auditoria-tecnica.md` | `d9e0920` |
| 5. Tests E2E con Playwright (10 tests, job de CI no bloqueante) | ✅ Hecha: `docs/testing-e2e.md` | `5ef4801` |
| 6. Mejoras visuales, solo CSS (4 bloques) | ✅ Hecha, con lo que no se puede sin JSX anotado en H40 | `3eb38f2`, `3afa24f`, `b258ea6`, `ed06140` |

- **Migración `mensajes_contacto`:** aplicada el 5 oct 2026 con permiso, versión `20261005002322`. La copia del
  repositorio coincide byte a byte con `schema_migrations` (mismo MD5). RLS activa, sin políticas, con sus dos
  índices.
- **Mutantes del panel:** 127 (126 detectados + 1 esperado), igual que antes, comprobado después de las tareas
  1-3 (`c4076cb`).
- **Cambios de comportamiento a propósito:**
  - el formulario de contacto responde 200 si el mensaje se guardó aunque falle el correo (antes, 502);
  - la barra lateral del panel tiene una pestaña más ("Mensajes", tras "Pedidos").
  Los dos tests que lo fijaban llevan `CAMBIADO A PROPÓSITO`.
- **Hallazgos nuevos:** H35-H40, abajo en "Hallazgos".

## Estado de las tareas

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Webhook de Stripe, con `confirmar-sesion` como respaldo idempotente y con límite de peticiones | Hecha, con H1 corregido. Falta probarla contra Stripe y Vercel reales (ver más abajo) |
| 2 | Seguridad: CSP, CORS, Zod, `service_role` obligatoria, escape de email | Hecha (ver detalle abajo). `bcrypt`/JWT + refresh quedan para la tarea 3 |
| 3 | Migraciones SQL en `server/migrations/` + JWT con refresh | **Bloque 3a cerrado el 26 sep 2026.** Aplicadas en producción: A1, A2 y A3 (`muebles.categoria_id`), B1, B2 y B3 (`pedidos.cliente_id`) y H9 (RLS de `pedidos`). También hechos H8, la doble escritura de `categoria_id`, el código que rellena `cliente_id` al registrar un pedido (commiteado y desplegado el 24 sep) y dejar de fijar `disponible` a mano. Queda anotada una deuda aceptada: H20, el código de B sin comprobar de extremo a extremo. **Bloque 3b** (JWT con refresh y rotación), hecho en la rama `feature/jwt-refresh` y mergeado en `feature/mejoras-tecnicas` el 28 sep, sin subir: C1 (tabla `refresh_tokens`) aplicada en producción el 26 sep; C2 (servidor) y C3 (cliente) hechos el 28 sep, sin desplegar. Antes del merge falta `REFRESH_TOKEN_HASH_SECRET` en Vercel y la comprobación en el navegador (ver "Bloque 3b" más abajo). Diseño completo en `docs/tarea3-diseno.md` |
| 4 | Refactor: `Admin.jsx` por pestañas, ESLint + Prettier en el servidor, `engines` | ESLint + Prettier + `engines.node` del servidor hechos (tarea 8, ver más abajo). Refactor de `Admin.jsx`: hecho el 25 sep 2026 en la rama, sin subir (cierre en `docs/tarea4-diseno.md`, sección 11). `Admin.jsx` pasa de 1 039 a 201 líneas; los 125 tests de caracterización no se han tocado desde el primer commit de refactor, y después se ha añadido uno del orden de la barra lateral. ESLint del cliente con `no-restricted-globals`. Falta la comprobación en el navegador. Hallazgos: H12, H13, H14 y H15 abiertos; H19 cerrado (no reproducible) |
| 5 | Tests: servidor, cliente y E2E | Servidor y cliente hechos (ver detalle abajo). A 29 sep, al cierre de la auditoría: 365 tests en el servidor y 549 en el cliente, con cobertura del 95,6% y del 81,7% de líneas (historial en "Tarea 7"). E2E sigue sin empezar (no hay infraestructura) |
| 6 | Frontend: persistencia de carrito y favoritos, filtros, Schema.org, accesibilidad, skeletons | Pendiente (la vista de inventario en tabla del catálogo, con su propia deuda de accesibilidad H10, ya está hecha, fuera de esta tarea) |
| 7 | CI: lint y formato del servidor, `npm audit`, umbral de cobertura | Hecha el 28 sep 2026 en la rama (ver "Tarea 7" más abajo): `npm audit` informativo en los dos jobs, `.gitattributes` con `eol=lf` y umbrales de cobertura en los dos lados. El 29 sep se subió la cobertura (cliente del 57,9 al 81,7% de líneas; servidor del 93,6 al 95,2%) y con ella los umbrales, que solo suben. Hallazgos: H23 |
| 8 | Documentación: README raíz y variables de entorno | Hecha: `README.md`, `docs/env-vars.md`, `docs/architecture.md` (ver detalle más abajo) |

## ✅ Merge a `main` del 26 sep 2026: cierre de 3a y tarea 4

- **Merge:** `5d1723b` (`--no-ff`; padres `a1a7dfe` y `6e9cc9c`, sin conflictos). Gate completo en `main`
  antes del push, en verde: servidor 264/264 y cliente 272/272. Antes del merge se subió
  `feature/mejoras-tecnicas` como copia de seguridad (`6e9cc9c`).
- **Push de `main`:** 26 sep a las **19:33:06 UTC**. CI de `main` en verde (36 s).
- **Deploy, comprobado con la API de Vercel:**
  - `nave5-demo`: `READY` a las **19:33:19 UTC** (`dpl_7UKAqRPrLmw5mwPvppkFaQC4Xb3T`);
  - `nave5-api`: `READY` a las **19:33:46 UTC** (`dpl_7fviWVHzWW747xhSKUrzrFptktQL`).
- **Qué llevaba:**
  - el refactor del panel de la tarea 4, con su revisión (test del orden de la barra lateral y
    `no-restricted-globals`);
  - H19;
  - dejar de fijar `disponible` a mano;
  - la copia de B3 y los documentos de cierre de 3a.
- **Smoke test en producción**, con el navegador integrado y sin iniciar sesión:
  - la portada carga con datos de la API: las 3 categorías y 4 piezas destacadas;
  - el catálogo muestra las 114 piezas (las mismas que hay en la base de datos), y todas las llamadas a
    `nave5-api.vercel.app` (`/api/muebles`, `/api/categorias`) responden 200;
  - `/admin` sin sesión redirige a `/login`, que es lo correcto. Las pestañas no se pueden ver sin
    iniciar sesión, pero el trozo del panel del build (`Admin-DOiCm_Me.js`) se sirve con 200 y contiene las
    5 pestañas y los 2 modales;
  - la consola no tiene errores. Solo sale un aviso de la CSP (report-only) en `/login`, que ya estaba con
    la misma CSP antes de este merge: ver "CSP cliente" en la tarea 2.
- **Queda sin comprobar:** el panel por dentro con sesión iniciada. Es la comprobación en el navegador
  pendiente de la tarea 4, que necesita que el usuario inicie sesión.

## ✅ Pausa de despliegue cerrada (migración B): B3 aplicada el 26 sep 2026

- **Merge a `main` y deploy:** `a1a7dfe` (merge `--no-ff` de `feature/mejoras-tecnicas`, sin conflictos:
  `main` solo tenía el merge anterior). Push el **24 sep 2026 a las 20:07:36 UTC**. Verificado vía la API de
  Vercel:
  - `nave5-api`: `READY` a las **20:08:03 UTC** (deployment `dpl_EZeXWxDf8ro8hziSxhbqbUfrsrja`);
  - `nave5-demo`: `READY` a las 20:08:13 UTC (deployment `dpl_3TEg8ySCnuVcnKoR44fTn28LwH2t`);
  - CI de `main` en verde.
- **Qué llevaba:** H16 (caché del panel), H17 (escape de ILIKE), el formato del servidor, los tests de la
  tarea 4 hechos hasta entonces y el código de la migración B. También las copias de A3, H9, B1 y B2, que ya
  estaban aplicadas en la base de datos.
- **Comprobado en producción justo después**, en solo lectura: el catálogo responde 200; la búsqueda "sill"
  devuelve 14 piezas, y "si_la" 0 (antes de H17 el `_` hacía de comodín).
- **Pausa:** 24-48 h desde las 20:08:03 UTC del 24 sep, antes de aplicar B3. No se toca `main` mientras tanto.
- **Verificación antes de B3** (con la hora del deploy de la API):
  ```sql
  SELECT count(*) FROM pedidos
  WHERE created_at > '2026-09-24T20:08:03Z' AND cliente_id IS NULL
    AND lower(cliente_info->>'email') IN (SELECT lower(email) FROM clientes);
  ```
  Debe dar 0: un pedido nuevo de alguien con cuenta ya tiene que traer `cliente_id` del código. Igual que
  con A3, si no ha habido pedidos nuevos, el 0 no demuestra nada y hará falta una compra de prueba en modo test.
- **B3** (con permiso), con la misma regla que el código: solo se asigna la cuenta si el email coincide con
  exactamente una.
  ```sql
  UPDATE public.pedidos p SET cliente_id = c.id
  FROM public.clientes c
  WHERE p.cliente_id IS NULL
    AND lower(p.cliente_info->>'email') = lower(c.email)
    AND (SELECT count(*) FROM public.clientes c2 WHERE lower(c2.email) = lower(c.email)) = 1;
  ```
  El 24 sep rellenaría 2 filas; la tercera es de un invitado y se queda a NULL.
- **Estado el 25 sep a las 13:10 UTC**, en la fase 1 de la tarea larga de la revisión (cerrar 3a, merge, 3b):
  - Hecho: los tres commits de la revisión del cierre de la tarea 4 y `chore(server): dejar de fijar
    disponible a mano`. Este último va **antes de B3** y no después, porque no depende de B (sección 3 del
    diseño, paso 11). Ver las decisiones de ese commit más abajo.
  - **Parada en B3, por dos motivos:**
    - La pausa no acaba hasta las **20:08:03 UTC del 25 sep** (22:08 en España).
    - **No ha habido ningún pedido desde el deploy** (el último es del 5 sep), así que la verificación de
      arriba da 0 sin demostrar nada. Hace falta **una compra de prueba en modo test**, hecha por el usuario
      con la sesión iniciada en una cuenta que esté en `clientes`. Se puede hacer ya: basta con que el
      código esté desplegado.
  - B3 sigue rellenando 2 filas (comprobado a las 13:03 UTC).
- **Cómo se cerró, el 26 sep, por decisión del usuario:**
  - **Sin compra de prueba**, así que el código de B no se ha comprobado de extremo a extremo en producción.
    La confianza está en sus tests unitarios y en el test de contrato (`queryContract`). Queda como deuda
    aceptada: H20.
  - **Sin esperar a que acabara la ventana**, que era una recomendación y no un requisito. De hecho, cuando se
    aplicó B3, el deploy llevaba 47 h sin incidencias ni pedidos nuevos.
- **B3 aplicada** el 26 sep a las 19:26 UTC (versión `20260926192617`, commit `db6e676`):
  - antes: 3 pedidos, ninguno con `cliente_id`, y 2 que cumplían la condición;
  - después: 2 con `cliente_id` (los mismos dos ids, con el email coincidente) y 1 sin él, el de un invitado;
    ningún pedido de alguien con cuenta ha quedado sin rellenar;
  - la copia coincide byte a byte con `schema_migrations` (MD5 `9d37d74a…`);
  - el `.down.sql` solo devuelve a NULL esos dos pedidos, por id.
- **Decisiones del commit de `disponible` (`db5a6ce`):**
  - **El trigger está comprobado en producción, en solo lectura:** `trg_sync_disponible_desde_estado`,
    `BEFORE INSERT OR UPDATE`, activo, con `NEW.disponible := (COALESCE(NEW.estado, 'disponible') =
    'disponible')`. Las 114 piezas son coherentes. Como el trigger pisa siempre el valor, dejar de mandarlo
    no cambia lo que se guarda. Por eso no se ha hecho la prueba de escritura contra la base real que
    pedía el diseño "con permiso": la definición del trigger ya lo demuestra.
  - **También se ha quitado de `seed.js`.** El diseño solo nombraba el controlador y `pagos.js`, pero es la
    misma limpieza.
  - **El esquema sigue aceptando `disponible` y se ignora.** Quitarlo no cambiaría nada, porque con
    `.passthrough()` pasaría igual. Lleva un comentario.
  - **Caso límite:** una edición que solo mande `disponible` llega ahora a Supabase como `update({})`, igual
    que ya pasaba con una edición vacía. El panel siempre manda el resto de campos.

## Bloque 3b: decisiones antes de empezar (25-26 sep)

Leído el diseño aprobado (`docs/tarea3-diseno.md`, secciones 2 y 3) y comprobado contra el código y el
esquema actuales, en solo lectura. **Las siete decisiones siguen en pie:**
- access token de 1 h en memoria y refresh de 7 días en `localStorage` (`kaveRefreshToken`);
- el refresh rota en cada uso;
- detección de reuso por `family_id`;
- margen de gracia de 60 s y sincronización entre pestañas;
- `POST /api/auth/refresh` y `POST /api/auth/logout`;
- HMAC-SHA256 con `REFRESH_TOKEN_HASH_SECRET`;
- los JWT de 7 días ya firmados se dejan caducar.

Encaja con lo que hay: `clientes.id` es `uuid`, los administradores son filas de `clientes` con
`rol = 'admin'`, los JWT se firman en un solo sitio (`expiresIn: '7d'`) y `refresh_tokens` no existe todavía.

Pero hay cinco cosas que el diseño no resuelve, o que choca con el plan de la revisión:
1. **La regla de las 48 h.** El diseño dice: "no se empieza 3b hasta que estos commits lleven 48h en
   producción sin incidentes". El plan de la revisión aplica C1 en producción justo después del merge de 3a.
   Escribir el código en local no despliega nada, pero **aplicar C1 sí es una migración en producción durante
   la ventana de estabilidad de 3a**. Hay que decidir si se espera o si se hace una excepción.

   **Decisión (26 sep):** C1 se aplica justo después del merge de 3a, y C2 (servidor) y C3 (cliente) esperan
   48 h. Motivo:
   - la tabla sola no hace nada: ningún código la usa hasta C2;
   - lleva RLS sin políticas, así que falla cerrada;
   - no rompe nada de lo que existe.

   Riesgo aceptado: si en esas 48 h aparece un problema en el esquema, habrá que hacer un `ALTER` pequeño.
2. **H16 y el access token en memoria.** El diseño es del 22 sep, y H16 es del 24. Desde H16, el panel lee
   las listas con la cabecera `Authorization` para saltarse la caché de la CDN (`lecturaFresca()` en
   `api.js`). Con el access token en memoria, al recargar la página hay un momento, hasta que termina el
   refresh silencioso, en que `kaveUser` ya dice que hay sesión pero todavía no hay token:
   - el panel se pintaría y pediría las listas sin `Authorization`, y la CDN podría devolver una copia vieja
     (volvería H16);
   - las llamadas de administrador darían 401 y se reintentarían.

   Propuesta, que es una decisión de diseño: que `loading` de `AuthContext` siga en `true` hasta que termine
   el refresh silencioso. `ProtectedRoute` ya espera a `loading` antes de pintar nada, y el diseño ya prevé
   un estado de "sesión sin confirmar todavía".

   **Decisión (26 sep): aprobada, con un caso más, que entra en el diseño de C3.** Si el refresh silencioso
   falla por la red (no por un 401), la aplicación no puede quedarse en `loading` para siempre, ni cerrar la
   sesión. Pasa a un estado de "reconectando", con un botón para reintentar. No pinta contenido mientras
   tanto, para no hacer lecturas sin `Authorization`. El usuario puede reintentar o cerrar sesión a mano.
3. **`POST /api/auth/perfil-update` vuelve a firmar un token** (el nombre y el email van dentro), y el diseño
   no lo menciona. La lectura literal: devuelve un access token nuevo de 1 h y el refresh no cambia, porque
   cada rotación ya vuelve a leer `clientes`.

   **Decisión (26 sep): la lectura literal.** El cliente guarda ese access token en memoria, no en
   `localStorage`, y el refresh no se toca. Va con un comentario en el código de C2.

   **Corrección:** la revisión suponía que el usuario no podía cambiar su email, y sí puede: `perfil-update`
   acepta `nuevoEmail` y `nuevaPassword`.
   - Para que la sesión siga funcionando no hace falta nada: el refresh va por `user_id`, no por email, y
     cada rotación vuelve a leer la cuenta, así que el access token siguiente ya lleva el email nuevo.
   - **Queda abierto, para decidir en C2:** si cambiar la contraseña o el email debe revocar las demás
     sesiones (los refresh de otras pestañas o dispositivos). Lo habitual es revocarlas al cambiar la
     contraseña.
4. **El secreto nuevo.** El diseño dice que `REFRESH_TOKEN_HASH_SECRET` lo genera y lo pone el usuario, en
   Vercel y en `server/.env`, antes del deploy de 3b. La comprobación en el navegador en local (fase 5 del
   plan) también lo necesita en `server/.env`. Además, ese servidor local usa la base de datos real, así que
   el recorrido dejaría filas en `refresh_tokens` de producción (revocadas al cerrar sesión).

   **Decisión (26 sep):**
   - El usuario genera el secreto con `openssl rand -hex 32` y lo pone él mismo en `server/.env` y en las
     variables de `nave5-api` en Vercel. No pasa por la conversación.
   - Hace falta para C2, no para C1.
   - Si algún día se sospecha que se ha filtrado, se rota, y eso obliga a todo el mundo a volver a iniciar
     sesión.

   Las filas que deje la comprobación en local se aceptan. Después, el usuario las borra con:
   ```sql
   DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM clientes WHERE email = '<email del admin>');
   ```
5. **La comprobación única de concurrencia contra la base real** (sección 2 del diseño) necesita permiso y un
   `clientes.id` real. El plan de la revisión no la nombra.

   **Decisión (26 sep):** sigue necesitando un permiso aparte, que se pedirá cuando toque (en C2 o en la
   comprobación final).

### Estado del bloque 3b (hecho en la rama `feature/jwt-refresh`, desde `main` en `5d1723b`; mergeado en `feature/mejoras-tecnicas` el 28 sep, sin subir)

- **C1 aplicada** el 26 sep a las 19:37 UTC (versión `20260926193731`, commit `cf64bf1`):
  - es la tabla `refresh_tokens` del diseño, con sus 3 índices y RLS sin políticas;
  - está vacía, y ningún código la usa todavía;
  - la copia coincide byte a byte con `schema_migrations`.
- **El marcador de `REFRESH_TOKEN_HASH_SECRET` en `server/.env.example`** va en C2, que es el primero que lo
  usa. El diseño lo ponía en el commit de C1, y el plan de la revisión, en C2.
- **C2 (servidor) hecho el 28 sep, commit `870d031`:**
  - access token de 1 hora;
  - `POST /api/auth/refresh` y `POST /api/auth/logout`;
  - rotación, reuso por `family_id`, margen de gracia de 60 s y el mismo 401 genérico en los tres casos;
  - H21.
- **C3 (cliente) hecho el mismo día, commit `e3ec2b3`:**
  - access token en memoria y refresh en `localStorage`;
  - `apiFetch` con un solo reintento y renovación de-duplicada;
  - sincronización entre pestañas;
  - refresh silencioso con `loading`, y el estado `reconectando`.
- **Sin desplegar:** el 28 sep se mergeó en `feature/mejoras-tecnicas` (las dos ramas juntas), pero nada de
  eso está subido ni en `main`. El código se escribió antes de que C1 cumpliera
  sus 48 h (el 28 sep a las 19:37 UTC). Las 48 h del diseño son de producción, y en producción no ha entrado
  nada.
- **Tests:**
  - servidor: 27 en `refreshTokens.test.js` y 3 de contrato con el cliente real de supabase-js;
  - cliente: 37 (`authToken`, `apiFetch`, `AuthContext` y `ProtectedRoute`).
  - Aparte, se plantaron a mano 15 fallos en el servidor y 15 en el cliente, y los tests los detectaron
    todos. Entre ellos: quitar la condición `revoked_at IS NULL`, quitar el flag de un solo reintento,
    quitar la de-duplicación y tratar un fallo de red como un 401.

#### Decisiones tomadas por defecto en C2 y C3 (el diseño no las cubría, o se desvía por un motivo)

1. **Orden de la rotación.** El diseño dice reclamar el token viejo y después insertar el sucesor y rellenar
   `replaced_by`. Así, la segunda de dos peticiones simultáneas veía el token revocado con `replaced_by` a
   NULL, lo tomaba por reuso y revocaba la familia, incluido el token recién entregado a la primera.
   - **Se hace así:** el sucesor se inserta antes, y `revoked_at` y `replaced_by` van en el mismo `UPDATE
     ... WHERE id = $id AND revoked_at IS NULL`, que sigue siendo la única puerta.
   - Si ese `UPDATE` no afecta a ninguna fila, el sucesor huérfano se borra y se sigue por el margen de gracia.
   - **Comprobado:** con el orden literal fallan justo los dos tests de concurrencia (a través de Express y
     en el módulo), y con este pasan.
   - **Aprobado por la revisión el 28 sep:** conserva la atomicidad (el `UPDATE` condicional sigue siendo la
     única puerta) y elimina el falso positivo de reuso.
2. **Sin `REFRESH_TOKEN_HASH_SECRET`**, el servidor no se cae:
   - el inicio de sesión funciona sin refresh token y queda un error en el log. La sesión dura como mucho
     1 hora, y se pierde al recargar la página o al abrir otra pestaña: el access token solo vive en memoria;
   - `refresh` y `logout` responden 503, no 401, para que el cliente no cierre la sesión (pasa a
     `reconectando`).
3. **Nombres de la respuesta.** Login, registro y Google mantienen `token` (el access token, con el mismo
   nombre de siempre) y añaden `refreshToken`. `refresh` devuelve `{ accessToken, refreshToken }`, como dice
   el diseño.
4. **H21:**
   - la revocación de todas las sesiones va **antes** de guardar el cambio de contraseña o email: si fallara,
     no se cambia nada;
   - la sesión que hace el cambio recibe un refresh token nuevo, para no quedarse fuera;
   - cambiar solo el nombre no revoca nada, y la respuesta no trae `refreshToken`.
   - **Interpretación definitiva, aprobada el 28 sep:** se revocan todas las sesiones menos la que hace el
     cambio (la revisión había pedido "todas, incluida la actual"). Esa sesión acaba de demostrar la
     contraseña, así que es legítima; es lo que hacen GitHub y Slack.
5. **`apiFetch` solo para las peticiones con sesión** (las diez que llevaban `authHeaders()`). El diseño dice
   "todas", pero también que el comportamiento del camino feliz no cambie. Si las públicas llevaran
   `Authorization`:
   - se saltarían la caché de la CDN para todo el que haya iniciado sesión (H16);
   - el 401 de una contraseña incorrecta intentaría renovar la sesión.
6. **`reconectando` vive en `ProtectedRoute`**, que es donde importa no leer sin token. Las páginas públicas
   no esperan a nada.
7. **`logout` espera al servidor un máximo de 5 s** y después cierra la sesión local igual. El diseño dice
   "después de que la llamada responda, o de todos modos si falla por red"; sin tope, un servidor colgado
   retrasaría el cierre.
8. **Sesiones de antes del bloque 3b** (solo `kaveToken`, sin refresh): se sigue usando ese token hasta que
   caduque (opción 1). No se renueva al cargar. Cuando dé 401, se cierra la sesión.
9. **`user_agent` e `ip`:** la ip solo se guarda si es una dirección válida. La columna es `inet`, y un valor
   raro haría fallar el `INSERT` y con él el inicio de sesión.
10. **Un cuerpo sin refresh token es un 400** (petición mal formada), distinto del 401 genérico de un token
    que no vale.
11. **`limpiarExpirados()` existe** (con test), pero no lo llama nada. Es la consulta de mantenimiento de abajo,
    para cuando la tarea 7 monte algo programado.

#### Comprobación de concurrencia contra la base de datos real (29 sep 2026, con permiso)

- **Cómo:**
  - un script de usar y tirar (no está en el repositorio, como pide la regla de no commitear las pruebas
    contra la base real) levantó el servidor local contra la base de producción, con un
    `REFRESH_TOKEN_HASH_SECRET` generado en memoria para la prueba;
  - creó filas de prueba en `refresh_tokens` con `refreshTokens.emitir()`, marcadas con el `user_agent`
    `verificacion-concurrencia-29sep`, y lanzó peticiones reales a `POST /api/auth/refresh`;
  - no imprimió ningún token.
- **Desviación del protocolo:** el `user_id` no podía ser aleatorio, porque tiene clave foránea a `clientes`.
  Se usó la cuenta del administrador. La tabla estaba vacía antes (0 filas), así que no había sesiones
  reales que tocar.
- **Resultado:**
  1. **Dos refresh a la vez con el mismo token, 5 rondas:**
     - en las 5, las dos peticiones reciben 200, con pares distintos;
     - en las 5, la que pierde el `UPDATE` condicional borra su sucesor huérfano, que es la prueba de que
       llegaron de verdad a la vez y de que Postgres dejó ganar a una sola;
     - cada familia queda con 3 filas (la original, el sucesor de la ganadora y el del salto por el margen de
       gracia), una sola activa, y cada revocada apunta a su sucesora.

     La revisión esperaba "la otra recibe 401 (sin margen) o el mismo par (con margen)". Con el margen, lo que
     hace el código es un salto: la segunda recibe un par nuevo, derivado del sucesor de la primera, no el
     mismo par. Es el comportamiento del diseño, y el de los tests (`refreshTokens.test.js`, "concurrencia
     real").
  2. **Fuera del margen:** el token viejo presentado 61 s después de rotarlo da el 401 genérico ("Sesión no
     válida, vuelve a iniciar sesión."), el log dice "reuso detectado, familia ... revocada entera" y la
     familia queda con 0 filas activas de 2.
  3. **Limpieza:** las 6 familias de prueba se borraron en el `finally`. Una consulta aparte confirma que
     `refresh_tokens` vuelve a tener 0 filas.
- **Conclusión:** el `UPDATE ... WHERE id = $id AND revoked_at IS NULL` es la única puerta también en la base
  de datos real, igual que en el doble de los tests. El orden de rotación de C2 aguanta la concurrencia de
  verdad.

#### Rotar `REFRESH_TOKEN_HASH_SECRET`

Invalida de golpe todos los refresh tokens emitidos, porque su HMAC deja de coincidir con el guardado, y
obliga a todo el mundo a volver a iniciar sesión. Es la mitigación de emergencia si se sospecha que se ha
filtrado. Cambiar solo `JWT_SECRET` ya no basta para cerrar las sesiones: el cliente pide otro access token
con su refresh.

#### Mantenimiento de `refresh_tokens`

Para lanzarla a mano de vez en cuando (se guardan 30 días más allá de la caducidad por si hay que investigar
un reuso):
```sql
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days';
```

#### Antes de desplegar el bloque 3b (merge a `main`)

Guía paso a paso para el usuario, con las consultas SQL y la limpieza: `docs/verificacion-3b.md`.

1. **El usuario** genera `REFRESH_TOKEN_HASH_SECRET` (`openssl rand -hex 32`) y lo pone en las variables de
   producción de `nave5-api` en Vercel y en su `server/.env`. No pasa por la conversación.
2. **Comprobación en el navegador en local:**
   - iniciar sesión;
   - recargar la página (recupera la sesión sin pedir la contraseña);
   - cerrar sesión (la familia queda revocada; se comprueba por SQL);
   - simular un 401 (el reintento funciona).

   Las filas que deje en `refresh_tokens` de producción las borra el usuario después (punto 5 de arriba).
3. ~~La comprobación de concurrencia contra la base real~~ **Hecha el 29 sep**, con resultado correcto
   (ver "Comprobación de concurrencia contra la base de datos real", arriba).
4. **Permiso para el merge.**

## ✅ Pausa de despliegue cerrada (bloque 3a): A3 aplicada el 24 sep 2026

- **Merge a `main` y deploy:** commit `6d6624a` (merge de `feature/mejoras-tecnicas`, incluye H8, A1, A2 y
  la doble escritura de `categoria_id`), pusheado y desplegado en producción el **22 sep 2026**:
  - `nave5-api`: `READY`, `2026-09-22T13:47:42.487Z` (deployment `dpl_2xiJDjJVMJn8ArPuAijVw2QbLJ2m`).
  - `nave5-demo`: `READY`, `2026-09-22T13:47:42.800Z` (deployment `dpl_Beu7cVPggJb6jnusAcBMhkuoUGPL`).
  - Ambos verificados vía la API de Vercel, no asumidos.
- **Ventana de espera:** 24-48h desde la hora de arriba antes de aplicar A3 (backfill de
  `muebles.categoria_id`). Monitorizar errores si hay forma de hacerlo (logs de Vercel; no hay Sentry
  configurado todavía).
- **Verificación antes de aplicar A3** (con la hora exacta de arriba):
  ```sql
  SELECT count(*) FROM muebles WHERE created_at > '2026-09-22T13:47:42Z' AND categoria_id IS NULL;
  ```
  Debe dar `0` -- cualquier mueble creado/editado después del deploy ya debería tener `categoria_id`
  relleno (o `NULL` solo si su `categoria` no coincide con ninguna real, ver H11). Si da más de 0 por un
  fallo del código (no por H11), parar y diagnosticar antes de aplicar A3.
- **Resultado del 24 sep (~45 h después del deploy): sin movimiento, así que el 0 no demuestra nada.**
  - `muebles` no tiene `updated_at`, así que las ediciones no se pueden fechar. Se usa otra señal: A1 creó
    `categoria_id` a NULL en todas las filas y A3 aún no se ha aplicado, así que una fila con `categoria_id`
    relleno solo puede venir de la doble escritura nueva (al crear o al editar).
  - Datos: 114 muebles; 0 creados después del deploy (el último, el 3 sep); **0 con `categoria_id`**, así que
    tampoco hubo ediciones con categoría. La consulta de verificación da 0, pero por falta de datos.
  - Todos tienen `descripcion` a NULL. Guardar una pieza real desde el modal de edición la cambiaría a `''`,
    porque el modal reenvía todos los campos. Por eso la prueba manual se hace con una pieza de prueba y no con
    una real.
- **Prueba manual en producción (24 sep, con permiso), con una pieza de prueba y sin tocar ninguna real:**
  - **Alta:** creada desde el panel "PRUEBA A3 — borrar", en "Sillas y asientos". La fila quedó con
    `categoria_id = 20`, que es el id de esa categoría. El camino de alta funciona.
  - **Edición:** cambiada a "Iluminación" desde el modal, quedó con `categoria_id = 7`. El camino de edición
    funciona.
  - Con la pieza aún creada, las consultas dieron: movimiento 1, verificación 0 y ninguna fila con el id y el
    nombre de categoría que no cuadren.
  - **Limpieza:** Ashe borró la pieza desde el panel y su foto en Storage
    (`imagenes/muebles/dqhvp59jjl6-1790255381596.webp`). Se comprobó por SQL que no queda ninguna de las dos.
  - De paso apareció H16: el panel no veía sus propios cambios sin recargar, por las cachés. Corregido en
    `63f1324`, desplegado con el merge `a1a7dfe` del 24 sep.
- **A3 aplicada** (24 sep, con permiso) como migración `20260924133146_backfill_muebles_categoria_id`:
  - Comprobado antes, sin aplicar nada: se rellenarían 114 filas, sin nombres de categoría huérfanos ni
    duplicados y sin ninguna pieza en una categoría general. El trigger `trg_sync_disponible_desde_estado`
    salta en cada `UPDATE`, pero no cambia nada porque `disponible` ya estaba sincronizado en las 114.
  - **Verificación después de aplicarla:**
    ```sql
    SELECT count(*) FROM muebles WHERE categoria IS NOT NULL AND categoria_id IS NULL;  -- 0
    SELECT count(*) FROM muebles WHERE categoria_id IS NOT NULL
      AND categoria IS DISTINCT FROM (SELECT nombre FROM categorias WHERE id = categoria_id);  -- 0
    ```
    Las 114 filas tienen `categoria_id`, y `disponible` sigue sincronizado.
  - La copia en `server/migrations/` coincide byte a byte con lo que registra `schema_migrations`: el mismo
    MD5 sin el salto de línea final, como en A1 y A2. El `.down.sql` avisa de que, en producción, la reversión
    correcta es volver a ejecutar A3 hacia delante, porque es idempotente.

## Pasos manuales tras desplegar la tarea 1

1. **Vercel** (proyecto de la API): añadir `STRIPE_WEBHOOK_SECRET`. Mientras no exista, el webhook responde 503
   y los pedidos solo se registran cuando el comprador llega a la página de éxito.
2. **Dashboard de Stripe** (modo test): Desarrolladores > Webhooks > Añadir endpoint con la **URL final**
   (`https://<api>/api/stripe/webhook`, sin redirecciones: Stripe cuenta una 3xx como fallo) y el evento
   `checkout.session.completed`. Copiar el "Secreto de firma" a la variable anterior.
3. **Vercel**, comprobar en el proyecto: que las variables de sistema estén expuestas (`trust proxy` depende
   de `VERCEL`), que Deployment Protection no cubra la API (Stripe recibiría 401) y el `maxDuration`.
4. Enviar un evento de prueba desde Stripe y comprobar respuesta 200, pedido en el panel y emails. Si con una
   firma correcta respondiera 400, revisar el log: "el cuerpo no llegó como Buffer" indicaría que algo parsea
   el cuerpo antes de tiempo.

## Tarea 2: seguridad y validación (detalle)

- **CSP servidor:** `default-src 'none'` en helmet (`server/src/index.js`) -- la API solo devuelve JSON, no sirve
  HTML ni ejecuta nada en un navegador, así que es la política más restrictiva posible. HSTS no se ha tocado
  porque helmet ya lo activaba por defecto (comprobado, no solo asumido: `max-age=31536000; includeSubDomains`
  ya estaba presente antes de esta tarea).
- **CSP cliente (`client/vercel.json`):** `Content-Security-Policy-Report-Only`, sin pasar a enforcing. Dos
  matices sobre las directivas:
  - Se quitó un comodín `https://*.vercel.app` de `connect-src` que había puesto yo mismo por descuido: mismo
    problema que el comodín de CORS que esta tarea elimina (cualquiera puede desplegar un proyecto en Vercel).
    Si algún día un despliegue de vista previa del backend necesita ser alcanzado desde un preview del
    frontend, hay que añadir su origen exacto a `connect-src` a mano -- misma fricción aceptada que con
    `ALLOWED_ORIGINS` en CORS.
  - `script-src` y `connect-src` incluyen `js.stripe.com`/`api.stripe.com` a petición explícita, aunque **el
    checkout actual no los usa** (es una redirección de página completa a `session.url`, no Stripe.js/Elements
    embebido -- comprobado, no hay ningún `loadStripe`/`@stripe/stripe-js` en el cliente). Quedan preparados
    para cuando las pestañas "Apple Pay"/"Bizum" del checkout tengan una implementación real; si eso no llega a
    pasar, se pueden quitar sin que nada se rompa.
  - **Antes de pasar a enforcing** (visto en el smoke test del 26 sep): el botón de Google de `/login` carga
    la hoja de estilos `https://accounts.google.com/gsi/style`, y `style-src` no la permite. Hoy solo sale un
    aviso en la consola, porque la política es report-only. En enforcing, el botón se quedaría sin estilos.
    Hay que añadir ese origen a `style-src`.
- **CORS:** `CLIENT_URL` + `ALLOWED_ORIGINS` (lista separada por comas, orígenes exactos), sin comodín.
- **`data/supabase.js` falla al arrancar** sin `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; ya no hay respaldo a
  la clave `anon`. `.github/workflows/ci.yml` define ambas como variables de prueba para el job del servidor.
- **Zod** en auth/muebles/pedidos/contacto (`server/src/schemas/`), con un middleware común
  (`middleware/validar.js`) y una clase `ErrorValidacion` (`utils/errores.js`) que distingue, en el manejador de
  errores central y en `crearSesionPago`, qué mensajes se le pueden mostrar tal cual a quien hizo la petición.
  `categorias` queda fuera a propósito (no estaba en el alcance pedido).
- **Escape de HTML en emails:** H2 resuelto (ver abajo).
- **Cambios de comportamiento deliberados** (documentados y probados, no hace falta revisarlos de nuevo):
  - El formulario de contacto ahora **rechaza** (400) un nombre/email/mensaje demasiado largo en vez de
    recortarlo en silencio como antes.
  - `actualizarPerfil` ahora rechaza un `nuevoNombre` vacío y exige formato de email en `nuevoEmail` (antes no
    validaba ninguno de los dos).
  - `crearSesionPago`: un error que no sea de validación ahora responde 500 genérico en vez de 400 con el
    mensaje interno tal cual (ver H3 más abajo).
- **Bug real encontrado y corregido durante esta tarea, en código de la propia tarea:**
  `schemas/muebles.js` (`precioOpcional`) trataba un precio de solo espacios (`'   '`) como `0` en vez de vacío,
  porque `Number('   ')` vale `0` en JavaScript, no `NaN`. Detectado por una revisión adversarial antes de
  commitear; corregido con un `.trim()` y cubierto con un test.
- **Pendiente al desplegar:** configurar `ALLOWED_ORIGINS` y `SUPABASE_SERVICE_ROLE_KEY` en las variables de
  entorno de Vercel *antes* de desplegar esta rama -- sin la segunda, el servidor no arranca en absoluto.

## Tarea 3: migraciones (detalle)

- **`apply_migration` (la migración nativa de Supabase) envuelve el SQL en una transacción implícita, así
  que NO admite `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY`.** El diseño original (ver
  `docs/tarea3-diseno.md`) daba esto por hecho y preveía probarlo antes de aplicar el primer índice; ya se
  probó contra la base real -- una tabla desechable (`_test_probe_h8`) creada, usada y borrada en el mismo
  turno, sin dejar rastro ni en el esquema ni en el historial de migraciones (la transacción fallida
  deshizo también su propio registro) -- y Postgres rechazó la instrucción con exactamente el error
  esperado: `ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.
- **Decisión:** los índices de esta tarea (`muebles.categoria_id`, `pedidos.cliente_id`) se crean con
  `CREATE INDEX` normal, sin `CONCURRENTLY`. Con 114 filas en `muebles` y unas pocas en `pedidos`, el lock de
  escritura que impone un `CREATE INDEX` normal dura milisegundos -- `CONCURRENTLY` está pensado para tablas
  de millones de filas, donde ese lock duraría minutos; aquí sería sobre-ingeniería, y además la herramienta
  de migraciones del proyecto no lo admite.
- **Si `muebles` o `pedidos` llegan a crecer a decenas de miles de filas, revisar este punto:** la
  alternativa sería ejecutar el `CREATE INDEX CONCURRENTLY` a mano desde el SQL Editor de Supabase (esa
  conexión sí ejecuta fuera de una transacción), no algo que se pueda automatizar con `apply_migration`.

## Tarea 7 — CI (28 sep 2026)

### Qué se hizo
- **`npm audit` en los dos jobs, en modo informativo.** Es un paso con `continue-on-error`: enseña las
  vulnerabilidades en el log de cada ejecución, pero no rompe el build. Lo que salió el 28 sep está en H23.
- **Umbral de cobertura en el servidor.** Se usa la cobertura que trae Node (`npm run test:coverage`), sin
  paquetes extra, y excluye los propios tests.
  - El umbral es del 50% en líneas, ramas y funciones: si baja de ahí, el CI falla. Se empieza bajo para no
    bloquear.
  - **El 28 sep la cobertura era del 85,7% en líneas, 81,3% en ramas y 94,1% en funciones.** La próxima vez
    se puede subir el umbral a algo como 80 / 75 / 90, que ya pararía una bajada de verdad.
  - En el CI, `npm test` pasa a ser `npm run test:coverage`, que ejecuta los mismos tests. El gate local sigue
    con `npm test`.
- **`.gitattributes` con `* text=auto eol=lf`.** Git guarda y saca los archivos de texto con LF también en
  Windows. Se acaban los avisos de "LF will be replaced by CRLF" y los falsos cambios de fin de línea.
  - Al añadirlo se normalizaron los tres archivos que el repositorio todavía guardaba con CRLF
    (`client/src/styles/Catalog.css` y `Home.css`) o con los dos (`.gitignore`). Es solo el fin de línea, sin
    cambiar el contenido.
  - Los binarios (imágenes) siguen siendo binarios.

- **Umbral de cobertura en el cliente** (28 sep, con permiso para instalar `@vitest/coverage-v8`):
  - `@vitest/coverage-v8` 2.1.9, la misma versión que vitest, como dependencia de desarrollo;
  - `npm run test:coverage` (`vitest run --coverage`), con la configuración y los umbrales en
    `vite.config.js`: cuenta el código de `src/`, sin los tests ni sus ayudas;
  - en el CI del cliente, `npm test` pasa a ser `npm run test:coverage`. El gate local sigue con `npm test`.
  - **Umbrales: 60% en ramas y funciones, 50% en líneas y sentencias.** El plan pedía 60% suponiendo que la
    cobertura del cliente rondaba el 85%, pero esa cifra era la del servidor. **La del cliente, medida el
    28 sep: 57,9% de líneas, 89,3% de ramas y 72,1% de funciones.** Un 60% en líneas habría roto el CI desde
    la primera ejecución (comprobado: sale con código 1 y "Coverage for lines (57.92%) does not meet global
    threshold (60%)"). Se deja el 50% en líneas, con el mismo margen que el servidor.
  - **Lo que baja la cifra de líneas:** las páginas sin tests (`Profile`, `Catalog`, `ProductDetail`,
    `Login`, `Home`, `Contact` y las legales), `CartContext` y la mitad de `api.js`. Cuando se suba de
    ~70%, el umbral de líneas puede pasar al 60%.
  - `npm audit` cuenta `@vitest/coverage-v8` 2.1.9 como crítica, pero no por un fallo propio: depende de
    vitest 2 (H23). Se arregla al subir los dos a vitest 5.

### Subida de la cobertura (29 sep 2026)

Regla: tras cada tanda de tests, los umbrales se ponen en lo medido menos medio punto, redondeado hacia
abajo, y no se bajan nunca. El medio punto es margen para las pequeñas diferencias de medición entre
versiones de Node (el CI usa la 22 y el local, la 24). Los del cliente están en `client/vite.config.js`; los
del servidor, en el script `test:coverage` de `server/package.json`. Las tablas redondean lo medido a un
decimal, pero el umbral se calcula con las dos cifras decimales: por ejemplo, el 94,47% de líneas del servidor
en `a307c6c` (94,5% en la tabla) da 94,47 − 0,5 = 93,97, es decir, 93.

**Cliente** (objetivo de la fase: 70% de líneas y 85% de funciones):

| Tanda | Commit | Líneas | Funciones | Ramas | Umbrales (líneas / funciones / ramas) |
|---|---|---|---|---|---|
| Antes | `ff01f41` | 57,9% | 72,1% | 89,3% | 50 / 60 / 60 |
| H24 (`utils/imagen.js` con sus tests) | `e644618` | 59,4% | 73,8% | 89,5% | 50 / 60 / 60 |
| utils | `0d56c7d` | 60,2% | 74,6% | 90,6% | 59 / 74 / 90 |
| services (`api.js`) | `430da77` | 64,7% | 80,9% | 92,1% | 64 / 80 / 91 |
| `CartContext` (con H25) | `4e7bbc3` | 66,8% | 81,8% | 92,0% | 66 / 81 / 91 |
| `FavoritesContext` | `af1a60d` | 67,3% | 82,2% | 92,2% | 66 / 81 / 91 |
| páginas | `64823e2` | 78,7% | 84,6% | 93,3% | 78 / 84 / 92 |
| componentes | `a03b944` | **81,7%** | **87,2%** | 94,2% | 81 / 86 / 93 |

Sin tests quedan sobre todo `Catalog`, `Home`, `ProductDetail`, las páginas legales, `App.jsx` y
`CategorySlider`.

**Servidor** (objetivo: 95% de líneas):

| Tanda | Commit | Líneas | Funciones | Ramas | Umbrales (líneas / funciones / ramas) |
|---|---|---|---|---|---|
| Antes | `a03b944` | 93,6% | 97,8% | 79,6% | 50 / 50 / 50 |
| utils, middleware e `index.js` | `a307c6c` | 94,5% | 98,6% | 81,6% | 93 / 98 / 81 |
| caminos de error de los controladores | `c4571be` | **95,2%** | 98,6% | 83,9% | 94 / 98 / 83 |

Lo que queda por debajo está en `authController` (88%) y `mueblesController` (79%): sobre todo sus
`catch` de 500 y la subida de fotos con `sharp` y Storage.

### Qué no se hizo, y por qué
- **vitest 5, vite 8 y react-router 7** (lo que queda de H23): son saltos de versión mayor, con su propia tarea.

## Tarea 8 — Documentación y limpieza de infraestructura

Hecha durante la pausa de despliegue de la tarea 3a (24-48h entre el commit de doble escritura de
`categoria_id` y el backfill A3): no toca BD, no toca Vercel, no hay push -- solo commits locales
en `feature/mejoras-tecnicas`, pensada para revisar por commit sin supervisión en el momento.

### Qué se hizo

- **`README.md`** en la raíz: stack, estructura de carpetas, cómo arrancar en local, tabla resumen
  de variables de entorno, comandos disponibles, cómo se despliega, enlaces al resto de la
  documentación.
- **`docs/env-vars.md`**: detalle completo de cada variable (qué hace, formato, dónde se obtiene,
  obligatoria/opcional, ejemplo enmascarado) de `server/.env.example` y `client/.env.example`.
- **`docs/architecture.md`**: diagrama de arquitectura (mermaid), flujo de compra completo, flujo
  de autenticación **actual** (señalando explícitamente que el refresh con rotación es la tarea 3b,
  todavía no implementada -- no se describió como si ya existiera), y una tabla de decisiones
  técnicas clave enlazando al detalle en vez de repetirlo.
- **ESLint + Prettier en `server/`**: `.eslintrc.cjs` (mismo formato legado que `client/.eslintrc.cjs`,
  `eslint:recommended` + `plugin:n/recommended` de `eslint-plugin-n`) y `.prettierrc.json`. Scripts
  `lint`/`format`/`format:check` nuevos. `.prettierignore` con los 4 archivos marcados como
  sensibles (`data/supabase.js`, `utils/email.js`, `utils/pagos.js`, `utils/metadataStripe.js`) --
  ninguno de los cuatro se ha tocado en ningún commit de esta tarea.
- **Formato aplicado** a los 43 archivos de `server/src/` que no estaban ya en el estilo de
  Prettier (2171 líneas, en su propio commit por el tamaño). Solo formato, verificado con los 182
  tests (sin cambios) tanto antes como después.
- **Dependencias**: `npm audit fix` (sin `--force`) resolvió las 5 vulnerabilidades que había
  (3 moderadas, 2 altas: `body-parser`, `brace-expansion`, `multer`, `qs`) sin salir de los rangos
  ya declarados en `package.json` (`express` y `multer` subieron de versión menor/parche dentro de
  su propio `^`, el resto son transitivas) -- 0 vulnerabilidades ahora. `engines.node` alineado a
  `>=22` también en `client/package.json` (el servidor y CI ya lo tenían). `@emnapi/runtime` y
  `@img/sharp-wasm32` (extraneous, binarios wasm de `sharp` para otra plataforma) limpiados de
  `node_modules` -- sin efecto en el repo (no está versionado) y no permanente (vuelven a aparecer
  en cualquier `npm install`/`npm audit` por cómo `sharp` declara sus `optionalDependencies`
  multiplataforma; no se ha encontrado ni intentado una forma de evitarlo).
- **CI** (`.github/workflows/ci.yml`): el job del servidor añade `npm run lint` y
  `npm run format:check` antes de `npm test`. Al probarlo localmente salieron 2 archivos que no
  habían quedado perfectamente formateados por el commit de formato anterior -- corregidos en el
  mismo commit que añade el paso que los habría pillado.

### Qué no se hizo, y por qué

- **`npm audit` no se añadió a CI**, tal como se pidió explícitamente: aunque ahora mismo el
  proyecto está limpio (0 vulnerabilidades), añadirlo al workflow implica antes decidir qué pasa
  cuando vuelva a encontrar algo -- ¿rompe el build hasta que se resuelva, o solo avisa sin
  bloquear? Es una decisión de política, no de estilo, así que se deja documentada para decidirla,
  no decidida aquí.
- **Ninguna regla de ESLint tuvo que desactivarse por un problema real de lógica en el código.**
  Lo único que falló en la primera pasada fue `n/no-unpublished-require` (ruido: este servidor
  nunca se publica en npm, se despliega como función de Vercel, así que la distinción
  dependencies/devDependencies "publicadas" no aplica) y dos variables sin usar, ambas eliminables
  sin tocar ningún comportamiento (confirmado con los 182 tests, sin cambios). No hubo ningún caso
  de "esto necesitaría cambiar lógica, lo anoto en vez de tocarlo".
- **El refactor de `Admin.jsx` por pestañas (resto de la tarea 4) no se ha tocado.** 1028 líneas,
  sin tests que lo cubran, diff potencialmente enorme -- exactamente el motivo por el que esta
  tarea se limitó a documentación e infraestructura y no a ese refactor.
- **Los tests como tarea propia (tarea 5), el frontend (tarea 6, más allá de la vista de
  inventario ya hecha) y el umbral de cobertura en CI (resto de la tarea 7) siguen enteros por
  hacer.**

## Tarea 5 — Tests (servidor + cliente)

Solo tests: ningún commit de esta tarea cambia comportamiento de producción. `Admin.jsx` y los tres
contexts (`AuthContext`, `CartContext`, `FavoritesContext`) quedan explícitamente sin tocar, tal
como se pidió.

### Qué se cubrió

**Servidor** (182 → 240 tests):
- `utils/upload.js`: subida con `sharp` real (imagen sintética, no un mock) y su *fallback* al
  archivo original cuando `sharp` no puede procesarlo -- solo se mockea `supabase.storage`.
- `utils/email.js`: asunto/destinatario/contenido de las 5 funciones de envío, y el modo
  simulación completo (sin `RESEND_API_KEY`, ninguna llama a la API real ni lanza).
- `categoriasController.js`: estadísticas (categoría específica vs. general, con y sin hijos),
  CRUD completo (401/403, tipos de `categoria_padre_id`, imagen por defecto vs. explícita).
- `pedidosController.js`: `obtenerMisPedidos` (filtro por email case-insensitive vía
  `cliente_info->>email`) y `obtenerPedidos` (admin). De paso, `PATCH /estado` con un id
  inexistente (caso que faltaba en `validacionPedidos.test.js`).
- `mueblesController.js`: lectura (`?limit`, caché) y búsqueda por nombre, que no tenían ningún
  test todavía.
- `fakeSupabase.js` (el doble en memoria de Supabase) se amplió con `.order()`, `.delete()`,
  `.ilike()` (con soporte del atajo `columna->>clave` de PostgREST) y un helper `aplicarSalida`
  compartido para que `.single()`/`.maybeSingle()` se comporten igual detrás de un
  `update()`/`delete()` que detrás de un `select()` -- ver "hallazgo" más abajo.

**Cliente** (30 → 118 tests), ninguno de los siguientes tenía test antes de esta tarea:
- `useDocumentMeta` (título/descripción/OG/Twitter, `noindex`, cleanup al desmontar).
- Componentes pequeños: `ToastContext` (éxito/error, auto-cierre a los 3s, cierre manual),
  `CookieConsent` (banner según consentimiento guardado, los dos botones), `ProductSkeleton`
  (estructura estática).
- Componentes medianos: `Header` (sesión, favoritos/cesta, tema claro/oscuro persistente,
  buscador en vivo), `CartDrawer` (estado vacío, cupón, eliminar artículo, abre `AuthModal` o
  `CheckoutModal` según haya sesión), `QuickViewModal` (precio/estado/favoritos, accesibilidad:
  foco, Escape, bloqueo de scroll).
- `CheckoutModal` (validación de formulario, pestañas, flujo de pago con Stripe mockeado) y una
  ampliación de `ProductCard` (favoritos, estado alquilado, apertura de `QuickViewModal`).
  Contra lo que decía el plan original, ambos se pudieron mockear sin demasiado boilerplate
  (`CartContext`/`FavoritesContext`/`AuthContext`/`ToastContext` falsos vía `Context.Provider`,
  y `services/api` mockeado en vez de golpear la API real) -- no hizo falta documentar ningún
  "no se pudo probar".

### Qué se dejó fuera, y por qué

- **`server/utils/format.js`** (mencionado en el plan original) **no existe** en el servidor --
  `format.js` es un archivo del cliente (`client/src/utils/format.js`, ya cubierto antes de esta
  tarea). No es un error de copia/pega al escribir *este* prompt: es un fallo del prompt
  original con el que se diseñó la propia tarea 5, según confirmó quien lo escribió. No había
  nada que hacer ahí.
- **`metadataStripe.js`** ya estaba cubierto a fondo por la tarea de H1 (unitarios + contrato
  contra Stripe real), incluido en el estado de tareas más arriba -- no se ha duplicado esfuerzo.
- **"Crear mueble sin imagen" y "editar sin cambios"** ya estaban cubiertos antes de esta tarea
  por `validacionMuebles.test.js` (su PUT con body vacío es exactamente ese caso).
- **E2E** sigue sin empezar: no hay infraestructura (Playwright/Cypress) en el repo todavía: es
  una decisión de herramienta y de alcance mayor que esta tarea, no una omisión.
- **`AuthContext`/`CartContext`/`FavoritesContext` no tienen test dedicado propio.** Se probó su
  *forma* (via `Context.Provider` con valores de mentira) en los componentes que los consumen,
  pero su lógica real -- persistencia en `localStorage`, `validateCart` contra la API, claves de
  almacenamiento por usuario -- sigue sin un test que la ejercite directamente. **A propósito, no
  pendiente por descuido:** la tarea 3b va a reescribir `AuthContext.jsx` de arriba abajo (access
  en memoria, refresh en `localStorage`, sincronización entre pestañas, logout con revocación).
  Escribir esos tests ahora significaría reescribirlos otra vez en cuanto 3b aterrice -- se
  espera a que 3b esté hecha.

### Hallazgo (en el doble de Supabase, no en producción)

Al escribir el test de `pedidosController` para "actualizar el estado de un pedido inexistente",
`.update(...).eq('id', id).select().single()` devolvía `200 []` en vez del error de 0 filas que
Postgres/PostgREST dan de verdad para `.single()`, sin importar qué verbo precedió la consulta.
Era un hueco de fidelidad de `fakeSupabase.js` (`.single()`/`.maybeSingle()` solo se aplicaban
detrás de un `select()`, nunca detrás de un `update()`/`delete()`), **no un bug del controlador**:
`actualizarEstadoPedido` ya hacía bien su comprobación `if (error || !data) return 404`, solo que
el doble no reproducía el error que debía dispararla. Corregido con el helper `aplicarSalida`
compartido entre las tres ramas; las 240 pruebas del servidor pasan sin regresiones tras el
cambio.

**Verificado (revisión posterior) qué código de producción usa realmente esa rama:** de los 4
sitios que hacen `.update()` en los controladores, solo `pedidosController.actualizarEstadoPedido`
encadena `.select().single()` -- `authController` y `categoriasController` usan `.select()` sin
`.single()` (esperan un array, así que el hueco no les afecta). De los 2 sitios que hacen
`.delete()`, ninguno encadena `.select()` en absoluto, así que el soporte de `.single()`/
`.maybeSingle()` tras un `delete()` en `aplicarSalida` no lo ejercita ningún controlador todavía
-- existe por coherencia con `update()`, no porque haga falta hoy.

**¿Algún test de antes de la tarea 5 pasaba en verde por el hueco, y ahora sigue en verde por otra
razón?** Sí, uno: `validacionPedidos.test.js` → *"un estado válido se acepta y actualiza el
pedido"* (`pedido-1`, que sí existe). Antes de este arreglo, la rama `update` del doble ignoraba
`consulta.salida` y devolvía siempre un array (`[{...pedido}]`), aunque el controlador pidiera
`.single()` -- es decir, el doble le entregaba a `actualizarEstadoPedido` la forma equivocada (un
array donde Supabase real da un objeto). Ese test seguía en verde solo porque nunca comprueba la
forma de `res.body` (solo el status 200 y el estado en `fake.tablas.pedidos[0]`), así que la
discrepancia era invisible para él tanto antes como después del arreglo. Tras el arreglo, el doble
ya entrega la forma correcta (objeto), y el test sigue en verde -- ahora sí por la razón correcta.
**No llegó a esconder ningún bug de producción:** ni el controlador (`res.json(data)`, reenvía
`data` tal cual sin leer ningún campo suyo) ni el cliente
(`client/src/pages/Admin.jsx:handleCambiarEstadoPedido`, solo comprueba `if (res)` y actualiza el
estado local con el valor que él mismo mandó, no con el cuerpo de la respuesta) llegan a
inspeccionar la forma de ese `data` -- así que el hueco era real en el doble, pero inofensivo en
la práctica. Se confirmó revisando los 4 puntos de `.update()`/`.delete()` de los controladores
uno por uno, no por inspección superficial.

### Nota sobre `ProductCard` y `alquilado` (comportamiento observado por los tests, sin decisión documentada)

Al escribir el test de `alquilado` se confirmó que ese estado también oculta el botón "Vista
rápida" -- igual que "vendido" -- algo que no estaba cubierto por ningún test hasta ahora.
**Corrección a la primera versión de esta nota:** se había descrito como "intencional", pero eso
no estaba verificado -- era una inferencia mía a partir de la simetría del propio código, no un
hecho contrastado. Revisado a fondo: no hay ningún comentario en `ProductCard.jsx`, ninguna
entrada previa en este documento ni ningún mensaje de commit que explique la decisión. El
commit que introdujo la condición (`31f1e98`, "Add dark mode, refreshed typography, quick view,
and fix rental price bug", 3 sep 2026) la añade como parte de un commit grande de rediseño visual,
sin mencionar el motivo. Es decir: **es un comportamiento real del código, descubierto por los
tests, no una decisión de negocio documentada.** Tiene una lectura plausible (no ofrecer "añadir a
la cesta" rápido para una pieza ya alquilada, igual que para una vendida), pero eso es una lectura,
no una confirmación. Queda así, sin tocar el código, hasta que se confirme si es el comportamiento
que se quiere o si "alquilado" debería seguir permitiendo la vista rápida.

**Pendiente:** ProductCard oculta Vista rápida para muebles en estado `alquilado`. Comportamiento
del código (commit `31f1e98`, 3 sep), sin justificación documentada. Pendiente de preguntar al
cliente si es intencional o si debe cambiarse cuando se implementen las reservas por fechas.

## Hallazgos

Resumen a 29 sep 2026 (cierre de la auditoría de seguridad), con H32 añadido el 2 oct, por estado. El detalle de cada uno va debajo, por
número.

**Cerrados en la rama, pendientes de desplegar** (entran con el merge; cómo comprobarlos, en
`docs/verificacion-3b.md`):

| Hallazgo | Cerrado |
|---|---|
| H10 · roles ARIA de la tabla del catálogo | 28 sep |
| H14 · un solo `status` en el panel | 28 sep |
| H21 · cambiar la contraseña no cerraba sesiones | 28 sep |
| H22 · CSP de Google Sign-In | 28 sep; se comprueba tras el deploy (sección 4.1 de la guía) |
| H24 · subir fotos: límite de 4,5 MB de Vercel | 29 sep |
| H25 · la cesta no avisaba de "pieza única" | 29 sep |
| H26 · los endpoints públicos devolvían más de lo que usa la web | 29 sep |
| H27 · datos personales en el log en modo simulación de correo | 29 sep |
| H28 · `perfil-update` sin límite de intentos de contraseña | 29 sep |
| H29 · `crear-sesion-pago` sin límite de peticiones | 29 sep |
| H30 · "Panel Admin" en el pie de página sin sesión | 29 sep |
| H32 · la ficha se inventaba una "Ref. SKU-…" | 2 oct (A6) |

**Cerrados, ya en producción o en la base de datos:**

| Hallazgo | Cerrado |
|---|---|
| H1 · metadata de Stripe | 22 sep |
| H2 · emails sin escapar | 22 sep |
| H8 · `SUPABASE_URL` con `http://` | 22 sep |
| H9 · RLS de `pedidos` | 24 sep (en la base de datos) |
| H16 · caché del panel | 24 sep |
| H17 · ILIKE en "Mis pedidos" | 24 sep |
| H19 · fallo suelto de `npm test` | 25 sep: no reproducible |
| H3 · errores sin filtrar | 28 sep: auditados todos los controladores, sin más casos |

**Decidido, pendiente de implementación:**

| Hallazgo | Estado |
|---|---|
| H12 · contratos de error de `api.js` | Decidido el 29 sep; se implementa cuando haya que tocar `api.js` por otro motivo (probablemente las reservas). Decisiones en la sección H12. Caso adicional del 2 oct: el error de código de categoría repetido |

**Parcial:**

| Hallazgo | Estado |
|---|---|
| H23 · vulnerabilidades del cliente | 8 de 15 arregladas. Las 7 que quedan piden versión mayor (react-router 7, vite 8, vitest 5): tarea aparte, después de mergear 3b |

**Dependen del cliente:**

| Hallazgo | Estado |
|---|---|
| H18 · el registro no verifica el email | Alta. Diseño para decidir en `docs/verificacion-email-diseno.md` |
| H6 · la confirmación va al email tecleado | Se cierra con H18, y usando el email de la cuenta en el checkout |

**Deuda aceptada:**

| Hallazgo | Estado |
|---|---|
| H4 · límites de peticiones en memoria | El límite es por instancia de Vercel, no un total. Vale también para los límites nuevos de H28 y H29 |
| H5 · límite de la detección de doble venta | Se cierra con el diseño de reservas |
| H20 · código de B sin comprobar de extremo a extremo | Se reabre si un pedido real llega sin `cliente_id` (sección 7 de `docs/verificacion-3b.md`) |

**Deuda aceptada (2 oct):** H33 · dos secretos legibles en el panel de Vercel; se cambia si entra un
colaborador. H34 · sin `canonical` ni `og:url`; se añaden cuando haya SEO por página en el HTML servido.

**Pendientes de una decisión del cliente (negocio o UX):**

| Hallazgo | Estado |
|---|---|
| H7 · alquilar un día bloquea la pieza | Negocio; lo resuelven las reservas |
| H11 · `categoria_id` a NULL para siempre | Decisión pendiente |
| H13 · formularios que sobreviven al cambio de pestaña | UX |
| H15 · categoría preseleccionada | UX |

### H1 · CERRADO (22 sep 2026, commit `1e23a5d`; en producción) · El límite de 500 caracteres de la metadata de Stripe podía impedir pagar

- **Qué se hizo:** `server/src/utils/metadataStripe.js` reparte el carrito en varias claves (`items_0`,
  `items_1`...) y valida cada dato del comprador contra el límite de 500 caracteres antes de llamar a Stripe,
  con mensaje en castellano. El checkout (`client/src/components/CheckoutModal.jsx`) tiene ahora `maxLength` en
  todos los campos de texto.
- **Verificado:** unitarios (`metadataStripe.test.js`, incluida una comprobación de ida y vuelta de 1 a 120
  piezas), extremo a extremo con dobles (`crearSesionPago.test.js`, carrito grande + nota larga = pago OK) y un
  test de contrato contra la **API real de Stripe en modo test** (`__tests__/contract/stripe.contract.js`, no
  forma parte de `npm test`; se lanza a mano con `npm run test:stripe` si hay una `STRIPE_SECRET_KEY` de prueba
  en `server/.env`). Ese último test reproduce el fallo original contra Stripe de verdad, no solo contra su
  documentación.
- **`npm run test:stripe` ejecutado (22 sep 2026) con una clave de prueba real** (`STRIPE_SECRET_KEY` en
  `server/.env`, que sigue sin subirse al repo): 7/7 tests contra la API real. Confirmado contra Stripe de
  verdad, no solo su documentación: los límites de 500 caracteres/50 claves son exactamente esos, el formato
  antiguo (un solo valor) falla con 7 piezas —el fallo original, reproducido tal cual—, y el formato nuevo
  funciona con 7, con 100 piezas y con notas de 500 caracteres. Las sesiones de prueba creadas se caducan solas
  al terminar el test, no quedan abiertas en el Dashboard.
- **Recordatorio pendiente:** rotar `sk_test_...i74t` cuando Stripe permita caducidad configurable o al pasar a
  modo live, si sigue activa.
- **Nota de honestidad ya superada:** la distinción `ErrorMetadata`/`ErrorValidacion` no cambiaba nada
  observable hasta que se resolvió H3 (tarea 2). Ahora sí importa: ver H3.

### H2 · CERRADO (22 sep 2026, tarea 2, commit `15305d9`; en producción) · Plantillas de email antiguas sin escapar HTML

- **Qué se hizo:** `escaparHtml` (ya existía para `enviarAlertaAdmin`, de la tarea 1) se aplicó también en
  `construirHtmlVenta`, `construirHtmlConfirmacionCliente`, `construirHtmlBienvenida` y en la plantilla inline
  de `enviarMensajeContacto`.
- **Verificado:** `emailEscape.test.js`, con un payload `<script>alert(1)</script> & "Cía" <img src=x
  onerror=alert(2)>` en cada campo relevante (nombre, email, teléfono, dirección, notas del comprador; nombre
  de pieza; nombre del cliente en el email de bienvenida; nombre/email/mensaje del formulario de contacto):
  ninguna etiqueta `<script>`/`<img>` sobrevive, el texto queda escapado.

### H3 · CERRADO (28 sep 2026; la parte de `crear-sesion-pago`, en la tarea 2) · `crear-sesion-pago` devolvía el mensaje de error sin filtrar

- **Qué se hizo:** el `catch` de `crearSesionPago` distingue ahora `ErrorValidacion` (400, mensaje tal cual --
  cubre carrito/datos del comprador que no caben en la metadata, y piezas no disponibles, que ahora lanzan
  `ErrorValidacion` en vez de `Error`) de cualquier otro error (500, mensaje genérico, detalle solo en el log).
  Antes, cualquier excepción (incluida una caída real de la API de Stripe) se devolvía como 400 con su
  `.message` sin filtrar.
- **Verificado:** test en `confirmarSesion.test.js` que fuerza un fallo interno de Stripe y comprueba que la
  respuesta es 500 genérica, sin la cadena del error interno en ningún sitio del cuerpo. Mutación: revertir la
  distinción hace fallar ese test.
- **Auditoría del resto (28 sep 2026), lo que quedaba abierto.** Se revisaron todas las respuestas de error de
  `server/src` (controladores, middleware, rutas e `index.js`):
  - **todas llevan un texto fijo**, escrito a mano;
  - **solo dos devuelven el `.message` de un error**, y en los dos casos es un `ErrorValidacion`: el `catch` de
    `crearSesionPago` y el manejador global de `index.js`;
  - los `ErrorValidacion` se crean con textos fijos, a los que solo se añade:
    - el id de la pieza, que viene de la propia petición;
    - el nombre de la pieza (`mueble.nombre`, en `mueblesController.js`), que sale de la base de datos pero
      es un dato público del catálogo;
    - el límite de longitud de un campo (`max`, en `metadataStripe.js`), una constante del servidor;
    - o el mensaje de Zod del middleware `validar()`, que habla de la petición y no del servidor.

    Nada de eso es un detalle interno;
  - ninguna respuesta devuelve el objeto de error entero (`json(error)`), ni `details`, `hint` o `stack`;
  - los errores de Supabase y de Stripe solo van al log.

  **No hay más sitios con el patrón de H3.**
- **De paso** (no es una fuga): un error de multer, como una foto de más de 5 MB, cae en el manejador global y
  sale como un 500 genérico en vez de un 400 con el motivo. En producción, antes salta el límite de Vercel: ver
  H24.

### H8 · MEDIA · CERRADO (22 sep 2026, commit `1202ef0`; en producción desde ese día) · `data/supabase.js` aceptaba una `SUPABASE_URL` con `http://` (sin TLS) — la service_role key viajaría en claro

- **Cierre:** corregido en `1202ef0` (tarea 3, bloque 3a, paso 1) y desplegado el 22 sep con el merge
  `6d6624a`.
  - Con `NODE_ENV === 'production'`, el servidor no arranca si `SUPABASE_URL` no empieza por `https://`.
  - En vez de la excepción para `development` que proponía esta nota, la regla se aplica solo en producción,
    tras la revisión del diseño de la tarea 3.
  - Lo cubren los tests de `supabaseFailFast.test.js`.
- **Dónde:** `server/src/data/supabase.js`, la comprobación `!supabaseUrl.startsWith('http')` acepta tanto
  `http://` como `https://`. Es un comportamiento heredado (idéntico antes y después de la tarea 2, comprobado
  con `git show HEAD`): no lo introdujo esta tarea, pero una revisión de la tarea 2 lo detectó al comprobar el
  fallo rápido a fondo, y es un fallo de seguridad real, no una nota pasiva para archivar sin fecha.
- **Impacto:** un typo de `https://` a `http://` en las variables de entorno de Vercel (o en `server/.env`) no
  se detecta al arrancar. La clave `service_role` —que se salta todas las políticas de seguridad de Supabase—
  viajaría sin cifrar en cada petición si esa URL alguna vez resolviera a una conexión real. Supabase Cloud da
  siempre URLs `https://`, así que hoy el disparador es solo un error de tecleo humano, no algo que un
  atacante pueda forzar por sí solo; aun así, el resultado de ese error de tecleo (una clave con acceso total
  a la base de datos circulando en texto plano) es serio, de ahí la severidad media.
- **Cuándo se cierra:** tarea 3 o 4 (la primera que toque `data/supabase.js` de nuevo). La corrección es
  pequeña: exigir `supabaseUrl.startsWith('https://')`, con una excepción explícita para
  `NODE_ENV === 'development'` (para no bloquear un Supabase self-hosted en local por http). No se hace ahora
  porque no estaba en el alcance de la tarea 2 y toda edición de un archivo de seguridad en esta rama pasa por
  su propio commit y su propio diff revisado — no se cuela como añadido de última hora en otro commit.

### H4 · BAJA · DOCUMENTADO, DEUDA ACEPTADA (28 sep 2026) · Los límites de peticiones viven en memoria

- **Dónde:** `express-rate-limit` 8.7 con el almacén por defecto, que guarda un contador por IP en la memoria del
  proceso. Hay tres limitadores:

  | Limitador | Rutas | Límite configurado | Qué cuenta |
  |---|---|---|---|
  | `limitadorAuth` (`authRoutes.js`) | `/api/auth/login`, `/register` y `/google` | 15 cada 15 min por IP | Solo los intentos fallidos (`skipSuccessfulRequests`). **Un único contador para las tres rutas**: es el mismo limitador |
  | `limitadorContacto` (`contactoRoutes.js`) | `POST /api/contacto` | 5 cada 15 min por IP | Todos los envíos |
  | `limitadorConfirmacion` (`mueblesRoutes.js`) | `GET /api/muebles/confirmar-sesion` | 20 cada 15 min por IP | Todas las comprobaciones |

  `/api/auth/refresh` y `/logout` no tienen límite. No hace falta: el refresh token son 32 bytes aleatorios, y
  adivinar uno por fuerza bruta no es viable.
- **Cómo corre la API en Vercel:** `nave5-api` se creó el 3 sep 2026, y desde el 23 abr 2025 los proyectos nuevos
  llevan Fluid compute activado por defecto. La API del proyecto no devuelve ese ajuste, así que se da por
  activo sin haberlo visto. Con Fluid:
  - varias peticiones comparten la misma instancia (el mismo proceso), y por tanto el mismo contador;
  - Vercel usa primero las instancias que ya tiene libres, y solo arranca más cuando no le bastan;
  - todo corre en una sola región (no hay `regions` en `vercel.json`).
- **El límite real, por IP y ventana de 15 minutos,** es el configurado multiplicado por las instancias que
  atienden a esa IP en esa ventana:
  - **Tráfico normal (este proyecto hoy):** hay una instancia, o muy pocas. El límite real es prácticamente el
    configurado: 15 fallos de login, 5 mensajes y 20 comprobaciones.
  - **Ráfaga concurrente desde una IP** (varias peticiones a la vez, que es lo que hace un ataque): Vercel puede
    repartirlas entre N instancias, cada una con su contador. El tope sube a N × 15, N × 5 y N × 20. N no se
    puede fijar desde el código ni ver desde el proyecto, así que lo único garantizado es el límite dentro de
    cada instancia, no un total.
  - **Los contadores se pierden** al reciclar la instancia: cada deploy, y cuando Vercel la para por estar
    inactiva (no documenta cuánto tarda). Tras un reciclado, la IP vuelve a empezar de cero.
- **En resumen:** frena el abuso casual (alguien probando contraseñas a mano, un formulario de contacto
  enviado en bucle) y hace falta más para uno distribuido o muy concurrente. Contra una contraseña concreta
  también protege el hash de las contraseñas (bcryptjs, coste 10), que hace lento cada intento.
- **Si algún día hiciera falta un tope global:** un almacén compartido para `express-rate-limit` (por ejemplo,
  Redis de Upstash desde el Marketplace de Vercel, con `rate-limit-redis`), o una regla de límite de peticiones
  en el Firewall de Vercel, delante de la función. Hoy no hay urgencia: no se ha visto abuso, y los tres
  endpoints ya tienen otras defensas (validación con Zod, el honeypot del contacto, y la idempotencia de la
  confirmación).

### H5 · BAJA · DEUDA ACEPTADA (28 sep 2026; se cierra con las reservas) · Límite conocido de la detección de doble venta

- **El límite:** una pieza marcada "vendido" a mano, sin ningún pedido de compra, no se detecta como conflicto si
  alguien la paga después en la web.
- **Por qué no se puede distinguir hoy:** quien registra el pedido puede encontrarse la pieza ya en "vendido"
  por dos motivos legítimos:
  - **un reintento de la misma sesión:** un intento anterior marcó la pieza y falló antes de guardar el pedido;
  - **el gemelo webhook/respaldo:** uno marca la pieza y el otro gana la inserción del pedido.

  En los dos casos, la pieza está en el estado buscado y no hay otro pedido, igual que con una venta a mano.
  Avisar ahí daría falsas alertas en compras normales.
- **Ya cubierto por tests** (`server/src/__tests__/pagos.test.js`):
  - el reintento tras un fallo parcial no da una falsa alerta ("tras un fallo parcial de la propia sesión...");
  - dos procesados simultáneos dejan un pedido y ninguna alerta;
  - el propio límite ("límite conocido: una pieza ya 'vendida'...").

  No hace falta ningún test más.
- **Qué haría falta para cerrarlo:** saber quién puso la pieza en "vendido". Por ejemplo, una columna con la
  sesión de Stripe que la vendió, rellenada en el mismo `UPDATE` condicional de `marcarPiezas`, y que el panel
  vaciara al cambiar el estado a mano. Es una migración más un cambio en el panel: un rediseño, no un arreglo
  pequeño.
- **Se cierra con el diseño de reservas** (`docs/reservas-diseno.md`, en la rama `feature/reservas-diseno`):
  "marcar vendido a mano" pasa a ser "registrar una venta fuera de la web", que inserta una fila de venta. Una
  pieza vendida a mano tendrá su fila, y el conflicto se verá. No merece la pena una columna provisional antes.

### H6 · BAJA · DEPENDE DE H18 (28 sep 2026) · La confirmación va a la dirección que teclea el comprador

- El email de confirmación sale desde el remitente de Nave 5 hacia un correo que nadie verifica. Para abusar de
  ello hace falta un pago real por cada envío, y con H2 corregido el contenido va escapado.
- **Depende de H18** (el registro no verifica el email). Hoy no hay ninguna dirección verificada que usar: ni
  siquiera la de una cuenta.
- **Cerrar H18 no basta por sí solo.** El checkout siempre empieza con el campo de email vacío, también con la
  sesión iniciada (`CheckoutModal.jsx`, `useState('')`), y el pedido usa lo que se teclee. Cuando H18 esté
  resuelto, **H6 se cierra con un cambio pequeño en el checkout:** con sesión, usar el email (ya verificado)
  de la cuenta, sin dejar cambiarlo.
- **Lo que quedará para siempre:** en una compra de invitado, el email lo teclea quien paga y no se verifica.
  Es un riesgo aceptado: cada envío cuesta un pago real, y verificar antes de pagar añadiría un paso a la compra.

### H7 · NEGOCIO · Alquilar un día bloquea la pieza

- Pagar el alquiler de un día deja la pieza en `alquilado` hasta que el administrador la reponga a mano. Es
  comportamiento anterior a la rama; conviene decidir si hace falta una fecha de fin.

### H10 · BAJA · CERRADO EN LA RAMA (28 sep 2026; sin desplegar) · `display: contents` en la vista de tabla del catálogo puede perder roles ARIA en algunos lectores de pantalla

- **Dónde:** `client/src/components/ProductsTable.jsx` y `client/src/styles/Catalog.css`, la vista de lista del
  catálogo.
- **Lo que había:**
  - en escritorio, dos contenedores sin rol (`.products-table-info` y `.products-table-footer`) se "aplanaban"
    con `display: contents` para que sus celdas fueran columnas de la fila. Así, varias celdas no colgaban
    directamente de su `role="row"`, y algunos lectores de pantalla tratan mal `display: contents`;
  - **un fallo más claro, encontrado al revisarlo:** las cabeceras de la columna de la foto y la del botón
    "Ver" llevaban `aria-hidden="true"`. Un lector de pantalla veía 5 cabeceras para 7 celdas por fila, así
    que anunciaba cada celda con la cabecera de la columna siguiente: la foto como "Nombre", el nombre como
    "Categoría", y así hasta el final.
- **Arreglo:**
  - **sin contenedores ni `display: contents`:** todas las celdas son hijas directas de su fila. La tarjeta móvil
    se hace colocando cada celda en la rejilla de la fila (`grid-row` y `grid-column`), no agrupándolas;
  - **las dos cabeceras sin título tienen nombre** ("Foto" y "Acción"), con un texto que solo lee el lector de
    pantalla (`.products-table-sr-only`).
- **Comprobado en el navegador** (servidor y cliente locales, catálogo real, vista de lista): se midió la caja de
  cada celda, relativa a su fila, en las 3 primeras filas, antes y después, a 1280 y a 375 px de ancho. **Es
  idéntica al píxel en las dos anchuras.** Un nombre largo sigue cortándose con puntos suspensivos en móvil,
  sin desbordar la fila.
- **Tests:** 3 nuevos en `ProductsTable.test.jsx`:
  - cada celda es hija directa de su fila;
  - las 7 cabeceras tienen nombre;
  - cada celda cae bajo la cabecera de su columna.

  Con el componente anterior fallan los 3. Si se vuelve a poner `aria-hidden` en una sola cabecera, fallan 2.
- **Queda para la tarea 6 (accesibilidad a fondo):**
  - probarlo con un lector de pantalla de verdad (NVDA o VoiceOver). Desde aquí no se puede;
  - en móvil no hay fila de cabecera, así que las celdas se leen sin el nombre de su columna. Es lo mismo que
    antes.

### H11 · DECISIÓN PENDIENTE · Un `categoria` (texto) sin categoría real deja `categoria_id` en NULL para siempre, y eso puede bloquear A4

- **Dónde:** `mueblesController.js`, `resolverCategoriaIdPorNombre` (commit `9079ccf`, migración A). Si el
  texto de `categoria` no coincide exactamente con ningún `categorias.nombre`, `categoria_id` se guarda como
  `NULL` sin bloquear la creación/edición -- decisión deliberada, para no romper el guardado por un problema
  de datos.
- **Impacto real, detectado durante la verificación manual de multer de esta misma revisión:** un mueble
  creado con una categoría mal escrita o inexistente queda con `categoria_id` en `NULL` de forma permanente.
  El backfill A3 (más adelante) usa el mismo criterio de coincidencia exacta, así que tampoco lo resolvería.
  Cuando llegue A4 (`ALTER COLUMN categoria_id SET NOT NULL`), esa fila bloquearía la migración.
- **Opciones sobre la mesa, sin decidir todavía:**
  1. Aceptar el caso y limpiar a mano (`UPDATE`/borrado) antes de aplicar A4.
  2. **(Recomendada)** En `crearMueble`, si `categoria_id` no se puede resolver, rechazar la creación con 400
     ("categoría desconocida") en vez de guardar `NULL` -- el admin trabaja siempre con el selector
     jerárquico (`Admin.jsx`), así que en la práctica el nombre real siempre viene de esa lista; forzarlo no
     debería tener coste real de uso.
  3. Auto-crear la categoría que falte -- descartada, llenaría `categorias` de nombres sueltos sin curar.
- **Cuándo se decide:** tarea 3b, o una tarea 3c corta dedicada solo a esto. No se decide ni se implementa en
  el commit `9079ccf` -- sería añadir alcance a ese commit fuera de lo pedido.
- **Apunte adicional 1, detectado en revisión (no bug en producción hoy, caso latente):**
  `crearMueble` usa `categoria_id ?? await resolverCategoriaIdPorNombre(categoria)` -- si Zod transforma un
  `categoria_id` vacío a `null`, el `??` cae al lado derecho y resuelve por nombre, correcto. Pero
  `editarMueble` usa `if (categoria_id !== undefined) { updateData.categoria_id = categoria_id; }` -- si
  Zod transforma un `categoria_id: ''` a `null`, `null !== undefined` es `true`, así que escribe
  `categoria_id = null` explícito, **sobrescribiendo** el valor que ya hubiera, en vez de resolver por
  nombre como hace `crearMueble`. Hoy no es explotable porque `Admin.jsx` nunca manda `categoria_id: ''`
  (el propio `idDeCategoria` no añade el campo si no encuentra un id), pero cualquier script externo que
  mandara `categoria_id: ''` + `categoria` válida borraría el id existente por accidente. Solución probable
  (una línea, sin decidir todavía): unificar el criterio en `editarMueble` para que `null` tras Zod se trate
  igual que "no lo mandaron" (resolver por nombre si `categoria` viene) y solo `undefined` signifique
  "no tocar".
- **Apunte adicional 2, no urgente:** `resolverCategoriaIdPorNombre` usa `.maybeSingle()`, que exige como
  máximo una fila con ese `nombre`. Hoy es seguro porque `categorias.nombre` tiene una restricción `UNIQUE`
  en la base real (comprobado). Si esa restricción se relajara alguna vez, la consulta lanzaría un error de
  "más de una fila" en vez de resolver de forma ambigua -- lo cual, dicho sea de paso, es el fallo seguro
  correcto (no elegir una fila al azar), pero merece una nota aquí por si se olvida el motivo.

### H12 · MEDIA · DECIDIDO, PENDIENTE DE IMPLEMENTACIÓN (29 sep 2026) · `api.js` tiene tres contratos de error distintos, y el panel ignora el de sus borrados

- **El patrón:** ninguna función de `client/src/services/api.js` lanza el error a quien la llama. Todas lo capturan
  dentro y devuelven un valor. Pero no siempre el mismo:

  | Contrato | Qué devuelve si falla | Funciones |
  |---|---|---|
  | A | `null`. **El mensaje del servidor se pierde** | `createMueble`, `updateMueble`, `deleteMueble`, `createCategoria`, `updateCategoria`, `deleteCategoria`, `actualizarEstadoPedido`, y `getMuebleById` (que devuelve `null` tanto si no existe como si falla) |
  | B | `{ error: mensaje }`, con el mensaje del servidor | `loginUser`, `registerUser`, `loginConGoogle`, `updateProfile`, `crearSesionPago`, `confirmarSesionPago`, `enviarContacto` |
  | C | `[]`: **un error no se distingue de "no hay datos"** | `getMuebles`, `getCategorias`, `buscarMuebles`, `getMisPedidos`, `getPedidos` |

  *(5 oct 2026, H37: `getPedidos` sale del contrato C. Ahora devuelve una página
  `{ pedidos, total, ... }` o `null` si falla; ver `api.contratos.test.js`.)*

- **Sitios afectados** (grep de todas las llamadas a funciones de escritura en `client/src/`, sin contar tests ni
  el propio `api.js`: 19 llamadas, 10 de ellas en el panel). **4 no comprueban el resultado, y las 4 están en el
  panel.** Ubicaciones actualizadas el 28 sep: tras la tarea 4, el panel está repartido en `client/src/pages/admin/`
  y `Admin.jsx` ya no hace ninguna de estas llamadas.

  | Llamada | ¿Comprueba el resultado? | Efecto |
  |---|---|---|
  | `pestanas/InventarioTab.jsx:36` `deleteMueble` (borrar uno) | No | "Mueble eliminado con éxito" aunque falle |
  | `pestanas/InventarioTab.jsx:49` `deleteMueble` en lote (`Promise.all`) | No | "N productos eliminados" aunque fallen todos o algunos |
  | `pestanas/CategoriasTab.jsx:58` `deleteCategoria` | No | "Categoría eliminada" aunque falle |
  | `pestanas/InventarioTab.jsx:59` `updateMueble` en lote (`Promise.all`) | No | "Estado actualizado en N productos" aunque falle |
  | `pestanas/CrearMuebleTab.jsx:42` · `pestanas/CategoriasTab.jsx:37` · `modales/EditarMuebleModal.jsx:46` · `modales/EditarCategoriaModal.jsx:37` · `pestanas/InventarioTab.jsx:154` · `pestanas/PedidosTab.jsx:16` | Sí (`if (res)`) | Correcto |
  | `AuthModal.jsx:36, 46` · `Login.jsx:27, 85, 94` · `Profile.jsx:75` · `Contact.jsx:35` · `CheckoutModal.jsx:131` · `CheckoutExito.jsx:24` | Sí (contrato B) | Correcto |

  `checkoutCart` no tenía ninguna llamada: era el checkout antiguo, anterior a Stripe, y llamaba a una ruta
  (`/muebles/comprar`) que el servidor ya no tiene. **Quitado el 29 sep** (decisión D-d).
- **Qué devuelven cuando van bien** (comprobado el 24 sep leyendo `api.js` y los controladores): las 7 escrituras
  del contrato A devuelven `await response.json()`. El servidor contesta siempre 200 o 201 con un objeto:
  `{ success, message, data }` en muebles, `{ success, data }` o `{ success, message }` en categorías, y la fila
  actualizada en pedidos. Ninguna responde 204 sin cuerpo, así que en éxito el valor es siempre un objeto
  (verdadero) y **`if (!res)` distingue bien el éxito del error**: el arreglo de la opción 1 puede usarlo.
  Hay que vigilarlo en el `apiFetch` de la 3b: si algún endpoint pasara a 204, `response.json()` fallaría y un
  éxito volvería como `null`.
- **Qué hace fallar hoy esas 4 llamadas:** las dos claves foráneas que apuntan a `categorias`
  (`muebles.categoria_id` y `categorias.categoria_padre_id`) son `ON DELETE SET NULL`, así que borrar una
  categoría en uso no falla (consultado en la base de datos real). Borrar un id que ya no existe tampoco: Supabase
  borra 0 filas sin error y el servidor contesta 200. Lo que sí las hace fallar es un token caducado (401/403),
  un error de red o un 500. Son los casos que deben simular los tests del arreglo.
- **Los otros efectos del mismo patrón, en lecturas (contrato C):**
  - Si `getPedidos` falla (por ejemplo, por un token caducado), el panel dice "Todavía no se ha registrado ningún
    pedido".
  - Si falla `getMisPedidos`, "Mis pedidos" sale vacío. Es el mismo síntoma del fallo silencioso ya corregido que
    recoge Notion.
  - Si falla `getMuebleById` por red, la ficha dice "Pieza no encontrada".
- **Por qué importa más adelante:** con las reservas, borrar una pieza que tenga reservas fallará a propósito
  (`ON DELETE RESTRICT`) y el servidor devolverá un 409 con el motivo. Con el contrato A, ese motivo se pierde.
- **¿Tests de la tarea 5 en falso verde?** Comprobado, no hay ninguno. Ningún test simula una escritura que
  devuelva `null`. `CheckoutModal` usa el contrato real de `crearSesionPago` (`{ url }` o `{ error }`) y prueba el
  error. `Header` simula `getMuebles`/`getCategorias` devolviendo `[]` para decir "sin datos", que es un caso real.
  Lo que sí hay es un **punto ciego**: con el contrato C, ningún test de componente puede cubrir "falló la carga",
  porque un error y una lista vacía son lo mismo.
- **Opciones:**
  1. **Arreglar los 4 sitios del panel:** comprobar `null`; en los lotes, `Promise.allSettled` y un mensaje que
     cuente los fallos ("3 de 5 eliminados; 2 no se pudieron eliminar"). Mínimo y local, sin tocar `api.js`. No
     resuelve el contrato C ni el mensaje perdido.
  2. **Que `api.js` lance** un error tipado (con el `status` y el mensaje del servidor), y adaptar los 19 sitios
     con `try/catch`. Uniforme, pero toca todo el cliente y choca con la tarea 3b, que reescribe `api.js` (`apiFetch`).
  3. **Pasar el contrato A al B** (`{ error }`). Conserva el mensaje, pero **rompe en silencio** los `if (res)`
     actuales (un objeto `{ error }` es verdadero), así que obligaría a cambiar todos los llamadores a la vez.
     Peligroso.
- **Recomendación, en dos pasos:**
  - **Ahora**, después de la tarea 4 y en su propio commit con tests: la opción 1 en el panel. No toca `api.js`,
    así que los tests de caracterización de la tarea 4 se escriben con el contrato de hoy (`null`) y siguen
    valiendo. El arreglo solo cambia los tests marcados como "comportamiento actual incorrecto".
  - **Después, dentro de la tarea 3b**, que ya introduce `apiFetch` como punto único de todas las llamadas:
    unificar ahí el contrato de error para lecturas y escrituras, de forma que distinga un error de una lista vacía
    y conserve el mensaje del servidor. Si se lanza un error tipado o se devuelve `{ data, error }` se decide en el
    diseño de 3b. Tiene que estar antes del bloque R-d de reservas, que necesita esos mensajes 409.

#### Decisiones de la revisión (29 sep 2026)

**H12 queda cerrado como decisión y abierto como implementación.** Se hará cuando haya que tocar `api.js`
por otro motivo, probablemente con las reservas (que además necesitan los mensajes 409).
- **D-a · No se tocan los tests congelados.** Si H12 obliga a cambiar la preparación de los tests de
  caracterización del panel, H12 no está listo. La congelación es la red de seguridad del refactor, y
  abrirla para un cambio "que no cambia aserciones" es una pendiente resbaladiza. Se replantea con las
  reservas.
- **D-b · El formato vive encima de `apiFetch`, no dentro.** Dos capas:
  - `apiFetch`, que hace lo de hoy: HTTP, sesión y reintento tras un 401;
  - encima, `apiCall`, que devuelve `{ data, error, status }`.

  Las 11 funciones públicas siguen con su contrato actual hasta que se migren una a una.
- **D-c · Textos** (los propone la revisión):
  - fallo de carga: "No se ha podido cargar. Revisa tu conexión." Sin culpar al usuario y sin el error
    técnico;
  - lote a medias: "3 de 5 completados. Los otros 2 no se pudieron procesar." Cuantifica, sin dramatizar.
- **D-d · `checkoutCart` se quita** (hecho el 29 sep, `7ca0ce8`: además llamaba a una ruta que el servidor
  ya no tiene). **`buscarMuebles` se deja.**
  - Nota para cuando se retome: fuera de los tests, `buscarMuebles` no tiene ninguna llamada en `client/src`
    (comprobado el 29 sep; solo la usa `api.contratos.test.js`, que fija su contrato). El buscador de la cabecera usa `getMuebles` y filtra en el navegador.
  - La revisión la daba por "en uso (búsqueda del catálogo)". Se deja por la decisión, pero hoy es código
    sin uso.
- **Lo que ya está hecho para cuando llegue:** `client/src/services/api.contratos.test.js` fija el contrato
  de hoy de cada función. Al migrar, esos tests dirán exactamente qué cambia.

#### Propuesta de unificación (fase D, 28 sep 2026) · revisada el 29 sep (ver las decisiones de arriba)

**Por qué se para aquí.** El plan decía: "si el diseño se hace grande, para tras la propuesta". Lo es:
- 21 funciones de `api.js` y 33 llamadas en 19 archivos. Son más que las 19 escrituras de arriba, porque las
  lecturas (contrato C) también cambian.
- 9 de esos archivos no tienen tests hoy: `Login`, `Profile`, `Contact`, `CheckoutExito`, `Catalog`, `Home`,
  `ProductDetail`, `CategorySlider` y `CartContext`. `AuthModal` está cubierto a medias.
- Hay tres decisiones que no son técnicas (abajo).

**Hechos comprobados el 28 sep:**
- **El servidor ya es uniforme:** todo error sale como `{ error: "mensaje" }`. Son 45 respuestas en los
  controladores, el 404 de `/api`, el manejador global y los 3 límites de peticiones. Ninguna ruta responde 204.
- **Lo que no es del servidor no es JSON.** Vercel responde con su propia página a un timeout (504) o a una subida
  de más de 4,5 MB (413). Además, está el fallo de red.
- **Dos fallos del contrato B que se ven hoy** (encontrados al preparar esto):
  - sin conexión, `fetch` lanza, y quien llama enseña el mensaje técnico del navegador en inglés ("Failed to
    fetch"). Pasa en el login, el registro, Google, el perfil, el contacto y el pago;
  - si llega una página de Vercel en vez de JSON, se enseña el error de `response.json()`, también en inglés
    ("Unexpected token '<'...").
- **Los tests de caracterización del panel simulan `api.js` con las formas de hoy.** `renderAdmin` hace que
  `getMuebles`, `getCategorias` y `getPedidos` devuelvan listas, y hay unas 50 llamadas `mockResolvedValue`
  con `null` o `{ success: true }`. **Pasar el panel al contrato nuevo obliga a cambiar cómo se preparan esos
  tests, aunque no cambie nada de lo que ve el usuario.**

**Diseño propuesto:**
1. **Un núcleo, `peticion()`, que nunca lanza y siempre devuelve `{ data, error, status }`:**
   - **éxito (2xx):** `data` es el cuerpo JSON y `error` es `null`;
   - **error con `{ error }`:** el mensaje del servidor, tal cual;
   - **error sin JSON** (una página de Vercel): un mensaje en castellano que da cada función ("No se pudo guardar
     el mueble.");
   - **fallo de red:** `status: 0` y "No se pudo conectar con el servidor. Revisa tu conexión.";
   - **2xx sin cuerpo** (un futuro 204): `data: null`, `error: null`. Es un éxito, no un error; es el aviso que
     ya hacía este hallazgo.
2. **`apiFetch` se queda como transporte y sigue devolviendo la `Response`.** Hay que decidirlo, porque la
   revisión proponía que fuera `apiFetch` quien devolviera `{ data, error, status }`. Motivos para dejarlo:
   - las 11 funciones públicas no pasan por `apiFetch`, y deben seguir sin hacerlo por la caché de la CDN (H16) y
     por el 401 de una contraseña incorrecta, que no debe intentar renovar la sesión. El formato en `apiFetch`
     no las cubriría;
   - los 12 tests del reintento y de la de-duplicación siguen valiendo tal cual.

   `peticion()` usa `apiFetch` cuando la llamada lleva sesión, y `fetch` cuando no.
3. **El adaptador para migrar por tandas:**
   - las funciones nuevas (mismos nombres, formato nuevo) viven en un módulo nuevo, por ejemplo
     `services/peticiones.js`;
   - `api.js` conserva los nombres de hoy como envoltorios finos, con tres adaptadores de una línea
     (`comoContratoA`, `comoContratoB` y `comoContratoC`) que devuelven exactamente lo de siempre;
   - así, lo que no se ha migrado, y los tests que simulan `../services/api`, siguen igual;
   - migrar una llamada es cambiar el `import` y leer `{ data, error }`.
4. **Tandas, un commit cada una, con sus tests:**
   0. **Núcleo y envoltorios.** Sin cambios de comportamiento: la prueba es que `api.test.js`, `apiFetch.test.js`
      y todos los demás siguen verdes sin tocarlos.
   1. **Auth:** `AuthModal` y `Login`, con tests nuevos para las dos pantallas.
   2. **Perfil:** `updateProfile`, `getMisPedidos` y los favoritos. "Mis pedidos" distingue "no tienes pedidos"
      de "no se han podido cargar".
   3. **Contacto.**
   4. **Pago:** `CheckoutModal`, que ya tiene tests, y `CheckoutExito`, con tests nuevos.
   5. **Catálogo público:** `Header`, `CategorySlider`, `Catalog`, `Home`, `ProductDetail` y `CartContext`. La
      ficha distingue "no existe" (404) de "no se ha podido cargar".
   6. **Panel:**
      - los borrados y el cambio de estado en lote con `Promise.allSettled`, y un mensaje que cuenta los fallos;
      - los 4 tests marcados H12 y el del contrato C de `Admin.pedidos.test.jsx`, "CAMBIADO A PROPÓSITO";
      - la preparación de los demás tests del panel, pasada al formato nuevo (necesita permiso, ver D-a);
      - las listas de mutantes, reapuntadas y relanzadas.
   7. **Limpieza:** se quitan los envoltorios y el código muerto (`checkoutCart` y `buscarMuebles`, que no tienen
      ninguna llamada), y H12 queda cerrado.

   Cada tanda deja la app funcionando. Si se para a medias, lo no migrado sigue con su contrato de siempre.

**Decisiones que necesita (no técnicas):**
- **D-a · Tests congelados.** Permiso para cambiar, en los 8 `Admin.*.test.jsx` y en `adminTestUtils.jsx`, solo
  la preparación de los mocks, que es un cambio mecánico: `mockResolvedValue(lista)` pasa a
  `mockResolvedValue(ok(lista))`, y `null` pasa a `fallo('...')`. Ninguna aserción cambia, salvo las 5 marcadas.
  La prueba de que no se pierde nada es relanzar la mutación del panel (hoy 72/72 más el superviviente
  esperado) y que mate los mismos mutantes. Sin este permiso, el panel no se puede migrar, y H12 se quedaría
  arreglado solo fuera del panel.
- **D-b · Dónde vive el formato:** en `apiFetch`, como proponía la revisión, o en una capa encima, como se
  propone aquí (punto 2).
- **D-c · Textos:**
  - el aviso de "no se ha podido cargar" en cada pantalla. Propuesta: el mismo en todas, con un botón
    "Reintentar";
  - el de un lote a medias. Propuesta: "3 de 5 eliminados; 2 no se pudieron eliminar";
  - qué hace la cesta si falla la comprobación de sus piezas. Propuesta: dejarla como está, sin borrar nada.
- **D-d · Código muerto:** quitar `checkoutCart` y `buscarMuebles` del cliente. La ruta `/muebles/comprar` del
  servidor queda fuera; sería otro cambio.

**Tamaño estimado:** 8 commits y unos 25 archivos. La mayor parte son tests nuevos de pantallas que hoy no tienen
ninguno.

**Caso adicional (bloque A, 2 oct 2026): el código de categoría repetido.**
- Desde A5, `POST`/`PUT /api/categorias` responden **400 "Ese código ya lo usa otra categoría."** cuando el código
  choca con el índice único de `categorias.codigo`.
- `createCategoria` y `updateCategoria` son del contrato A: ante cualquier error devuelven `null`, así que ese
  mensaje no llega a la pantalla y sale el aviso genérico ("Error al crear la categoría" / "Error al actualizar la
  categoría").
- Hoy casi no se ve: el panel comprueba el código antes de enviar (`errorDeCodigo` en
  `client/src/pages/admin/categorias.js`) y dice qué categoría lo usa. El genérico solo saldría si dos
  administradores ponen el mismo código a la vez.
- Se arregla con el resto de H12: con el contrato nuevo, el panel enseñaría el mensaje del servidor.

### H13 · DECISIÓN PENDIENTE (UX) · Formularios del panel que sobreviven al cambio de pestaña

- **Hoy**, un formulario a medio rellenar ("Añadir mueble" o "Nueva categoría") se conserva al cambiar de pestaña
  y volver, porque todo el estado vive en `Admin`. La tarea 4 lo **mantiene a propósito**: el refactor no cambia
  comportamiento (decisión aprobada). Los filtros y la paginación del inventario también se conservan, y ahí sí
  tiene sentido: son estado de la vista.
- **Por qué es discutible para los formularios:** lo más probable es que el cliente prefiera que un formulario se
  vacíe al salir de su pestaña. Además hay una rareza con las fotos: los archivos elegidos siguen en el estado,
  pero el selector de archivos se ve vacío al volver, y como es obligatorio el navegador pide elegirlos otra vez.
- **Cuándo se decide:** con el cliente, sin prisa. Después de la tarea 4, cambiarlo es trivial: se mueve ese estado
  del contenedor a la pestaña y se vacía al desmontarla.

### H14 · BAJA · UX · CERRADO EN LA RAMA (28 sep 2026; sin desplegar) · Un solo `status` para todos los formularios del panel

- **Arreglo (28 sep, en `feature/mejoras-tecnicas`):**
  - cada formulario tiene su propio estado de envío con `pages/admin/hooks/useEstadoEnvio.js`: "Añadir
    mueble", "Crear Categoría" y los dos modales de edición;
  - el botón se desactiva mientras ESE envío está en curso, y el manejador también ignora un segundo envío
    (doble clic, Intro);
  - el mensaje sale junto a su formulario: el de los modales, dentro del modal;
  - se quita la condición muerta de "Subiendo".
- **Qué cambia a la vista:**
  - el error del modal ya no aparece bajo "Añadir mueble";
  - "Crear Categoría" se desactiva, y enseña "Creando categoría..." mientras crea;
  - el mensaje de "Añadir mueble" ya no se conserva al cambiar de pestaña;
  - "Crear Categoría" no enseña ningún mensaje si falla: solo el aviso, como antes.
- **Tests:**
  - se han cambiado a propósito los dos tests de caracterización que fijaban el comportamiento viejo, marcados
    con "CAMBIADO A PROPÓSITO CON EL ARREGLO DE H14": el de "Crear Categoría" en
    `Admin.categorias.test.jsx`, y el del error que viajaba en `Admin.navegacion.test.jsx`;
  - ningún otro test de caracterización se ha tocado, y todos siguen en verde;
  - son nuevos `useEstadoEnvio.test.js` (5) y `Admin.envio.test.jsx` (4), con su lista de mutantes
    `scripts/mutantes/envio.js`, y se han repuntado los 6 mutantes que usaban el `status` compartido.
- **Antes del arreglo:** `Admin` tenía un único estado `status` para el mensaje de progreso o error. Lo escribían cuatro
  manejadores:
  - añadir mueble: "Guardando producto..." y "Error al guardar en base de datos.";
  - crear categoría: "Creando categoría...";
  - editar mueble y editar categoría: "Actualizando producto/categoría..." y "Error al actualizar.".

  Los pedidos no lo usan: su cambio de estado solo avisa con un toast. El texto **solo se pinta en "Añadir
  mueble"**, y los botones se desactivan buscando palabras dentro de él.
- **Efectos que ya se dan hoy** (no los introduce la tarea 4, que conserva un solo `status` a propósito):
  - **El error viaja de formulario.** Si falla guardar el modal de edición, `status` se queda en "Error al
    actualizar." (en los fallos no se limpia). Al ir a "Añadir mueble", ese mensaje sale debajo del formulario de
    alta como si hubiera fallado él.
  - **"Crear Categoría" nunca se desactiva:** un doble clic manda dos altas antes de que vuelva la primera.
  - **Condición muerta:** "Guardar Producto" se desactiva si `status` contiene "Subiendo", pero ese texto no se
    escribe en ningún sitio.
- **Propuesta, después de la tarea 4 y en su propio commit:** un estado de envío por formulario, local a su pestaña
  o a su modal. El botón se desactiva mientras ese envío está en curso, y el mensaje sale junto a su formulario.
  Con las pestañas separadas es un cambio pequeño, pero cambia qué mensaje se ve dónde, así que va con sus tests y
  no dentro del refactor.

### H15 · DECISIÓN PENDIENTE (UX) · Qué categoría sale preseleccionada en "Añadir mueble"

- **Hoy**, al abrir "Añadir mueble" se preselecciona la primera categoría específica en el orden alfabético en que
  las devuelve la API. Con los datos reales (consultados el 24 sep) es "Baúles y maletas", del grupo "Piezas de
  colección". Pero la primera opción del desplegable es "Decoración y objetos", del grupo "Decoración y hogar":
  el desplegable agrupa por categoría general, y "Piezas de colección" es el tercer grupo. El usuario ve
  preseleccionada una categoría que no es la primera de la lista, y es fácil guardar una pieza en "Baúles y
  maletas" sin darse cuenta.
- Es el comportamiento del código actual, no una decisión. La tarea 4 lo conserva: casos A y C de la sección 5
  del diseño, caracterizados en `Admin.crear.test.jsx`.
- **A confirmar con el cliente:** ¿preseleccionar la primera del desplegable, o no preseleccionar ninguna? Si no
  se preselecciona ninguna, el selector ya es obligatorio, así que el navegador obliga a elegir. Recomendación:
  no preseleccionar ninguna, para que no se clasifique una pieza sin querer.
- **Cuándo:** con el cliente, sin prisa (está en la checklist del cliente en Notion, junto a H13). Después de
  la tarea 4 es un cambio de pocas líneas en el `useEffect` de la categoría preseleccionada. Los tests de los
  casos A y C cambiarían a propósito en ese mismo commit.

### H16 · MEDIA · CERRADO (24 sep 2026, commit `63f1324`; en producción) · El panel no veía sus propios cambios hasta recargar

- **Síntoma** (24 sep, durante la prueba de A3 en producción): después de crear una pieza, el inventario del panel
  no la mostraba hasta recargar la página. Después de editarla, seguía saliendo con la categoría de antes.
- **Causa:** el servidor deja cachear las dos listas. `GET /api/muebles` responde con
  `Cache-Control: public, max-age=60, s-maxage=120, stale-while-revalidate=300`, y `GET /api/categorias`, con
  30/60/120. El navegador guarda la lista 1 minuto y la CDN de Vercel 2, y además puede servir la copia vieja
  hasta 5 minutos más mientras la refresca. Después de guardar, el panel vuelve a pedir la lista, y le llega la
  copia de antes.
- **Comprobado**, no supuesto:
  - Con `curl`, la segunda petición da `X-Vercel-Cache: HIT`. Una petición con `Cache-Control: no-cache`
    sigue dando `HIT`, porque la CDN lo ignora. Con `Authorization` da `BYPASS`: la documentación de Vercel
    ("Cacheable response criteria") dice que no se cachean las peticiones que llevan esa cabecera.
  - En el navegador, con la pieza de prueba recién editada: la petición normal devolvía la categoría vieja, y
    la petición con `cache: 'no-store'` y `Authorization`, la nueva.
- **Arreglo:** `getMuebles` y `getCategorias` aceptan `{ fresco: true }`, que llama a `fetch` con
  `cache: 'no-store'` (salta la caché del navegador) y con la cabecera `Authorization` (salta la de la CDN). El
  panel lee siempre así. El catálogo público no cambia y sigue cacheado. Cubierto por
  `services/api.test.js`, los tests del panel y dos mutantes nuevos.
- **Queda por decidir:** el público sigue viendo los cambios con retraso, normalmente de 1 a 3 minutos y algo
  más en el peor caso. Si es demasiado, se bajan `s-maxage` y `stale-while-revalidate` en el servidor, a
  cambio de más consultas a Supabase. Recomendación del revisor: no tocarlo mientras el cliente no lo note.

### H17 · ALTA · CERRADO (24 sep 2026, commit `9cf2043`; en producción) · "Mis pedidos" enseñaba pedidos de otras personas

- **El fallo:** `obtenerMisPedidos` buscaba con `.ilike('cliente_info->>email', email)`, usando el email de la
  cuenta como patrón. En ILIKE, `_` es "un carácter cualquiera", y `supabase-js` pasa el patrón sin escapar.
  El registro acepta emails con `_` y no verifica que el email sea de quien se registra (H18). Así, una cuenta
  "j_an.perez@gmail.com" veía en "Mis pedidos" los de "juan.perez@gmail.com": nombre, email, teléfono,
  dirección y productos.
- **Comprobado (24 sep, solo lectura):**
  - En la base de datos, un patrón hecho con el email de un pedido real, cambiando una letra por `_`,
    devolvía ese pedido.
  - En el PostgREST real, con `supabase-js`, la misma consulta de H17 devolvía 1 pedido ajeno sin escapar y 0
    escapando. El dueño seguía viendo el suyo, también con el email en mayúsculas.
  - PostgREST trata además `*` como alias de `%`.
- **Arreglo:** `utils/ilike.js` → `escaparIlike`, que antepone `\` a `\`, `%`, `_` y `*`. Se usa en los dos
  únicos `.ilike()` del servidor (`grep` de `.ilike`/`.like`/`.or`): "Mis pedidos" y `buscarMuebles`. En la
  búsqueda del catálogo no había riesgo, pero así lo que escribe el usuario se busca tal cual.
- **El doble en memoria ocultaba el fallo:** `fakeSupabase` solo entendía `%`, y tomaba `_` y `\` como
  literales. Ahora sigue la semántica de Postgres y PostgREST. Tiene tests propios que repiten los casos
  comprobados contra el PostgREST real.
- **Tests:**
  - `ilike.test.js`: la función y la fidelidad del doble.
  - `pedidosController.test.js`: "j_an" no ve lo de "juan", ni al revés.
  - `mueblesLecturaYBusqueda.test.js`: la búsqueda es literal.
  - Contrato contra el PostgREST real, fuera de `npm test`: `npm run test:supabase-ilike`. Es de solo lectura
    y solo consulta `categorias`, que es pública.
  - Deshaciendo el arreglo pieza a pieza, algún test falla en los 4 casos.
- **No cierra el problema de fondo:** sin escapar, cualquier comodín dejaba ver pedidos ajenos. Pero aunque no
  haya comodines, quien registre el email exacto de otra persona sigue viendo sus pedidos de invitado. Eso es
  H18. La migración B (`cliente_id`) ayudará con los pedidos de clientes con cuenta, pero los de invitado
  seguirán cruzándose por email.

### H18 · ALTA · DEPENDE DEL CLIENTE (29 sep 2026; tarea futura) · El registro no verifica el email

- **Hoy** cualquiera puede crear una cuenta con el email de otra persona: no se envía confirmación. Combinado
  con H17, permitía ver pedidos ajenos con un email parecido. Aun con H17 corregido, quien registre el email
  exacto de otra persona (si todavía no tiene cuenta) ve sus pedidos de invitado.
- **Arreglo:** enviar un email de verificación con Resend, que ya está integrado, y no activar la cuenta, o no
  dar acceso a "Mis pedidos", hasta que se confirme. El login con Google no tiene este problema: Google ya
  entrega el email verificado.
- **A decidir con el cliente:** ¿se bloquea el inicio de sesión hasta verificar el email, o solo el acceso a
  "Mis pedidos"? Está en la checklist del cliente en Notion. Entra en una tarea posterior.
- **Diseño para decidir con el cliente (29 sep 2026):** `docs/verificacion-email-diseno.md`. Tiene las opciones
  (en el registro, en cada inicio de sesión, al cambiar el email), qué pasa con los pedidos de invitado y con
  los que ya existen, los textos de los correos y la migración.
  - **Encontrado al prepararlo:** el inicio de sesión con Google entra en una cuenta existente con el mismo email
    sin más. Quien registre con contraseña el email de otra persona comparte la cuenta con ella cuando esa
    persona entre con Google, y sigue sabiendo la contraseña ("pre-secuestro" de la cuenta). El diseño lo
    cubre, en la parte 6, punto 8.
  - **Requisito previo:** un dominio propio verificado en Resend. Con el de pruebas, los correos no llegan a
    los clientes.
- **Al cerrarlo, cerrar también H6:** con sesión, el checkout debe usar el email verificado de la cuenta en
  vez del que se teclee.

### H9 · ALTA · CERRADO (24 sep 2026, commit `50b03d5`; aplicado en la base de datos ese día) · Con la clave pública se leían todos los pedidos

- **El fallo:** la política RLS `"Admins pueden ver todos los pedidos"` de `pedidos` era `SELECT` para el rol
  `public` con `USING (true)`: pese al nombre, no comprobaba nada. Con la clave pública (`anon`), cualquiera
  podía leer todos los pedidos por la API REST de Supabase: nombre, email, teléfono y dirección. El diseño de
  la tarea 3 decía que no era explotable porque "nada del código usa la clave anon". El razonamiento no vale:
  esa clave es pública por diseño. El frontend no la incluye, pero no puede ser la protección.
- **Comprobado antes de arreglarlo:** el test de contrato nuevo fallaba con `actual: 3`. Con la clave `anon`
  se leían los 3 pedidos (el test solo pide la columna `id`).
- **Arreglo:** migración `20260924195451_fix_pedidos_admin_policy`. Reafirma RLS (idempotente) y borra la
  política, sin política de sustitución, igual que `clientes`, que ya tenía RLS sin políticas. El servidor usa
  `service_role`, que se salta RLS, así que el panel y "Mis pedidos" no cambian.
- **Verificado después:** `pedidos` queda con RLS activo, 0 políticas y sus 3 filas intactas. El test de
  contrato (`npm run test:supabase-rls`, fuera de `npm test`, de solo lectura) pasa 3 de 3:
  - `anon` ve 0 pedidos y 0 clientes, sin error;
  - `service_role` sigue viéndolos.

  Con RLS, PostgREST no responde 401 ni 403: responde 200 con una lista vacía, porque filtra filas, no rechaza
  la petición. Por eso el test comprueba que no hay error y que llegan 0 filas. La copia coincide byte a byte
  con `schema_migrations`.

### H19 · BAJA · CERRADO: no reproducible en 20 ejecuciones (246 en total) · Un fallo suelto en `npm test` del servidor

- **Qué pasó:** en el gate del commit `c358bad` (24 sep, 22:50 UTC, en plena tarea 4), la suite del servidor
  dio `tests 256, pass 255, fail 1`. Lo normal es 257 de 257. El commit se hizo igual, porque iba encadenado
  al gate (ver la regla del gate en `docs/tarea4-diseno.md`, sección 11).
- **El nombre del test se perdió.** El gate filtraba la salida con `grep` y solo dejaba el resumen. En la
  transcripción de la sesión tampoco está: solo esas tres líneas.
- **Qué fue, deducido del recuento.** Se ha medido cómo cuenta `node:test` (Node 24) cada tipo de fallo, con
  una suite mínima aparte:
  - Una aserción que falla, o una promesa rechazada dentro de un test: el total no cambia (257, 1 fallo).
  - Un test que agota su tiempo: sale como `cancelled`, no como `fail`.
  - Una excepción después de que acaben los tests: el total sube en 1.
  - Un archivo cuyo proceso muere o no llega a cargar: todos sus tests desaparecen del recuento, también los
    que ya habían pasado, y el archivo cuenta como 1 test fallido.

  Solo el último caso da 256/255/1, y solo si el archivo tiene exactamente 2 tests. Hay dos:
  `errores.test.js` y `confirmarSesionLimite.test.js`. Así que no falló una aserción: **el proceso de uno de
  esos dos archivos falló entero.**
- **Intentos de reproducirlo: 0 fallos en 246 ejecuciones.** Todas guardan un log completo (`spec`) y un XML
  `junit`:
  - 6 seguidas, justo después del fallo;
  - **20 seguidas de la suite completa**: 257 de 257 en todas, unos 2 s cada una, nada en stderr;
  - 100 de cada archivo candidato, por separado;
  - 20 de la suite completa bajo carga (4 suites a la vez más la del cliente), entre 3 y 5 veces más lentas.
- **Causas descartadas leyendo el código**, con dos revisiones independientes:
  - el servidor no llama a `process.exit` ni instala manejadores globales de errores;
  - las ventanas de los límites de peticiones son de 15 minutos y no caducan durante un test;
  - los temporizadores falsos son deterministas;
  - todos los mocks se restauran;
  - ningún test sale a la red ni escribe en disco;
  - cada archivo corre en su propio proceso.
- **Hipótesis que queda, sin demostrar:** un fallo transitorio de Windows al arrancar o cargar el proceso de
  ese archivo. Los dos candidatos cargan `../index`, que arrastra el módulo nativo de `sharp` (una DLL), y en el
  gate arrancan 29 procesos a la vez. Esta máquina ya ha dado errores transitorios de acceso a archivos: el
  `UNKNOWN errno -4094` que obligó a hacer que el script de mutación reintente (`860ae11`).
- **Si vuelve a pasar:** el gate guarda ahora la salida completa. Un fallo de archivo sale ahí con el nombre del
  `.test.js`, el error y el código de salida. Con eso se reabre H19 con datos.
- **De paso, ajeno a H19:** `supabaseFailFast.test.js`, líneas 57-59, restaura `NODE_ENV` asignándole
  `undefined`, y eso deja la cadena `"undefined"` en vez de borrar la variable. Es inofensivo, porque cada
  archivo corre en su propio proceso. Se arregla con una línea cuando se toque ese archivo.

### H20 · BAJA · DEUDA ACEPTADA (26 sep 2026) · El código de B no se ha comprobado de extremo a extremo en producción

- **Qué es:** el código que rellena `pedidos.cliente_id` al registrar un pedido (migración B) no se ha visto
  funcionar en producción con un pedido real. Desde el deploy del 24 sep no ha entrado ningún pedido, y el
  usuario decidió no hacer la compra de prueba en modo test.
- **En qué se confía:**
  - los tests unitarios de ese código: el bloque `procesarSesionPagada — cliente_id (migración B)` de
    `pagos.test.js`, que cubre una cuenta, un invitado, un `_` en el email (H17), un email ambiguo, un fallo
    al buscar la cuenta y una sesión sin email;
  - el test de contrato de la consulta (`queryContract.test.js`, con el cliente real de Supabase);
  - que lleva desplegado desde el 24 sep sin incidencias.
- **B3 sí está comprobada:** rellenó los 2 pedidos antiguos que tocaba, y eso se ve directamente en la
  base de datos, sin necesidad de un pedido nuevo.
- **Cuándo se reabre:** si entra un pedido real de alguien con cuenta y `cliente_id` queda a NULL. Consulta
  para comprobarlo en cualquier momento:
  ```sql
  SELECT id, created_at FROM pedidos
  WHERE created_at > '2026-09-24T20:08:03Z' AND cliente_id IS NULL
    AND lower(cliente_info->>'email') IN (SELECT lower(email) FROM clientes);
  ```
  Tiene que salir vacía.

### H21 · MEDIA · CERRADO EN LA RAMA (28 sep 2026, `870d031`; sin desplegar) · Cambiar la contraseña no cerraba las demás sesiones

- **El fallo:** `perfil-update` permite cambiar el email y la contraseña (la revisión suponía que el email no).
  Con las sesiones largas del bloque 3b, alguien que cambiara la contraseña porque sospecha que se la han
  robado dejaría abiertas las sesiones de quien la robó: su refresh token seguiría rotando siete días más.
- **Arreglo:**
  - al cambiar la contraseña o el email se revocan todos los refresh tokens de la cuenta, antes de guardar
    el cambio;
  - la sesión que hace el cambio recibe un refresh token nuevo, en una familia nueva;
  - cambiar solo el nombre no revoca nada.
- **Tests:** 4 en `refreshTokens.test.js`: contraseña, email, solo el nombre, y contraseña actual incorrecta.
  Las sesiones de otras cuentas no se tocan.
- **Queda un hueco hasta 1 hora:** el access token que ya tuviera quien robó la contraseña sigue valiendo
  hasta que caduque, porque `verificarToken` no consulta la base de datos. Es el riesgo aceptado del diseño
  (sección 2, "Migración a los tokens de 7 días"), ahora acotado a 1 hora en vez de 7 días.

### H22 · BAJA · CERRADO EN LA RAMA (28 sep 2026; sin desplegar) · La CSP no permitía la hoja de estilos de Google Sign-In

- **Síntoma** (visto en el smoke test del 26 sep y vuelto a leer el 28 en producción): en `/login`, la consola
  dice que cargar la hoja de estilos `https://accounts.google.com/gsi/style` viola `style-src 'self'
  'unsafe-inline' https://fonts.googleapis.com`. Hoy la política es report-only y solo sale el aviso. En
  enforcing, el botón "Continuar con Google" se quedaría sin estilos.
- **No es un estilo inline**, como suponía la revisión: es una hoja de estilos externa (un `<link>` que añade
  la librería de Google), y `style-src` ya tenía `'unsafe-inline'`. Un nonce autoriza bloques inline, no
  archivos de otro origen, así que no arreglaría nada.
- **Arreglo:** añadir a `style-src` la URL exacta que documenta Google para su botón (`/gsi/style`), no todo
  `accounts.google.com`. Las otras tres directivas que pide Google (`script-src`, `frame-src` y `connect-src`)
  ya estaban cubiertas, porque permiten el origen entero.
- **Test:** `client/src/cspVercel.test.js` lee `vercel.json` y comprueba las cuatro URLs de Google. Antes del
  arreglo fallaba justo el de `style-src`.
- **Queda por ver en producción:** la CSP solo la aplica Vercel, así que no hay forma de comprobarla en local.
  Tras el deploy, `/login` no debería tener ningún aviso de CSP en la consola.
- **Cómo comprobarlo tras el deploy, y qué hacer si sale un aviso (H22b):** sección 4.1 de
  `docs/verificacion-3b.md`.

### H23 · MEDIA · PARCIAL (28 sep 2026: 8 de 15 arregladas; las 7 que quedan piden un salto de versión mayor) · Vulnerabilidades conocidas en las dependencias del cliente

- **`npm audit`, 28 sep 2026:**
  - **servidor: 0 vulnerabilidades;**
  - **cliente: 15** (1 crítica, 6 altas, 7 moderadas y 1 baja).
- **Arreglo del 28 sep (con permiso):** `npm audit fix` en `client/`, sin `--force`. Solo cambia
  `package-lock.json`, siempre dentro de la misma versión mayor. `package.json` no cambia. Quedan 7 (1 crítica,
  1 alta y 5 moderadas).
- **Revisión una a una de las 15:**

  | Paquete | Gravedad | ¿Llega al navegador? | Estado |
  |---|---|---|---|
  | `react-router-dom` 6.30.3 → 6.30.6, `react-router` igual | moderada | sí | **Arreglado lo principal:** el "open redirect leading to XSS" (6.30.2 a 6.30.5). **Quedan dos avisos que exigen la v7** (abajo) |
  | `@remix-run/router` 1.23.2 → 1.23.4 | moderada | sí | Arreglado (redirect a una ruta que empieza por `//`) |
  | `@babel/core` 7.29.0 → 7.29.7 | baja | no (build) | Arreglado |
  | `baseline-browser-mapping` 2.10.29 → 2.11.26 | moderada | no (build) | Arreglado |
  | `brace-expansion` 1.1.14 → 1.1.21 | alta | no (lint) | Arreglado |
  | `browserslist` 4.28.2 → 4.29.2 | alta | no (build) | Arreglado |
  | `js-yaml` 4.1.1 → 4.3.2 | alta | no (lint) | Arreglado |
  | `nanoid` 3.3.12 → 3.3.19 | alta | no (build, vía `postcss`) | Arreglado |
  | `postcss` 8.5.14 → 8.5.28 | alta | no (build) | Arreglado |
  | `vitest` 2.1.9 | **crítica** | no (tests) | **Sin tocar: exige vitest 5** |
  | `@vitest/mocker`, `vite-node` | moderadas | no (tests) | **Sin tocar: van con vitest 5** |
  | `vite` 5.4.21 | alta | no (servidor de desarrollo) | **Sin tocar: exige vite 8** |
  | `esbuild` | moderada | no (servidor de desarrollo) | **Sin tocar: va con vite 8** |

- **Los dos avisos de React Router que quedan** (los dos piden `react-router` 7.18, versión mayor):
  - **Open redirect con una barra invertida en `<Link>` y `useNavigate`** (GHSA-wrjc-x8rr-h8h6). Solo se
    explota si el destino lo controla un atacante. Hoy todos los destinos de la app son rutas fijas
    (`/catalogo`, `/mueble/<id>`, `/cuenta`, `/login`, `/sobre-nosotros`...), y el nombre de categoría va en la
    query, no al principio de la ruta. **No es explotable hoy.** Regla hasta la v7: no pasar a `navigate` ni a
    `<Link>` una ruta sacada de la URL (por ejemplo, un futuro `?volver=`) sin validarla.
  - **Inyección en `deserializeErrors()` al hidratar con SSR** (GHSA-337j-9hxr-rhxg). La app es una SPA con
    `BrowserRouter`, sin SSR ni `hydrationData`. **No aplica.**
- **Lo de desarrollo** (vitest, vite, esbuild) no llega a producción:
  - la crítica de `vitest` solo se da con su servidor de UI escuchando (`vitest --ui`), y no se usa;
  - lo de `vite` y `esbuild` afecta al servidor de desarrollo (`npm run dev`) mientras está arrancado.
- **Tarea aparte (sin hacer): react-router 7, vite 8 y vitest 5.** Son tres saltos de versión mayor, con cambios
  de API, y necesitan su propio gate. Al subir vitest, `@vitest/coverage-v8` tiene que subir a la misma
  versión (tarea 7).
- **Comprobado:** gate completo (servidor 294/294, cliente 325/325, lint y formato limpios) y `vite build` sin
  errores.
- **Aviso para la próxima vez:** `npm audit fix` actualizó `package-lock.json` pero no los archivos de
  `node_modules`, porque el lockfile oculto (`node_modules/.package-lock.json`) ya decía que estaban las
  versiones nuevas. Se vio porque `npm ls` y el `package.json` del paquete no coincidían. Se arregló
  apartando ese archivo y con `npm install`. El gate se pasó después, con las versiones nuevas en disco.
- **El CI las enseña en cada ejecución** (`npm audit`, en modo informativo): no rompe el build.

### H24 · MEDIA · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · Subir fotos en el panel: el límite real es el de Vercel, 4,5 MB por petición

- **Arreglo (29 sep, opción 1):** el panel reduce las fotos en el navegador antes de subirlas.
  - `client/src/utils/imagen.js`:
    - `redimensionarImagen` decodifica la foto con `createImageBitmap`, que aplica la rotación del EXIF. Si no
      existe, usa `<img>` con `decode()`;
    - la redibuja en un canvas a **1920 px de lado mayor** y la recomprime con **calidad 0,85**: en JPEG, o en
      WebP si puede tener transparencia (PNG, WebP o GIF), porque en JPEG lo transparente saldría negro;
    - una foto de menos de 500 KB y de 1920 px se sube tal cual.
  - **Nunca impide subir una foto:** si el navegador no la sabe leer (HEIC en Chrome), no tiene las APIs, o
    reducirla no la aligera, se sube la original, como antes.
  - **Red de seguridad, `prepararFotos`:** si, ya reducidas, las fotos de un envío pasan de **4 MB** (los 4,5 de
    Vercel menos margen para el resto del formulario), se reducen otra vez desde los originales, a 1600 px y
    calidad 0,7. Si ni así caben, el panel **no manda nada** y explica cuánto pesan y cuál es el máximo, en vez
    del "no se pudo guardar" sin motivo. Con 5 fotos con mucho detalle, 1920 px y 0,85 podían acercarse a los
    4,5 MB, así que el tope no se dejaba a la suerte.
  - **Integrado en los cuatro formularios que suben fotos:** "Añadir mueble", el modal de edición de mueble, "Crear
    categoría" y el modal de edición de categoría. El plan nombraba los dos primeros, pero en los de categoría
    una sola foto de móvil ya puede pasar del límite.
  - **Mientras reduce,** el mensaje del formulario dice "Optimizando imagen..." con una foto, u "Optimizando
    imágenes... 2/3" con varias. Luego vuelve al de siempre ("Guardando producto...") y el botón sigue
    desactivado.
  - **De paso:** redibujar en un canvas quita los metadatos EXIF, incluida la ubicación GPS de los móviles.
    `sharp` ya los quitaba en el servidor; ahora ni siquiera salen del navegador.
- **Corregido tras la revisión del 29 sep:** `createImageBitmap` existe desde Chrome 50 y Safari 15, pero el valor
  `imageOrientation: 'from-image'` solo desde Chrome 112, Firefox 111 y Safari 16 (datos de compatibilidad de MDN).
  En los anteriores, por ejemplo un iPhone que se ha quedado en iOS 15, la llamada se rechaza. Antes eso se
  tomaba por "no se puede leer" y no se reducía ninguna foto. Ahora se prueba entonces con `<img>`.
- **Desviación del plan:** si no hay `createImageBitmap` (o no acepta la opción), se usa `<img>` con
  `decode()`, no con `onload`.
  `decode()` devuelve una promesa que falla si la imagen no se puede leer. `onload` puede no llegar nunca (en
  jsdom no llega) y dejaría el guardado colgado. Todos los navegadores con `decode()` cubren a los que no tienen
  `createImageBitmap` (Safari 11.1 a 14).
- **Tests:**
  - 29 unitarios en `utils/imagen.test.js`, con un navegador simulado: `createImageBitmap` y el canvas;
  - 7 de integración en `pages/Admin.fotos.test.jsx`:
    - tres fotos de 6 MB llegan a `createMueble` reducidas, por debajo del límite;
    - los mensajes 1/3, 2/3 y 3/3;
    - un segundo envío mientras reduce no crea otro mueble;
    - si no caben, no se manda nada;
    - las fotos nuevas del modal de mueble y las de los dos formularios de categoría;
  - **los tests de caracterización del panel no se han tocado y siguen pasando:** en jsdom no se puede
    decodificar, así que ahí las fotos (de 1 byte) se suben tal cual.
  - 8 fallos plantados en la integración y en `imagen.js`, todos detectados;
  - la mutación del panel (`categorias`, `crear` y `modales`, con los 4 mutantes repuntados al código nuevo):
    53 muertos y el superviviente esperado de siempre (caso B).
- **Queda por ver en un navegador de verdad:** subir desde el panel, con sesión de administrador, 3 fotos de
  móvil. Es parte del check del panel con sesión que tiene pendiente el usuario.

**El hallazgo, tal y como se anotó el 28 sep:**

- **Qué pasa:** crear o editar un mueble manda todas sus fotos (hasta 5) en una sola petición a `nave5-api`.
  - Vercel corta cualquier petición a una función de más de **4,5 MB en total**, y responde él mismo con un 413
    `FUNCTION_PAYLOAD_TOO_LARGE`, en HTML y no en JSON ("Request body size" en la documentación de límites de
    Vercel Functions);
  - el cliente no reduce las fotos antes de subirlas: no hay ningún `canvas` ni `toBlob` en `client/src`;
  - multer permite 5 MB **por archivo** (`server/src/utils/upload.js`), pero en producción nunca llega a
    aplicarse, porque el límite de Vercel salta antes y es por petición;
  - `sharp` reduce las fotos a 1 600 px, pero en el servidor, después de recibirlas.
- **Efecto:** dos o tres fotos hechas con el móvil (2-4 MB cada una) ya pueden pasar de 4,5 MB. El panel dice solo
  que no se pudo guardar, sin el motivo, porque el contrato A de `api.js` pierde el mensaje (H12). Y aunque no lo
  perdiera, la respuesta de Vercel no es JSON.
- **No se ha reproducido en producción:** sale de leer el código y los límites documentados de Vercel. Tampoco
  consta que el administrador haya tenido este problema.
- **Opciones para arreglarlo:**
  1. **Reducir cada foto en el navegador** antes de subirla (`canvas` y `toBlob`, a unos 1 600 px, igual que
     `sharp`). Es el cambio más pequeño, y además acelera la subida.
  2. **Subir las fotos directamente a Supabase Storage** desde el navegador, con una URL firmada que dé el
     servidor. Quita el límite del todo, pero es más trabajo.
  3. **Como mínimo:** que el panel avise antes de enviar si las fotos pasan de 4 MB en total, y que multer
     responda 400 con el motivo.

### H25 · BAJA · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · La cesta no avisaba de "pieza única" al añadirla por segunda vez

- **Encontrado** al escribir los tests de `CartContext` (fase 2, cobertura del cliente), que no tenía ninguno.
- **Qué pasaba:**
  - añadir a la cesta una pieza que ya estaba (desde la ficha o la vista rápida) decía "Producto añadido a la
    cesta." y abría la cesta, en vez de "solo hay 1 unidad disponible". La pieza no se duplicaba: solo el aviso
    estaba mal;
  - el botón "+" de una línea de la cesta no avisaba de nada.
- **Por qué:** `addToCart` y `updateQuantity` decidían qué aviso dar con una variable que se rellenaba *dentro*
  de la función que se pasa a `setCartItems`. React solo ejecuta esa función al momento cuando el componente no
  tiene actualizaciones pendientes. Tras la primera, ya no las tenía libres, así que la función se ejecutaba
  después, al pintar, cuando el aviso ya se había decidido.
- **Arreglo:** el aviso se decide con la cesta del render actual, antes de llamar a `setCartItems`. La función
  de `setCartItems` lo vuelve a comprobar, por si llegaran dos clics antes de volver a pintar.
- **Tests:** `client/src/context/CartContext.test.jsx` (18). Con el código anterior fallan justo los 2 de este
  caso: añadir dos veces y el "+". Usan React de verdad (`renderHook`), así que el comportamiento es el mismo
  que en el navegador, aunque no se ha visto en él.

## Auditoría de seguridad pasiva (fase 6, 29 sep 2026)

Solo lectura: no se ha cambiado código. Las respuestas a las cinco preguntas de la revisión y los hallazgos
nuevos (H26 a H30) van debajo; los hallazgos no se arreglan sin permiso.

1. **¿Algún endpoint público devuelve más de lo necesario?** Sí, poca cosa y nada sensible hoy: **H26**.
   - Todas las lecturas públicas usan `select('*')`: `GET /api/muebles`, `/api/muebles/:id`,
     `/api/muebles/buscar` y `/api/categorias`. Hoy no sobra nada: se comprobaron las columnas reales con una
     consulta de solo lectura. `muebles` tiene id, nombre, categoria, descripcion, los dos precios,
     disponible, imagenes, created_at, estado y categoria_id; `categorias`, id, nombre, imagen_url y
     categoria_padre_id.
   - `GET /api/categorias` sí devuelve algo que la web pública no usa: las estadísticas del panel (vendidos,
     alquilados y valor del catálogo).
   - El login, el registro, Google y el perfil devuelven del usuario solo `nombre`, `email` y `rol`, nunca el
     hash de la contraseña. `confirmar-sesion` devuelve `success`, un mensaje y el total.
2. **¿Los errores 4xx/5xx devuelven detalles internos?** No. Es la auditoría de H3 (28 sep), repetida hoy con
   el mismo resultado:
   - todas las respuestas de error llevan un texto fijo;
   - solo dos devuelven el `.message` de un error, y en los dos casos es un `ErrorValidacion` pensado para
     enseñarse;
   - el detalle de los errores de Supabase, Stripe y Resend queda en el log.

   Los tests nuevos de la fase 3 (`controladoresErrores.test.js` e `indexHttpsYErrores.test.js`) comprueban
   que los 500 no dejan ver nada interno.
3. **¿Están protegidas todas las rutas de administración?** Sí.
   - **Con `verificarAdmin`:** crear, editar y borrar muebles y categorías; listar pedidos y cambiar su
     estado.
   - **Con `verificarToken` (solo la cuenta propia):** `GET /api/pedidos/mios` y `POST /api/auth/perfil-update`.
   - **En el cliente,** `/admin` va dentro de `ProtectedRoute adminOnly`. Aun así, el pie de página enseña el
     enlace "Panel Admin" a quien no ha iniciado sesión: **H30**, informativo.
   - Los tests: `middlewareAuth.test.js` (403 a un cliente y 401 sin sesión o con un token caducado,
     falsificado o que no es un JWT), y las comprobaciones de 401/403 de cada controlador.
4. **¿Hay algún `console.log` con datos sensibles?**
   - En ningún log salen tokens, contraseñas ni claves;
   - los refresh tokens solo aparecen por su `family_id`, que por sí solo no da acceso;
   - en el cliente no hay ningún `console.log` con datos.
   - **Datos personales sí, pero solo en el modo de simulación de los correos** (sin `RESEND_API_KEY`):
     **H27**.
5. **¿Los límites de peticiones cubren las escrituras?**
   - **Cubiertas:**
     - con límite: login, registro, Google, el contacto y `confirmar-sesion`;
     - protegidas de otra forma: las escrituras del panel (piden sesión de administrador), `refresh` y
       `logout` (un refresh token de 32 bytes no se adivina) y el webhook (firma de Stripe).
   - **Sin cubrir:**
     - **H28:** `perfil-update` comprueba la contraseña actual sin límite de intentos;
     - **H29:** `crear-sesion-pago` crea sesiones de Stripe sin límite.

### H26 · BAJA · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · Los endpoints públicos devolvían más de lo que usa la web

- **Arreglo (29 sep 2026):**
  - **Muebles:** `GET /api/muebles`, `/api/muebles/buscar` y `/api/muebles/:id` piden solo
    `COLUMNAS_PUBLICAS_MUEBLE` (`mueblesController.js`), que son las que usan la web y el panel: `id`,
    `nombre`, `categoria`, `descripcion`, `precio_venta`, `precio_alquiler_dia`, `imagenes` y `estado`.
    - Ya no salen `disponible` (se deriva de `estado`), `created_at` (solo sirve para ordenar, y ordenar no
      necesita devolverla) ni `categoria_id` (la web usa `categoria`).
    - Cuando cierre la migración A y la web pase a `categoria_id`, habrá que añadirla a la lista a mano.
  - **Categorías, lectura pública:** `GET /api/categorias` devuelve solo `id`, `nombre`, `imagen_url` y
    `categoria_padre_id`, sin estadísticas. Ya no lee todos los muebles en cada visita.
  - **Categorías con estadísticas:** en una ruta nueva, `GET /api/admin/categorias/con-stats`
    (`routes/adminRoutes.js`, con `verificarAdmin`), con `Cache-Control: private, no-store`. Los muebles se
    leen solo con las columnas que entran en las cuentas.
  - **El panel no cambia:** sigue llamando a `getCategorias({ fresco: true })`, que en `api.js` ahora va a la
    ruta de administración con la sesión (`apiFetch`). Así los tests de caracterización del panel, que
    simulan `getCategorias`, no se tocan.
- **Tests:**
  - `columnasPublicas.test.js` (4):
    - con dos columnas inventadas en la tabla (`precio_compra`, `proveedor`), las tres lecturas públicas de
      muebles no las devuelven;
    - con el cliente real de supabase-js, lo que llega a PostgREST en `select` es la lista explícita, también
      en categorías;
  - `categoriasController.test.js`:
    - la lectura pública: solo las cuatro columnas, ni una nueva, sin leer los muebles, ordenada y
      cacheable;
    - la de administración: 401 sin sesión y 403 a un cliente, las estadísticas de siempre (movidas de la
      pública), sin caché y 500 genérico;
  - `api.test.js`: el test de `getCategorias({ fresco: true })` se cambia a propósito (marcado "CAMBIADO CON
    H26") para la ruta nueva.
  - `fakeSupabase` aplica ahora la lista de columnas de `select()`, como PostgREST. Los 341 tests del
    servidor siguieron pasando con ese cambio.

  Fallos plantados, todos detectados (6): volver a '*' en muebles y en categorías, añadir una columna a la
  lista, poner las estadísticas en la ruta pública, quitar `verificarAdmin` de la nueva y cachearla como
  pública.

**El hallazgo, tal y como se anotó:**

- **`select('*')` en todas las lecturas públicas** de `mueblesController.js` (`obtenerMuebles`,
  `obtenerMueblePorId` y `buscarMuebles`) y de `categoriasController.js` (`obtenerCategorias`). Hoy las tablas
  no tienen ninguna columna privada. Pero si mañana se añade una a `muebles`, por ejemplo un precio de compra,
  el proveedor o notas internas, saldrá al público sin que nadie lo decida.
- **`GET /api/categorias` es público y devuelve las estadísticas del panel.** Cada categoría lleva
  `stats: { totalProductos, disponibles, vendidos, alquilados, valorTotalVenta }`, y fuera del panel no las
  usa nadie (solo `CategoriasTab.jsx`). Hoy son deducibles de `/api/muebles`, que ya enseña el estado y el
  precio de cada pieza, incluidas las vendidas: por eso la gravedad es baja. Además, para calcularlas se leen
  todos los muebles en cada petición pública.
- **Arreglo propuesto (sin hacer):**
  - lista explícita de columnas en cada `select` público;
  - las estadísticas, en una ruta aparte con `verificarAdmin` (o solo con sesión de administrador), fuera de
    la caché pública de la CDN.

### H27 · BAJA · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · Datos personales en el log cuando los correos estaban en modo simulación

- **Arreglo (29 sep 2026):** en `server/src/utils/email.js`, los cinco correos en modo simulación (aviso de
  venta, confirmación al cliente, bienvenida, contacto y alerta al administrador) pasan por
  `registrarSimulacion`. Esta escribe una sola línea, `[email simulado omitido: falta RESEND_API_KEY,
  contenido con datos personales] (<qué correo>)`, sin ningún dato.
- **`EMAIL_DEBUG_DATOS=true`**, solo para depurar en local, vuelve a escribir el contenido, pero nunca con
  `NODE_ENV=production`. Se lee en cada llamada. Documentada en `docs/env-vars.md`, `server/.env.example` y el
  README.
- **Sigue en pie** que `RESEND_API_KEY` tiene que estar en producción: sin ella, los clientes no reciben
  ningún correo. Lo comprueba el usuario (no se ha mirado desde aquí).
- **Tests:** `emailSimulacion.test.js` (15), cambiado a propósito (antes comprobaba que el log decía
  "SIMULACIÓN" y escribía el contenido):
  - para cada una de las cinco funciones, el log no lleva el nombre, el email, el teléfono, la dirección ni
    las notas del comprador, y es una sola línea;
  - con `EMAIL_DEBUG_DATOS=true` en desarrollo, sí; en producción, no; con otro valor que "true", no.

  Fallos plantados, todos detectados (4): escribir siempre los datos, ignorar la producción, aceptar
  cualquier valor en la variable y un correo que vuelve a escribir el nombre.

**El hallazgo, tal y como se anotó:**

- **Dónde:** `server/src/utils/email.js`. Sin `RESEND_API_KEY`, en vez de enviar los correos se escriben en
  el log:
  - el pedido entero (nombre, email, teléfono, dirección y notas del comprador), en la notificación de venta
    y en la confirmación al cliente;
  - el email y el nombre de las cuentas nuevas;
  - los mensajes del formulario de contacto;
  - los detalles de las alertas al administrador (comprador, teléfono y dirección).
- **Cuándo pasa:** solo si falta la variable. En local es lo esperado y no importa. En producción, los logs de
  Vercel se guardarían con esos datos, y cualquiera con acceso al proyecto los vería.
- **Qué comprobar:** que `RESEND_API_KEY` está en las variables de producción de `nave5-api`. No se ha mirado
  desde aquí: las variables las gestiona el usuario.
- **Arreglo propuesto (sin hacer):** en modo simulación, escribir solo que se habría enviado un correo, y a
  qué tipo de destinatario, sin los datos.

### H28 · BAJA · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · `perfil-update` comprobaba la contraseña actual sin límite de intentos

- **Arreglo (29 sep 2026):** `limitadorPerfil` en `server/src/routes/authRoutes.js`, después de
  `verificarToken`.
  - **10 intentos fallidos cada 15 minutos por cuenta,** no por IP. Solo cuentan los que fallan (una
    contraseña incorrecta, un cuerpo no válido...): cambiar solo el nombre no gasta nada.
  - **Al llegar al límite,** responde 429 con "Demasiados intentos con una contraseña incorrecta. Espera 15
    minutos antes de volver a intentarlo.", también con la contraseña buena, hasta que pase la ventana.
  - **La clave es el id de la cuenta.** Para eso, el access token lleva ahora `sub` (el id, el campo estándar
    de JWT). Los tokens firmados antes no lo llevan, y en ellos se usa el email, que también identifica la
    cuenta. Esos tokens desaparecen solos en 7 días como mucho.
  - **Log:** cada contraseña incorrecta deja "perfil-update: contraseña actual incorrecta (cuenta <id>)", y el
    límite, "límite de intentos alcanzado (cuenta:<id>)". Nunca la contraseña.
  - **Alcance:** como los demás límites, vive en la memoria de cada instancia de Vercel (H4). Frena la fuerza
    bruta, pero no es un tope global.
- **Tests:** `server/src/__tests__/perfilLimite.test.js` (7):
  - 10 fallos dan 401, el 11 da 429 con el mensaje, y el 12, con la contraseña buena, también 429;
  - el límite es por cuenta: desde la misma IP, otra cuenta sigue pudiendo;
  - cambiar el nombre no gasta intentos;
  - un token sin `sub` se reconoce por el email;
  - el token del login lleva `sub`;
  - los avisos del log llevan el id y nunca la contraseña.

  Fallos plantados, todos detectados: sin limitador, la clave por IP, contar también los que van bien, límite
  de 20, sin `sub` en el token y sin el aviso de cada fallo.

**El hallazgo, tal y como se anotó:**

- **Dónde:** `POST /api/auth/perfil-update` (`authRoutes.js`) no lleva `limitadorAuth`, y `actualizarPerfil`
  compara con bcrypt la contraseña actual que se le mande.
- **El riesgo:**
  - alguien que tenga una sesión robada (1 hora de access token, o la duración del refresh token si se ha
    llevado también ese) puede probar contraseñas sin límite hasta dar con la buena;
  - con ella cambia el email y la contraseña, y con H21 eso además cierra las demás sesiones: la persona queda
    fuera de su propia cuenta;
  - el coste de bcrypt (10) lo frena, pero no lo para con una contraseña débil.
- **Hace falta una sesión válida antes,** y por eso la gravedad es baja.
- **Arreglo propuesto (sin hacer):** un limitador para `perfil-update` que cuente solo los intentos con
  contraseña incorrecta (`skipSuccessfulRequests`, como el de login), por cuenta y no solo por IP.

### H29 · BAJA · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · `crear-sesion-pago` no tenía límite de peticiones

- **Arreglo (29 sep 2026):** dos limitadores en `POST /api/muebles/crear-sesion-pago`
  (`server/src/routes/mueblesRoutes.js`). Los dos cuentan todas las llamadas, también las que van bien,
  porque son las que crean sesiones en Stripe:
  - **por IP:** 20 cada 15 minutos. Va antes de validar, así que también cuenta el spam mal formado;
  - **por email del comprador**, si viene en `clienteInfo.email`: 10 cada 15 minutos. Va después de validar, y
    el email se normaliza (sin espacios y en minúsculas) para que cambiar las mayúsculas no dé un contador
    nuevo. Sin email, solo se aplica el de IP.
  - **Al llegar a cualquiera de los dos,** responde 429 con "Demasiados intentos de pago seguidos. Espera unos
    minutos antes de volver a intentarlo.", que el checkout enseña tal cual (contrato B de `api.js`).
  - **No se escribe el email en el log al bloquear:** sería un dato personal (H27).
  - **Alcance:** como los demás, por instancia de Vercel (H4).
- **Tests:**
  - `pagoLimiteIp.test.js` (2): 20 pasan, el 21 da 429 y ya no llega a Stripe; una petición mal formada
    también queda bloqueada;
  - `pagoLimiteEmail.test.js` (5), con una IP distinta por test (`trust proxy` como en Vercel):
    - 10 con el mismo email en distintas mayúsculas pasan, y el 11 da 429;
    - el bloqueo sigue al email, no a la IP;
    - otro email desde la misma IP sí pasa;
    - sin email no hay límite por email;
    - las peticiones que no pasan la validación no gastan el límite.

  Los tests de pago que ya había (`crearSesionPago`, `confirmarSesion`) siguen por debajo de los dos límites.
  Fallos plantados, todos detectados (8): sin cada limitador, el email sin minúsculas o sin recortar, el
  límite por email antes de validar, el de IP después, y los dos límites más altos.

**El hallazgo, tal y como se anotó:**

- **Dónde:** `POST /api/muebles/crear-sesion-pago` es público (se puede comprar como invitado) y cada llamada:
  - lee el catálogo;
  - crea una sesión de Checkout en Stripe.

  No tiene limitador (`confirmar-sesion`, en cambio, sí).
- **El riesgo:** alguien que la llame en bucle gasta el límite de peticiones de la API de Stripe de la cuenta,
  y eso podría hacer fallar el pago a compradores reales. Carga, además, la base de datos. Stripe no cobra por
  las sesiones que no se pagan.
- **Arreglo propuesto (sin hacer):** un limitador generoso, por ejemplo 20 cada 15 minutos por IP, como el de
  `confirmar-sesion`. Con el alcance real de H4: el límite es por instancia de Vercel.

### H30 · INFORMATIVO · CERRADO EN LA RAMA (29 sep 2026; sin desplegar) · El pie de página enseñaba "Panel Admin" a quien no había iniciado sesión

- **Arreglo (29 sep 2026):** en `client/src/components/Footer.jsx`, el enlace "Panel Admin" solo sale con
  `user?.rol === 'admin'`. Antes la condición era `!user || user.rol === 'admin'`.
- **Tests:** en `Footer.test.jsx`, el test que fijaba el comportamiento anterior se cambia a propósito (marcado
  "CAMBIADO CON H30"), y se añade el de un usuario sin rol:
  - sin sesión, no está;
  - con sesión de cliente o sin rol, tampoco;
  - con administrador, sí.

  Con la condición anterior, falla el de sin sesión.

**El hallazgo, tal y como se anotó:**

- **Dónde:** `client/src/components/Footer.jsx`, con la condición `(!user || user.rol === 'admin')`.
- **No abre nada:** `/admin` está protegida en el cliente (`ProtectedRoute adminOnly`) y en el servidor
  (`verificarAdmin`). Pero anuncia a cualquier visitante que hay un panel y dónde está.
- **Arreglo propuesto (sin hacer):** enseñarlo solo con `user?.rol === 'admin'`. El comportamiento de hoy
  está fijado en `Footer.test.jsx`, con un test que dice que se cambia con ello.

### H32 · BAJA · BUG · CERRADO EN LA RAMA (2 oct 2026, `c0a90e1`; sin desplegar) · La ficha del producto se inventaba una referencia

- **Dónde:** `client/src/pages/ProductDetail.jsx`, al final de la ficha: `Ref. SKU-{String(mueble.id).slice(0,
  6).toUpperCase() || '0001A'}`.
- **Qué pasaba:** enseñaba al público una "referencia" que no existía en ningún sitio: los 6 primeros caracteres del
  id (un UUID). No servía para buscar la pieza ni coincidía con nada del panel. Desde A6 convivía además con la
  referencia real ("Ref. NAV-…"), con dos referencias distintas en la misma ficha.
- **Arreglo (A6):** quitada, junto con su estilo (`.pd-sku`). La ficha enseña solo la referencia real, bajo el
  nombre, con `ReferenciaProducto`.
- **Tests:** la ficha no tenía ninguno. `ProductDetail.test.jsx` (16 tests) la cubre entera, con uno que comprueba
  que ya no sale ningún "SKU".
- **Nota:** no hay ningún H31 anotado en este documento; la numeración salta de H30 a H32.

### H33 · BAJA · DEUDA ACEPTADA (2 oct 2026) · Dos secretos del servidor se pueden leer en el panel de Vercel

- **Qué:** en el proyecto `nave5-api` de Vercel, `JWT_SECRET` y `STRIPE_SECRET_KEY` están guardadas como
  *Encrypted*, no como *Sensitive*. Vercel las marca como `readable-secret`: cualquiera con acceso al
  proyecto puede leer su valor en el panel o por la API. (Las demás claves de verdad, como
  `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` y `REFRESH_TOKEN_HASH_SECRET`, ya son *Sensitive*.)
- **Por qué se acepta hoy:** el proyecto es individual; solo su dueño tiene acceso, así que "legible" no abre
  nada nuevo.
- **Cuándo hay que hacerlo:** el día que se añada un colaborador al proyecto de Vercel. Pasar una variable a
  *Sensitive* obliga a borrarla y crearla de nuevo, y conviene aprovechar para rotarla:
  - `JWT_SECRET`: al cambiarla, todas las sesiones abiertas se cierran (hay que volver a iniciar sesión);
  - `STRIPE_SECRET_KEY`: se genera una nueva en Stripe, se pone en Vercel y en `server/.env` local, y se
    vuelve a probar el pago.
- **No confundir:** `MOSTRAR_PRECIOS` es *Encrypted* a propósito; no es un secreto, y así se puede ver si está
  en `true` o en `false`.

### H34 · BAJA · SEO · DECIDIDO: PENDIENTE (2 oct 2026) · Sin `canonical` ni `og:url`, y el SEO por página solo existe con JavaScript

- **Estado real (comprobado el 2 oct en el código y en el HTML de producción):** no hay ninguna etiqueta
  `<link rel="canonical">` ni `og:url`, ni en `client/index.html` ni en el código. Antes no estaba anotado en
  ningún hallazgo (se habló de él como "H31", número que no existe).
- **El SEO por página es solo de cliente:** `useDocumentMeta` (`client/src/utils/useDocumentMeta.js`) cambia con
  JavaScript el `<title>`, la descripción y las etiquetas Open Graph y Twitter de cada página. Quien no ejecuta
  JavaScript (las vistas previas de WhatsApp, Facebook o LinkedIn, y en parte los buscadores) solo ve las del
  `index.html` compartido, que son las de la portada: un enlace a una ficha se previsualiza como la portada.
- **Por qué no se añade ahora:** con un único `index.html` para todas las rutas, un `canonical` (o un `og:url`)
  fijo apuntaría siempre a la portada, y eso le diría a los buscadores que todas las páginas son la portada.
  Peor que no tenerlo.
- **Decisión:** pendiente hasta que haya páginas con SEO diferenciado en el HTML que se sirve (prerenderizado
  de las rutas públicas, o un render en el servidor para las fichas). Entonces se añaden `canonical` y `og:url`
  por página, junto con el resto de etiquetas.

### H35 · MEDIA · RENDIMIENTO · RESUELTO (5 oct 2026, `72393f0`) · El carrito de pago no tiene número máximo de piezas y hace una consulta por pieza

- `schemaCarritoPago` (`server/src/schemas/muebles.js`) solo pide una pieza como mínimo. Con el límite del cuerpo
  JSON (100 KB) caben unos miles.
- `construirLineasDesdeCarrito` (`mueblesController.js`) lee cada pieza con su propia consulta, una tras otra,
  antes de llegar a Stripe. Es una ruta pública: el limitador de H29 (20 por IP cada 15 min) lo frena, pero
  no lo evita.
- **Propuesta:**
  - leer todas las piezas en una consulta (`.in('id', ids)`);
  - poner `.max(...)` al carrito (una tienda de piezas únicas no necesita más de unas decenas).
- Detalle en `docs/auditoria-tecnica.md`, puntos 7 y 9.
- **Resuelto (5 oct, `72393f0`):**
  - como máximo 20 piezas por pedido, con un 400 claro antes de consultar nada;
  - una sola consulta `.in()`, solo con las columnas necesarias;
  - en el cliente, la cesta no admite la pieza 21 y el botón pasa a "Cesta llena".
- **Aprobado por el usuario (5 oct): 20 como máximo, configurable.** Si algún cliente necesita más, se sube.
  Hay que cambiar el número en dos sitios, que tienen que coincidir:
  - `MAX_PIEZAS_CARRITO` en `server/src/schemas/muebles.js`;
  - `MAX_PIEZAS_CESTA` en `client/src/context/CartContext.jsx`.

  Cuidado con dos tests que fallarán a propósito al cambiarlo:
  - `crearSesionPago.test.js` prueba el caso de 20 piezas y el de 21;
  - `CartContext.test.jsx` comprueba que el tope es 20.

  No se ha pasado a variable de entorno: haría falta una en Vercel para cada proyecto (`nave5-api` y
  `nave5-demo`), y que no se desincronizaran.
  `server/src/__tests__/contratoTopeCarrito.test.js` falla si las dos constantes no coinciden. Lee la del
  cliente como texto: la CI hace un checkout completo del repositorio.

### H36 · MEDIA · DATOS · RESUELTO (5 oct 2026, `6e3b682`) · `GET /api/pedidos/mios` devuelve todas las columnas del pedido al cliente

- Usa `select('*')`: cualquier columna interna que se añada a `pedidos` saldría al cliente sin que nadie lo
  decida.
- Es lo mismo que H26 arregló en `muebles` y `categorias`.
- **Propuesta:** elegir las columnas, y de paso las del panel (`GET /api/pedidos`).
- **Resuelto (5 oct):**
  - `/mios` devuelve solo `id, created_at, estado, total, items` (`6e3b682`);
  - el panel devuelve solo las columnas que enseña (`9849118`, con H37).

### H37 · MEDIA · RENDIMIENTO · RESUELTO (5 oct 2026, `9849118`) · El panel trae todos los pedidos de la historia en cada carga

- `GET /api/pedidos` no tiene límite ni paginación, y crece con cada venta.
- **Propuesta:** los últimos N, con "ver más", o paginar.
- **Resuelto (5 oct, `9849118`):**
  - **Servidor:** `?page`, `?limit` (20 por defecto, como mucho 100) y `?estado`. Devuelve
    `{ pedidos, total, pagina, porPagina, totalPaginas, pendientes }`.
  - **Panel:** "← Anterior / Siguiente →". El filtro lo aplica el servidor. La insignia y el Resumen usan los
    pendientes de toda la historia.
  - **`getPedidos`:** pasa del contrato C al A (`null` si falla).
  - **Tests y mutantes:** los de caracterización afectados llevan `CAMBIADO A PROPÓSITO`. Se reescribieron
    4 mutantes; siguen siendo 127 (126 detectados y 1 superviviente esperado).

### H38 · MEDIA · MIGRACIONES · RESUELTO EN PARTE (5 oct 2026, `f5070b8`) · Faltan en el repositorio las 7 primeras migraciones y las tablas base

- Las migraciones del 3 al 5 de septiembre no tienen copia en `server/migrations/`:
  - `enable_rls_public_read_only`;
  - `sync_disponible_from_estado_trigger`;
  - `fix_search_path_sync_disponible_trigger`;
  - `add_categoria_padre_id`;
  - `pedidos_soporte_checkout_multiproducto`;
  - `cleanup_pedidos_phantom_columns_and_indexes`;
  - `move_http_extension_out_of_public`.
- Tampoco está el `CREATE TABLE` de `muebles`, `categorias`, `clientes` y `pedidos`.
- No se puede reconstruir la base de datos desde el repositorio, ni comprobar sus índices sin consultarla.
- **Propuesta:** volcar el esquema actual (solo lectura) y guardarlo como migración de partida.
- **Resuelto en parte (5 oct, `f5070b8`):**
  - las 7 migraciones están en `server/migrations/`, sacadas de `schema_migrations` solo leyendo. Cada una tenía
    una sola sentencia, y las 7 tienen el mismo MD5 que lo registrado. No llevan `.down.sql`: el estado de
    antes no consta, y escribir su reversión sería inventarla;
  - `server/migrations/README.md`: la convención, cómo se aplica, cómo se comprueba y la tabla de las 23 con su
    MD5. Base de datos, archivos y tabla coinciden, 23/23;
  - al comprobarlo salieron dos diferencias antiguas, documentadas en el README y sin tocar. Las 10 de
    `20260922115443` a `20261001212500` tienen un salto de línea final de más. A3 (`20261001220000`) se
    registró con `\r\n` (fines de línea de Windows), y git la guarda con `\n` por `.gitattributes`. El texto
    es el mismo.
- **Queda:** el `CREATE TABLE` de `muebles`, `categorias`, `clientes` y `pedidos`. Ninguna migración las crea
  (ya existían el 3 sep). Hace falta volcar el esquema con `supabase db dump` o `pg_dump --schema-only`, y
  para eso la cadena de conexión de la base de datos: lo tiene que hacer el usuario, o darla.
  - **Decisión del usuario (5 oct):** no se hace. Queda cerrado como no prioritario en H52.

### H39 · MEDIA · USABILIDAD · RESUELTO (5 oct 2026, `6b53791`) · En el móvil no se puede abrir la búsqueda

- El panel de búsqueda solo se abre pulsando `.header-search-bar` (`Header.jsx`), y por debajo de 768 px esa
  barra está oculta (`display: none`): en el móvil no hay ninguna forma de buscar.
- Además es un `div` con `onClick`: no se llega a él con el teclado ni lo anuncia un lector de pantalla.
- **Por qué no se arregló en la tarea 6:** solo con CSS habría que enseñar un quinto icono, y a 375 px la
  cabecera ya no tiene sitio.
- **Propuesta (JSX):** un botón de lupa con `aria-label="Buscar"`, visible en el móvil, y convertir la barra en
  un `<button>`.
- **Resuelto (5 oct, `6b53791`):**
  - lupa "Buscar" en el móvil, y la barra pasa a ser un `<button>`;
  - el campo recibe el foco al abrir; Escape cierra el buscador y devuelve el foco;
  - la cabecera se compacta para que quepa de 320 a 1024 px;
  - E2E nuevo: `e2e/busqueda.spec.js`.

### H40 · BAJA · USABILIDAD · RESUELTO (5 oct 2026, `aaa6ee8`) · Estados vacíos sin acción y 404 sin enlace a contacto

Lo de la tarea 6 que no se puede hacer solo con CSS (necesita JSX):
- el catálogo vacío ("No hay productos en esta categoría", y "Aún no tienes favoritos") no tiene un botón para
  volver al catálogo completo;
- las pestañas vacías de Mi cuenta tampoco tienen acción. Favoritos vacíos y "Cargando tus pedidos..." tienen el
  mismo marcado, así que el corazón solo se puede poner con una clase propia;
- la 404 tiene "Volver al inicio" y "Ver el catálogo completo", pero no "Contacto".

**Resuelto (5 oct, `aaa6ee8`):**
- catálogo vacío: "Ver todo el catálogo" o, en favoritos, "Explorar catálogo", con un corazón;
- búsqueda sin resultados: "Limpiar búsqueda";
- Mi cuenta: favoritos y pedidos vacíos con icono y "Explorar catálogo";
- 404: con enlace a Contacto.

### H41 · BAJA · ACCESIBILIDAD · RESUELTO (5 oct 2026, `5babdb3`) · Las categorías de encima del catálogo no se pueden usar con el teclado

- `CategorySlider.jsx` pinta cada categoría como un `div` con `onClick`: no se llega con el tabulador ni lo
  anuncia un lector de pantalla. Es lo mismo que A9 de `docs/auditoria-accesibilidad.md` (los círculos de la
  portada, ya arreglado), pero en el catálogo. axe no lo detecta.
- Encontrado al escribir sus tests (tarea 5 de la sesión del 5 oct). No se cambió ahí porque era un commit
  solo de tests.
- **Propuesta:** `<button type="button" aria-pressed={activa}>` en cada categoría, con el mismo CSS.
- **Resuelto (5 oct, `5babdb3`):**
  - cada categoría es un `<button type="button" aria-pressed>`: se llega con el tabulador y se activa con
    Enter o Espacio;
  - la foto lleva `alt=""`, como los círculos de la portada (A9);
  - el CSS quita el aspecto de botón del navegador. Con el foco, la categoría se eleva como con el ratón; el
    anillo lo pone la regla común de `index.css`;
  - tests de Enter, Espacio, el tabulador y las reglas de foco del CSS.

### H42 · MEDIA · RENDIMIENTO · RESUELTO (5 oct 2026, `498e0c3`) · Las fotos del hero se descargan a 1600 px también en el móvil

- Las cuatro fotos del slider pesan de 197 a 405 KB. La primera (367 KB) es la imagen más grande de la
  portada, y en el móvil se enseña a 375 px.
- **Propuesta:** versiones de 800 px con `srcset`/`sizes`, y una versión apaisada de `hero-showroom.webp`.
- **Por qué no se hizo:** el ImageMagick del contenedor no escribe WebP. Detalle en
  `docs/auditoria-rendimiento.md`.
- **Resuelto (5 oct, `498e0c3`):**
  - cada foto va en un `<picture>`: la de 800 px en el móvil (< 768 px), la de 1200 px hasta 1200 px de
    pantalla, y el original por encima;
  - generadas con `sharp` 0.35, el del servidor (WebP, calidad 80, `effort` 6), y revisadas a ojo junto al
    original;
  - van en `client/public/img`, con las demás. No van al bucket de Supabase: así las sigue sirviendo Vercel, y
    no hay que escribir en Supabase ni cambiar la CSP;
  - las 4 fotos pesan 400 KB en el móvil (antes 1 223 KB) y 805 KB hasta 1200 px;
  - comprobado en Chromium a 7 anchos: a cada uno se pide su versión, y la foto ocupa la caja como antes.
- **Queda:** la versión apaisada de `hero-showroom.webp` (recomendación 2 de la auditoría de rendimiento). Es
  una decisión de diseño: recortarla cambia lo que se ve en una tableta en vertical. Ver también H49.
  - **Decisión del usuario (5 oct):** recorte al centro por defecto. Si en algún dispositivo real queda mal, se
    ajusta `object-position` (por ejemplo, `30% center`).

### H43 · BAJA · ACCESIBILIDAD · RESUELTO (5 oct 2026, `329a947`) · Orden de los títulos y login sin `h1`

- **Qué es:** avisos moderados de axe (A10 y A11 de `docs/auditoria-accesibilidad.md`):
  - se salta de `h1`/`h2` a `h3` en las tarjetas del catálogo, en Contacto y en el pie;
  - el inicio de sesión no tiene `h1`.
- **Por qué no se tocó:** cambiar el nivel cambia el tamaño en el CSS, así que hay que revisarlo con el diseño.
- **Resuelto (5 oct, `329a947`):**
  - inicio de sesión: el título es el `h1`;
  - pie: el boletín y las columnas pasan a `h2` (antes `h3` y `h4`);
  - catálogo: el nombre de cada pieza pasa a `h2`;
  - Contacto: los bloques y el formulario pasan a `h2`;
  - Mi cuenta (favoritos), cesta, y buscador y menú de la cabecera: un nivel menos, para seguir a su título;
  - **sin cambios a la vista:** los selectores siguen a su etiqueta, y se fija el `margin-top` que ponía el
    navegador (y la tipografía en Contacto). Medido con Playwright: 16 propiedades calculadas de cada título,
    iguales antes y después, a 1280 y a 375 px;
  - tests: un `h1` y sin saltos en 8 páginas (con cabecera, pie y cesta), y `heading-order` y
    `page-has-heading-one` de axe en el E2E de accesibilidad.

### H44 · MEDIA · DEPENDENCIAS · PENDIENTE (5 oct 2026) · `npm audit` del cliente: 8 avisos, uno en una librería que llega al navegador

- **Qué dice `npm audit`** (5 oct): 8 avisos (2 críticos, 1 alto, 5 moderados), todos de antes de esta sesión.
  `@axe-core/playwright` no añadió ninguno: en el `package-lock.json` solo entraron `axe-core` y él.
- **Solo en desarrollo:** `vitest`, `@vitest/coverage-v8`, `@vitest/mocker`, `vite`, `vite-node` y
  `esbuild`. Afectan al servidor de desarrollo y a la interfaz de Vitest, no a la web publicada.
- **En el navegador:** `react-router` / `react-router-dom` (moderado). Entre otros, una redirección abierta
  con una barra invertida en `<Link>`/`useNavigate`.
- **Comprobado el 5 oct, `react-router`:** instaladas `react-router` y `react-router-dom` 6.30.6 y
  `@remix-run/router` 1.23.4 (la versión de H23). Hay dos advisories nuevos, publicados después de H23, que
  afectan a toda la rama 6 y se corrigen solo en la 7.18 (versión mayor):
  - [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6): redirección abierta con una
    barra invertida en `<Link>`/`useNavigate` (afecta de 6.0.0 a 7.18). **No es explotable aquí:** todos los
    `to=` y `navigate()` del cliente empiezan por una ruta fija (`/catalogo?…`, `/mueble/…`, `/contacto?…`, o
    `navigate(-1)`). Ninguno toma el principio de la ruta de la URL ni de lo que escribe quien visita.
    No hay redirección "volver a" con un parámetro.
    *(Desde H45, 5 oct, `a49c25d`: sí hay "volver a" tras iniciar sesión, pero la ruta va en el `state` de la
    navegación, no en la URL, y `utils/rutaInterna.js` solo deja pasar rutas de la web: ni `//`, ni `\`, ni
    caracteres de control.)*
  - [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg): inyección en
    `deserializeErrors()` al hidratar con render en el servidor (de 6.4.0 a 7.18). **No aplica:** la web usa
    `<BrowserRouter>`, solo en el navegador, sin render en el servidor ni datos de hidratación.
- **Decisión propuesta:**
  - aceptar el aviso de `react-router` hasta migrar a la v7, que es un cambio de versión mayor, en su propia
    sesión;
  - si se añade alguna redirección con una ruta que venga de la URL, hay que validarla o migrar antes.
- **Dependencias de desarrollo** (vite, vitest, esbuild): subirlas en su propio commit, con el gate.
- **Por qué no se hizo:** `npm audit fix --force` cambia de versión mayor. Hay que hacerlo a propósito.

### H45 · BAJA · USABILIDAD · RESUELTO (5 oct 2026, `a49c25d`) · Volver a la página pedida después de iniciar sesión

- **Qué pasa:**
  - Si alguien sin sesión intenta entrar en `/cuenta`, `ProtectedRoute` lo manda a `/login`
    (`<Navigate to="/login" replace />`).
  - Al iniciar sesión, `Login.jsx` hace siempre `navigate('/')`: no vuelve a la ruta que se pedía y la persona
    acaba en la portada.
- **A qué afecta:**
  - al botón "Ver mi pedido" del email de confirmación (`/cuenta?tab=pedidos`, ver `f110fb0`);
  - a cualquier acceso directo a `/cuenta` sin sesión.
- **Por qué no corre prisa:** el email de confirmación solo sale al comprar, y con `MOSTRAR_PRECIOS=false`
  nadie puede comprar.
- **Arreglo:**
  - guardar la ruta original (con su `?tab=…`) al redirigir, en el `state` de `<Navigate>` o en un parámetro
    de la URL;
  - usarla en el `navigate()` tras el login.
  - Si va en un parámetro de la URL, hay que validar que sea una ruta interna (que empiece por `/` y no por
    `//` ni `/\`). Si no, sería justo la redirección abierta de H44.
- **Cuándo:** en la sesión de usabilidad, junto con H41 y H43.
- **Resuelto (5 oct, `a49c25d`):**
  - `ProtectedRoute` manda al login con la ruta pedida (con su `?tab=...`) en el `state`, nunca en la URL;
  - `Login` vuelve a ella con `replace` al entrar con contraseña, al crear la cuenta y con Google;
  - `utils/rutaInterna.js` valida el `state`, que también se puede manipular: solo rutas que empiezan por
    una sola `/`, sin `\`, espacios ni caracteres de control. Si no, la portada;
  - E2E: `/cuenta?tab=pedidos` → login → de vuelta, sin dejar el login en el historial.
- **Queda:** los enlaces "Mi cuenta" y "Mis pedidos" del pie, sin sesión, van directos a `/login` y no llevan
  la ruta: ver H50.

### H46 · BAJA · CI · PENDIENTE (5 oct 2026) · `actions/checkout@v4` y `actions/setup-node@v4` usan Node 20

- **Qué avisa GitHub** (CI #14, la del merge `035cffa`): esas dos acciones usan Node 20, que está obsoleto
  en los runners.
- **Por qué funciona igual:** GitHub las está ejecutando con Node 24, y los tres jobs salieron en verde.
- **Qué hacer:** cuando se toque `.github/workflows/ci.yml`, subirlas a la v5. Antes, comprobar que la v5
  existe y qué cambia.
- **Cuándo:** no corre prisa. Va en el bloque de actualización de dependencias, junto con H44 (react-router 7)
  y vite/vitest. Es un hallazgo aparte de H44.

### H47 · CRÍTICA · ACCESIBILIDAD · RESUELTO (6 oct 2026, `2d39756`) · Mi cuenta: campos sin etiqueta, poco contraste y dos `<main>`

Encontrado al revisar H43 con axe en `/cuenta`. El E2E de accesibilidad no pasa por esta página, porque hace
falta una sesión.
- **Crítico (`label`):** en "Mis Datos", los campos "Nombre completo" y "Correo electrónico" tienen un
  `<label>` sin `htmlFor`, y el campo no tiene `id`: un lector de pantalla los anuncia sin nombre. Los de
  contraseña se salvan por el `placeholder`. **Arreglo:** `id` en cada campo y `htmlFor` en su etiqueta.
- **Grave (`color-contrast`):** la etiqueta "Contraseña actual (Solo requerida si…)" usa `--accent-color`
  (#B38A70): 2,76:1 sobre el fondo (AA pide 4,5). **Arreglo:** `--accent-text`, como en el resto de la web
  (`Profile.css`, `.form-group-clean.form-group-security label`). En oscuro pasa.
- **Moderado (`landmark-*`):** `Profile.jsx` tiene un `<main className="profile-tab-content">` dentro del
  `<main id="contenido">` de `App.jsx`. **Arreglo:** cambiarlo por un `<div>` o un `<section>`, comprobando
  antes el CSS.
- **Además:** añadir `/cuenta` (con sesión simulada) al E2E de accesibilidad.
- **Resuelto (6 oct, `2d39756`):**
  - los cinco campos del formulario tienen `id` y su `<label htmlFor>`;
  - la etiqueta de la contraseña actual usa `--accent-text` (4,67:1; en oscuro, el mismo que ya pasaba);
  - el `<main>` interior es un `<div>`: el CSS iba por la clase, y no hay selectores globales de `main`;
  - E2E: Mi cuenta (datos, favoritos y pedidos, en claro y oscuro) con `label`, `color-contrast` y `landmark-*`
    de axe, un solo `<main>` y un solo `h1`; y que cada campo se localiza por su etiqueta. Se comprobó
    revirtiendo cada arreglo por separado: cada regla falla sola;
  - **cómo se entra en el E2E:** por el formulario de login, con la API simulada. La primera versión sembraba
    la sesión en `localStorage`, y sin *access token* en memoria "Mis pedidos" daba 401 y la web echaba a
    `/login`: los casos de `pedidos` pasaban mirando la página de login. No necesita credenciales reales ni
    secretos: funciona igual en local y en el CI (el job de E2E arranca Vite y simula la API en el navegador);
  - tests de `Profile`: etiquetas asociadas, `id` únicos y ningún `<main>` propio.

### H48 · GRAVE · ACCESIBILIDAD · RESUELTO (6 oct 2026, `a5b6f54`) · El enlace del aviso de cookies tiene poco contraste

- El enlace "Política de Privacidad" del aviso de cookies usa `--accent-color` (#B38A70) sobre `--card-bg`:
  2,97:1 en modo claro (AA pide 4,5). axe lo marca como grave.
- Lo ve toda persona que entra por primera vez. Se escapó porque el E2E de accesibilidad cierra el aviso
  antes de pasar axe.
- **Arreglo:** `color: var(--accent-text)` en `.cookie-banner p a` (`CookieConsent.css`). Y pasar axe una
  vez con el aviso abierto.
- **Resuelto (6 oct, `a5b6f54`):**
  - `--accent-text` (#8A644C): de 2,97:1 a 5,03:1 sobre `--card-bg`, calculado a mano. En oscuro es el mismo
    color que ya pasaba;
  - E2E: axe sobre el propio aviso, abierto y sin pulsar nada, en claro y en oscuro, con todas las reglas WCAG
    A y AA y contando cualquier gravedad. Falla antes del arreglo solo en claro;
  - Vitest (el E2E no bloquea el CI): el enlace del aviso y la etiqueta de H47 siguen usando `--accent-text`.

### H49 · BAJA · RENDIMIENTO · RESUELTO (6 oct 2026, `26d0ff8`) · Las cuatro fotos del hero se descargan al cargar la portada

- Las tres fotos que no se ven llevan `loading="lazy"`, pero están apiladas dentro de la pantalla (con
  `opacity: 0`), así que el navegador las pide igualmente. Comprobado en Chromium al hacer H42: a cualquier
  ancho se piden las cuatro.
- Con H42 son 400 KB en el móvil (antes 1 223 KB), pero tres de las cuatro fotos no se ven hasta pasados
  5,5 s, 11 s y 16,5 s.
- **Propuesta:** poner la foto de cada diapositiva solo cuando le toque, o cuando le toque a la anterior,
  para que esté lista. Ojo con el fundido: la siguiente tiene que estar descargada antes de mostrarse.
- **Resuelto (6 oct, `26d0ff8`):**
  - solo hay `<picture>` de la foto que se ve y de las ya vistas; la siguiente se pide 3 s después de mostrar
    la actual (2,5 s antes de que le toque); al pulsar un punto, la foto sale en ese mismo render;
  - medido en Chromium (peticiones a `/img/hero`): antes, 4 al cargar; ahora, 1 al cargar (98 KB en móvil, 359 KB
    en escritorio; antes 400 y 1 223 KB), 2 a los 3,6 s y 3 a los 9,6 s;
  - tests: Vitest con relojes simulados (comprobado por mutación) y un E2E que cuenta las peticiones reales a
    375 y 1440 px, con `page.clock` para que no dependa de lo que tarde en cargar la máquina;
  - **limitación:** con una conexión muy lenta (menos de ~1,3 Mbit/s para la foto de 359 KB) la siguiente puede
    no haber llegado a los 2,5 s, y se vería el fondo oscuro del hero un momento. Si molesta, se puede esperar
    a que la siguiente cargue antes de cambiar.

### H50 · BAJA · USABILIDAD · RESUELTO (6 oct 2026, `d287d31`) · "Mis pedidos" del pie, sin sesión, acaba en la portada

- Sin sesión, los enlaces "Mi cuenta" y "Mis pedidos" del pie apuntan a `/login`, no a `/cuenta`. Así no
  pasan por `ProtectedRoute` y no llevan la ruta (H45): tras entrar, se va a la portada.
- **Arreglo:** que apunten siempre a `/cuenta` y `/cuenta?tab=pedidos`. Sin sesión, `ProtectedRoute` ya manda
  al login con la vuelta preparada. Hay que cambiar los tests del pie que esperan `/login`.
- **Resuelto (6 oct, `d287d31`):**
  - los dos enlaces del pie apuntan siempre a `/cuenta` y `/cuenta?tab=pedidos`; `ProtectedRoute` hace el resto;
  - el icono "Cuenta" de la cabecera sigue yendo a `/login`: es el acceso genérico, sin página que recordar;
  - E2E: sin sesión, "Mis pedidos" (y "Mi cuenta") → login → de vuelta en `/cuenta?tab=pedidos` (y `/cuenta`).
    Falla antes del arreglo, acabando en la portada;
  - el test del pie que esperaba `/login` lleva `CAMBIADO A PROPÓSITO`.

**Decisión del usuario (5 oct):** H47, H48, H49 y H50 van en la siguiente sesión. *(Hechos el 6 oct.)*

### H53 · BAJA · ACCESIBILIDAD · PENDIENTE (6 oct 2026) · Etiquetas sin asociar en el acceso, el pago y la ficha

Encontrado al buscar "otros sitios" para H47. **No comprobado con axe**: lo sé por el código.
- `AuthModal.jsx` (3 etiquetas) y `CheckoutModal.jsx` (8, el formulario de compra): cada `<label>` va sin
  `htmlFor` y su campo sin `id`. Los campos tienen `placeholder`, y axe lo acepta como nombre accesible (por eso
  en Mi cuenta solo fallaban nombre y correo, que no lo tienen), así que probablemente axe no los marque. Pero
  es un nombre frágil: desaparece al escribir, y pulsar la etiqueta no lleva el foco al campo.
- `ProductDetail.jsx`: "Cantidad" y "Modalidad" son `<label>` de un grupo de botones, no de un campo. Habría
  que usar un título de grupo (`role="group"` con `aria-labelledby`).
- **No se tocó** porque H47 era Mi cuenta y los modales tienen sus propios tests.
- **Al hacerlo:** un `id` único por campo (los modales pueden coexistir con otros formularios) y pasar axe con
  cada modal abierto. En esta sesión se intentó abrirlos desde un E2E (cesta sembrada en `localStorage`, abrir
  la cesta y pulsar "Confirmar Pedido") y el clic agotó el tiempo. No se averiguó el motivo.

### H51 · BAJA · REPOSITORIO · CERRADO SIN CAMBIOS (5 oct 2026) · Finales de línea en las migraciones

- **Qué pasa:**
  - Algunas copias antiguas de `server/migrations/` no coinciden byte a byte con `schema_migrations`.
  - A3 (`20261001220000`) se registró con `\r\n`, y el repositorio la guarda con `\n`.
  - Los 10 archivos de `20260922115443` a `20261001212500` tienen un salto de línea final que lo registrado no
    tiene.
  - El contenido es idéntico: solo cambian los finales de línea. Lo explica `server/migrations/README.md`.
- **Los archivos copia que ya existen no se tocan:** tienen que coincidir con lo registrado en Supabase, y lo
  registrado no se puede cambiar.
- **Solución propuesta:** un `.gitattributes` en la raíz con `* text=auto eol=lf` y patrones binarios para las
  imágenes (`*.png`, `*.jpg`, `*.webp`, `*.ico binary`).
  - Las migraciones nuevas, con `\n`. Si Supabase guarda otra cosa, el archivo copia lo sigue.
- **Comprobado el 5 oct:** el `.gitattributes` de la raíz ya existe desde la tarea 7 (`cf024c1`), con
  `* text=auto eol=lf`. Por eso A3 no puede guardarse con `\r\n` en el repositorio.
  - Lo que falta es solo añadir los patrones binarios explícitos. Hoy `text=auto` ya los detecta, así que es un
    seguro, no un arreglo.
- **Cuándo:** tarea pequeña, en la próxima sesión técnica.
- **Cerrado sin cambios (decisión del usuario, 5 oct):**
  - el `.gitattributes` ya funciona;
  - los 10 archivos con un salto final de más son ruido irrelevante: el texto es el mismo, y el README explica
    cómo comprobarlos;
  - no se añaden los patrones binarios.

### H52 · MANUAL · CERRADO, NO PRIORITARIO (5 oct 2026) · Recuperar el `CREATE TABLE` de las tablas base

- **Qué falta:** las migraciones iniciales, es decir, la creación de `muebles`, `categorias`, `clientes` y
  `pedidos` (lo que queda de H38).
- **Cómo:** lo hace el usuario a mano, con permisos de lectura de la estructura de la base de datos.
  - Desde el Table Editor de Supabase, el SQL de cada tabla.
  - O con una consulta.
  - La cadena de conexión de la base de datos no se pasa a los agentes: da acceso total. Para lo demás ya está el
    MCP de Supabase.
- **Ojo, comprobado al anotarlo:**
  - **`pg_get_tabledef` no es una función de PostgreSQL estándar.** Existen `pg_get_indexdef`,
    `pg_get_constraintdef`, `pg_get_triggerdef` y `pg_get_viewdef`, pero no hay una para la tabla entera.
    Salvo que el proyecto tenga una extensión que la añada, esa consulta dará error. El Table Editor sí sirve.
  - **Estas tablas no tienen fila en `schema_migrations`:** ya existían antes de la primera migración
    (`20260903091725`), así que no tienen "timestamp real".
    - Para guardarlas en `server/migrations/` con nombre ordenado, haría falta una versión anterior, por
      ejemplo `20260903000000_esquema_base.sql`.
    - Y documentarlas en el README como no registradas: no se pueden comprobar por MD5.
- **No bloquea nada.**
- **Cerrado como no prioritario (decisión del usuario, 5 oct):**
  - las cuatro tablas funcionan, y sus columnas están documentadas en `docs/tarea3-diseno.md` y en los informes;
  - el `CREATE TABLE` exacto no aporta nada nuevo, y no se puede comprobar contra nada;
  - se hará cuando alguien tenga la conexión delante.
- **No van a `server/migrations/`:** no tienen versión en `schema_migrations`, y meterlas llenaría el historial
  de archivos que no se pueden comprobar. El esquema base vive en Supabase.

## Decisiones de diseño a recordar

- **Id del pedido derivado de la sesión de Stripe** (`idPedidoDeSesion`, UUID v5): hace atómica la
  idempotencia (webhook y página de éxito a la vez chocan en la clave primaria) sin depender de un índice.
  El índice único de `pedidos.stripe_session_id` **ya está aplicado en producción**
  (`pedidos_stripe_session_id_key`, parcial: `WHERE stripe_session_id IS NOT NULL`; comprobado el 26 sep, y
  existía desde antes de la tarea 1). Así que se podría volver a un UUID aleatorio, y el manejo del error
  `23505` seguiría valiendo. Mientras no haga falta, se deja el v5: las dos protecciones son compatibles.
- **El webhook responde 500 ante fallos transitorios de base de datos.** Es deliberado: Stripe reintenta
  (hasta tres días en modo real) y el procesado es idempotente, así que un reintento es seguro. Responder 200
  perdería el pedido en silencio. Los casos permanentes (sesión ajena, metadata ilegible, evento no relevante)
  sí devuelven 200 para no provocar reintentos inútiles, y la firma inválida devuelve 400.
- **Los emails se esperan antes de responder** (en Vercel la función se congela al responder), con un tope de
  8 s para que un proveedor lento no retenga al webhook ni al comprador.
