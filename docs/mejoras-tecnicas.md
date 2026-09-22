# Rama `feature/mejoras-tecnicas`: registro de trabajo

Este documento recoge el estado de las mejoras técnicas de la rama, lo que queda por hacer a mano y los
hallazgos detectados que **todavía no se han corregido**, para que no dependan del historial de una
conversación.

## Estado de las tareas

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Webhook de Stripe, con `confirmar-sesion` como respaldo idempotente y con límite de peticiones | Hecha, con H1 corregido. Falta probarla contra Stripe y Vercel reales (ver más abajo) |
| 2 | Seguridad: CSP, CORS, Zod, `service_role` obligatoria, escape de email | Hecha (ver detalle abajo). `bcrypt`/JWT + refresh quedan para la tarea 3 |
| 3 | Migraciones SQL en `server/migrations/` | Pendiente. Solo se crean los archivos; no se aplican a la BD real sin permiso |
| 4 | Refactor: `Admin.jsx` por pestañas, ESLint + Prettier en el servidor, `engines` | Pendiente |
| 5 | Tests: servidor, cliente y E2E | Pendiente (la tarea 1 ya deja más de 90 tests en el servidor) |
| 6 | Frontend: persistencia de carrito y favoritos, filtros, Schema.org, accesibilidad, skeletons | Pendiente |
| 7 | CI: lint y formato del servidor, `npm audit`, umbral de cobertura | Pendiente |
| 8 | Documentación: README raíz y variables de entorno | Pendiente |

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
