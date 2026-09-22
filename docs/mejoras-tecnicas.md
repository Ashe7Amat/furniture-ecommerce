# Rama `feature/mejoras-tecnicas`: registro de trabajo

Este documento recoge el estado de las mejoras técnicas de la rama, lo que queda por hacer a mano y los
hallazgos detectados que **todavía no se han corregido**, para que no dependan del historial de una
conversación.

## Estado de las tareas

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Webhook de Stripe, con `confirmar-sesion` como respaldo idempotente y con límite de peticiones | Hecha, con H1 corregido. Falta probarla contra Stripe y Vercel reales (ver más abajo) |
| 2 | Seguridad: CSP, CORS, bcrypt, JWT + refresh, Zod, HSTS, `service_role` obligatoria | Pendiente |
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
- **Nota de honestidad sobre la cobertura:** el controlador distingue `ErrorMetadata` (400 con mensaje claro)
  de cualquier otro error, pero como el `catch` exterior de `crearSesionPago` ya devuelve 400 con
  `error.message` para cualquier excepción (ver H3), esa distinción todavía no cambia nada observable por los
  tests; empezará a importar cuando H3 separe errores de negocio de errores internos.

### H2 · MEDIA · Plantillas de email antiguas sin escapar HTML

- **Dónde:** `server/src/utils/email.js`: `construirHtmlVenta`, `construirHtmlConfirmacionCliente` y
  `enviarMensajeContacto` insertan nombre, dirección, notas, email y mensaje tal cual llegan del comprador o
  del visitante.
- **Impacto:** se puede inyectar HTML o enlaces en los correos que recibe el administrador (y en el de
  confirmación que recibe el comprador).
- **Propuesta:** usar `escaparHtml` (ya existe en el mismo archivo, la usa `enviarAlertaAdmin`) en todas las
  plantillas y añadir tests con `<script>` y comillas. Tarea 2.

### H3 · MEDIA · `crear-sesion-pago` devuelve el mensaje de error sin filtrar

- **Dónde:** `catch` de `crearSesionPago` (`res.status(400).json({ error: error.message ... })`).
- **Impacto:** el cliente recibe mensajes internos de Stripe o de JavaScript, en inglés y con detalles que no
  deberían salir.
- **Propuesta:** distinguir errores de negocio (pieza no disponible, con mensaje en castellano) de los
  inesperados (mensaje genérico y detalle solo en el log). Tarea 2.

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
