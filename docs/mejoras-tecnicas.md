# Rama `feature/mejoras-tecnicas`: registro de trabajo

Este documento recoge el estado de las mejoras técnicas de la rama, lo que queda por hacer a mano y los
hallazgos detectados que **todavía no se han corregido**, para que no dependan del historial de una
conversación.

## Estado de las tareas

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Webhook de Stripe, con `confirmar-sesion` como respaldo idempotente y con límite de peticiones | Hecha, con H1 corregido. Falta probarla contra Stripe y Vercel reales (ver más abajo) |
| 2 | Seguridad: CSP, CORS, Zod, `service_role` obligatoria, escape de email | Hecha (ver detalle abajo). `bcrypt`/JWT + refresh quedan para la tarea 3 |
| 3 | Migraciones SQL en `server/migrations/` + JWT con refresh | En curso. Bloque 3a (H8, `muebles.categoria_id` + índice + doble escritura) hecho, en pausa de despliegue antes de A3 (backfill). Bloque 3b (JWT refresh/rotación) no empezado. Diseño completo en `docs/tarea3-diseno.md` |
| 4 | Refactor: `Admin.jsx` por pestañas, ESLint + Prettier en el servidor, `engines` | ESLint + Prettier + `engines.node` del servidor hechos (tarea 8, ver más abajo). Refactor de `Admin.jsx`: diseño aprobado en `docs/tarea4-diseno.md`; en curso los tests de caracterización, que van antes de mover código. Hallazgos previos: H12, H13 y H14 |
| 5 | Tests: servidor, cliente y E2E | Servidor y cliente hechos (ver detalle abajo): 240 tests en el servidor (antes 182) y 118 en el cliente (antes 30). E2E sigue sin empezar (no hay infraestructura todavía) |
| 6 | Frontend: persistencia de carrito y favoritos, filtros, Schema.org, accesibilidad, skeletons | Pendiente (la vista de inventario en tabla del catálogo, con su propia deuda de accesibilidad H10, ya está hecha, fuera de esta tarea) |
| 7 | CI: lint y formato del servidor, `npm audit`, umbral de cobertura | Lint y formato del servidor añadidos al workflow (tarea 8, ver más abajo). `npm audit` en CI y umbral de cobertura, pendientes |
| 8 | Documentación: README raíz y variables de entorno | Hecha: `README.md`, `docs/env-vars.md`, `docs/architecture.md` (ver detalle más abajo) |

## ⏳ Pausa de despliegue en curso (bloque 3a, antes de A3)

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
- **Verificación después de aplicar A3:**
  ```sql
  SELECT count(*) FROM muebles WHERE categoria IS NOT NULL AND categoria_id IS NULL;
  ```
  Debe dar `0`.

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

## Hallazgos abiertos

### H1 · RESUELTO (commit `1e23a5d`) · El límite de 500 caracteres de la metadata de Stripe podía impedir pagar

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

### H2 · RESUELTO (tarea 2) · Plantillas de email antiguas sin escapar HTML

- **Qué se hizo:** `escaparHtml` (ya existía para `enviarAlertaAdmin`, de la tarea 1) se aplicó también en
  `construirHtmlVenta`, `construirHtmlConfirmacionCliente`, `construirHtmlBienvenida` y en la plantilla inline
  de `enviarMensajeContacto`.
- **Verificado:** `emailEscape.test.js`, con un payload `<script>alert(1)</script> & "Cía" <img src=x
  onerror=alert(2)>` en cada campo relevante (nombre, email, teléfono, dirección, notas del comprador; nombre
  de pieza; nombre del cliente en el email de bienvenida; nombre/email/mensaje del formulario de contacto):
  ninguna etiqueta `<script>`/`<img>` sobrevive, el texto queda escapado.

### H3 · RESUELTO en su mayor parte (tarea 2) · `crear-sesion-pago` devolvía el mensaje de error sin filtrar

- **Qué se hizo:** el `catch` de `crearSesionPago` distingue ahora `ErrorValidacion` (400, mensaje tal cual --
  cubre carrito/datos del comprador que no caben en la metadata, y piezas no disponibles, que ahora lanzan
  `ErrorValidacion` en vez de `Error`) de cualquier otro error (500, mensaje genérico, detalle solo en el log).
  Antes, cualquier excepción (incluida una caída real de la API de Stripe) se devolvía como 400 con su
  `.message` sin filtrar.
- **Verificado:** test en `confirmarSesion.test.js` que fuerza un fallo interno de Stripe y comprueba que la
  respuesta es 500 genérica, sin la cadena del error interno en ningún sitio del cuerpo. Mutación: revertir la
  distinción hace fallar ese test.
- **No completamente cerrado:** esto cubre `crearSesionPago`. No se ha auditado sistemáticamente el resto de
  controladores (p. ej. errores de Supabase que se re-lanzan tal cual en algún otro sitio) en busca del mismo
  patrón -- no estaba en el alcance de esta tarea.

### H8 · MEDIA · `data/supabase.js` acepta una `SUPABASE_URL` con `http://` (sin TLS) — la service_role key viajaría en claro

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

### H4 · BAJA · Los límites de peticiones viven en memoria

- **Dónde:** login, contacto y `confirmar-sesion` (`express-rate-limit` con el almacén por defecto).
- **Impacto:** en Vercel cada instancia tiene su propio contador y se pierde en cada arranque en frío: frena
  el abuso casual, no es un tope global. Para un límite estricto haría falta un almacén externo.

### H5 · BAJA · Límite conocido de la detección de doble venta

- Una pieza marcada "vendido" a mano, sin ningún otro pedido de compra, no se detecta como conflicto: es
  indistinguible de un reintento o del webhook y el respaldo procesando a la vez, y avisar produciría falsas
  alertas. Está fijado en `pagos.test.js` ("límite conocido").

### H6 · BAJA · La confirmación va a la dirección que teclea el comprador

- El email de confirmación sale desde el remitente de Nave 5 a un correo que nadie verifica. Requiere un pago
  real por cada envío y, con H2 corregido, el contenido queda escapado.

### H7 · NEGOCIO · Alquilar un día bloquea la pieza

- Pagar el alquiler de un día deja la pieza en `alquilado` hasta que el administrador la reponga a mano. Es
  comportamiento anterior a la rama; conviene decidir si hace falta una fecha de fin.

### H10 · BAJA · `display: contents` en la vista de tabla del catálogo puede perder roles ARIA en algunos lectores de pantalla

- **Dónde:** `client/src/components/ProductsTable.jsx` / `client/src/styles/Catalog.css`
  (`.products-table-info`, `.products-table-footer`). En escritorio se usa `display: contents` para que las
  celdas agrupadas se comporten como columnas directas de la fila -- es lo que permite reflowar la misma fila
  a tarjeta en móvil sin duplicar el JSX en dos estructuras distintas.
- **Impacto:** en algunas versiones de NVDA/JAWS, `display: contents` puede sacar al contenedor (y con él los
  `role="cell"` que agrupa) del árbol de accesibilidad, aunque el texto siga siendo anunciado igual a través
  de sus hijos en la mayoría de los casos. Es un compromiso conocido de este patrón ("tabla con roles ARIA que
  se aplana por CSS"), no un descuido. La navegación por teclado (solo el botón "Ver", con su `aria-label`
  "Ver [nombre]") no depende de esto y funciona igual.
- **Cuándo se revisa:** tarea 6 (accesibilidad a fondo). Alternativa sin este compromiso, si hiciera falta:
  no usar `display: contents` y duplicar el marcado por breakpoint (dos estructuras, una oculta por CSS según
  el ancho) -- más código, sin la dependencia de cómo cada lector de pantalla trate `display: contents`.

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

### H12 · MEDIA · `api.js` tiene tres contratos de error distintos, y el panel ignora el de sus borrados

- **El patrón:** ninguna función de `client/src/services/api.js` lanza el error a quien la llama. Todas lo capturan
  dentro y devuelven un valor. Pero no siempre el mismo:

  | Contrato | Qué devuelve si falla | Funciones |
  |---|---|---|
  | A | `null`. **El mensaje del servidor se pierde** | `createMueble`, `updateMueble`, `deleteMueble`, `createCategoria`, `updateCategoria`, `deleteCategoria`, `actualizarEstadoPedido`, y `getMuebleById` (que devuelve `null` tanto si no existe como si falla) |
  | B | `{ error: mensaje }`, con el mensaje del servidor | `loginUser`, `registerUser`, `loginConGoogle`, `updateProfile`, `checkoutCart`, `crearSesionPago`, `confirmarSesionPago`, `enviarContacto` |
  | C | `[]`: **un error no se distingue de "no hay datos"** | `getMuebles`, `getCategorias`, `buscarMuebles`, `getMisPedidos`, `getPedidos` |

- **Sitios afectados** (grep de todas las llamadas a funciones de escritura en `client/src/`, sin contar tests ni
  el propio `api.js`: 19 llamadas, 10 de ellas en `Admin.jsx`). **4 no comprueban el resultado, y las 4 están en
  `Admin.jsx`:**

  | Llamada | ¿Comprueba el resultado? | Efecto |
  |---|---|---|
  | `Admin.jsx:157` `deleteMueble` (borrar uno) | No | "Mueble eliminado con éxito" aunque falle |
  | `Admin.jsx:363` `deleteMueble` en lote (`Promise.all`) | No | "N productos eliminados" aunque fallen todos o algunos |
  | `Admin.jsx:196` `deleteCategoria` | No | "Categoría eliminada" aunque falle |
  | `Admin.jsx:373` `updateMueble` en lote (`Promise.all`) | No | "Estado actualizado en N productos" aunque falle |
  | `Admin.jsx:121, 176, 234, 272, 299, 635` | Sí (`if (res)`) | Correcto |
  | `AuthModal.jsx:36, 46` · `Login.jsx:27, 85, 94` · `Profile.jsx:75` · `Contact.jsx:35` · `CheckoutModal.jsx:131` · `CheckoutExito.jsx:24` | Sí (contrato B) | Correcto |

  `checkoutCart` no tiene ninguna llamada: es el checkout antiguo, anterior a Stripe (código muerto).
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

### H14 · BAJA · UX · Un solo `status` para todos los formularios del panel

- **Hoy:** `Admin` tiene un único estado `status` para el mensaje de progreso o error. Lo escriben cuatro
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

## Decisiones de diseño a recordar

- **Id del pedido derivado de la sesión de Stripe** (`idPedidoDeSesion`, UUID v5): hace atómica la
  idempotencia (webhook y página de éxito a la vez chocan en la clave primaria) sin depender de un índice.
  Se puede revertir a un UUID aleatorio cuando el índice único de `pedidos.stripe_session_id` esté aplicado en
  producción; el manejo del error `23505` sigue valiendo.
- **El webhook responde 500 ante fallos transitorios de base de datos.** Es deliberado: Stripe reintenta
  (hasta tres días en modo real) y el procesado es idempotente, así que un reintento es seguro. Responder 200
  perdería el pedido en silencio. Los casos permanentes (sesión ajena, metadata ilegible, evento no relevante)
  sí devuelven 200 para no provocar reintentos inútiles, y la firma inválida devuelve 400.
- **Los emails se esperan antes de responder** (en Vercel la función se congela al responder), con un tope de
  8 s para que un proveedor lento no retenga al webhook ni al comprador.
