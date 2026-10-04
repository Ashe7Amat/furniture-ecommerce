# Variables de entorno

Detalle completo de cada variable. La tabla resumen (obligatoria/no, en qué lado vive) está en el
[README](../README.md). Las plantillas reales, con estos mismos comentarios, viven en
`server/.env.example` y `client/.env.example` -- este documento las consolida en un solo sitio,
no las sustituye: si un comentario diverge de la plantilla, la plantilla es la fuente de verdad
(es la que de verdad lee `dotenv`).

## Servidor (`server/.env`)

### `PORT`
- **Qué hace:** puerto en el que escucha el servidor Express en local.
- **Formato:** un número de puerto libre.
- **Dónde se obtiene:** lo eliges tú. En Vercel no aplica (la plataforma asigna el puerto).
- **Obligatoria:** no -- por defecto `5000`.
- **Ejemplo:** `PORT=5000`

### `SUPABASE_URL`
- **Qué hace:** URL del proyecto de Supabase. El servidor la usa para conectarse a la base de
  datos con `@supabase/supabase-js`.
- **Formato:** `https://<id-del-proyecto>.supabase.co`. En producción (`NODE_ENV=production`)
  debe empezar por `https://` -- con `http://` el servidor no arranca (H8, ver
  `docs/mejoras-tecnicas.md`): la clave `service_role` viajaría sin cifrar.
- **Dónde se obtiene:** panel de Supabase, Project Settings > API > Project URL.
- **Obligatoria:** **sí** -- sin ella el servidor falla al arrancar, con un mensaje que lo dice.
- **Ejemplo (enmascarado):** `SUPABASE_URL=https://ejemplo1234567.supabase.co`

### `SUPABASE_SERVICE_ROLE_KEY`
- **Qué hace:** clave con la que el servidor se conecta a Supabase. Se salta todas las políticas
  de Row Level Security (están pensadas para frenar a quien llame directamente desde el
  navegador con la clave pública) porque el propio servidor ya comprueba los permisos de admin
  antes de tocar la base de datos.
- **Formato:** un JWT largo, empieza por `eyJ...`.
- **Dónde se obtiene:** panel de Supabase, Project Settings > API Keys > `service_role`.
- **Obligatoria:** **sí** -- sin ella el servidor falla al arrancar. Ya no hay respaldo a la
  clave `anon` (dejaba al servidor sujeto, en silencio, a las políticas de RLS pensadas para el
  navegador).
- **Nunca** se expone en el cliente/navegador -- solo va en el servidor.
- **Ejemplo (enmascarado):** `SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...(truncado)...`

### `SUPABASE_ANON_KEY`
- **Qué hace:** clave pública de Supabase. El servidor ya no la usa para nada operativo -- solo
  la lee `server/src/seed.js`, el script para poblar una base de datos de ejemplo.
- **Formato:** un JWT, empieza por `eyJ...` (o, en proyectos nuevos de Supabase, una clave con
  prefijo `sb_publishable_...`).
- **Dónde se obtiene:** panel de Supabase, Project Settings > API Keys > `anon` / `public`.
- **Obligatoria:** no.
- **Ejemplo (enmascarado):** `SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx`

### `JWT_SECRET`
- **Qué hace:** secreto con el que se firman los JWT de sesión (login normal y con Google, y el
  middleware `verificarToken`/`verificarAdmin`).
- **Formato:** una cadena aleatoria larga.
- **Dónde se obtiene:** se genera, no se pide a ningún proveedor:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- **Obligatoria:** en la práctica sí -- sin ella, o con un valor de relleno compartido entre
  entornos, cualquiera podría forjar un JWT válido. Cambiarla invalida de golpe todos los access
  tokens ya firmados (es la mitigación de emergencia si se sospecha una fuga de esta clave). Desde
  la tarea 3b eso **no cierra las sesiones**: el cliente pide un access token nuevo con su refresh
  token. Para echar a todo el mundo hay que cambiar también `REFRESH_TOKEN_HASH_SECRET`.
- **Ejemplo (enmascarado):** `JWT_SECRET=3f9a...(96 caracteres hex)...c21b`

### `REFRESH_TOKEN_HASH_SECRET`
- **Qué hace:** secreto, distinto de `JWT_SECRET`, con el que se calcula el HMAC-SHA256 de cada
  refresh token antes de guardarlo en la tabla `refresh_tokens` (`server/src/utils/refreshTokens.js`,
  tarea 3b). En la tabla solo está ese HMAC, nunca el token.
- **Formato:** una cadena aleatoria. Se genera con `openssl rand -hex 32`.
- **Obligatoria:** sí, para que las sesiones sobrevivan a una recarga y duren más de una hora. Sin
  ella el servidor arranca igual, pero:
  - el inicio de sesión funciona sin refresh token: la sesión dura como mucho lo que el access token
    (1 hora), y se pierde al recargar la página o abrir otra pestaña, porque ese token solo vive en
    la memoria de la pestaña;
  - `/api/auth/refresh` y `/api/auth/logout` responden 503;
  - queda un error en el log.
- **Cambiarla** invalida de golpe todos los refresh tokens emitidos: ya no coinciden con su HMAC
  guardado, y todo el mundo tiene que volver a iniciar sesión. Es la mitigación de emergencia si se
  sospecha que se ha filtrado.
- **En producción**, se pone en las variables de entorno de `nave5-api` en Vercel **antes** de
  desplegar el bloque 3b.
- **Paso a paso** (generarla, dónde ponerla y cómo comprobar las sesiones): `docs/verificacion-3b.md`.
- **Ejemplo (enmascarado):** `REFRESH_TOKEN_HASH_SECRET=8b1e...(64 caracteres hex)...f07a`

### `CLIENT_URL`
- **Qué hace:** URL pública del frontend. Stripe Checkout redirige aquí (`/checkout/exito`,
  `/checkout/cancelado`) al terminar el pago, y forma parte de la lista de orígenes permitidos
  por CORS.
- **Formato:** una URL completa, sin barra final.
- **Dónde se obtiene:** en local, `http://localhost:5173` (el puerto por defecto de Vite). En
  producción, la URL real del frontend desplegado.
- **Obligatoria:** recomendada -- sin ella, el checkout no sabría a dónde volver.
- **Ejemplo:** `CLIENT_URL=http://localhost:5173`

### `ALLOWED_ORIGINS`
- **Qué hace:** orígenes adicionales permitidos por CORS, además de `CLIENT_URL` y de
  `localhost:5173`/`5174` (desarrollo). Útil para un despliegue de vista previa de Vercel de una
  rama concreta.
- **Formato:** lista separada por comas, orígenes **exactos** (con protocolo, sin barra final).
  Nunca un comodín tipo `https://*.vercel.app` -- cualquiera puede desplegar un proyecto propio
  en Vercel con ese mismo dominio.
- **Obligatoria:** no.
- **Ejemplo:** `ALLOWED_ORIGINS=https://nave5-preview-mi-rama.vercel.app,https://otro-dominio.com`

### `STRIPE_SECRET_KEY`
- **Qué hace:** clave con la que el servidor llama a la API de Stripe para crear sesiones de
  pago y (en `test:stripe`) verificar límites reales de la API.
- **Formato:** empieza por `sk_test_...` (modo test) o `sk_live_...` (modo real).
- **Dónde se obtiene:** Dashboard de Stripe > Desarrolladores > Claves de API.
- **Obligatoria:** solo si se quieren procesar pagos reales (de prueba o en vivo) -- sin ella, el
  servidor responde 503 en el endpoint de crear sesión de pago, en vez de fallar al arrancar.
- **Ejemplo (enmascarado):** `STRIPE_SECRET_KEY=sk_test_51Xxxx...(truncada)`

### `STRIPE_WEBHOOK_SECRET`
- **Qué hace:** verifica que los eventos que llegan a `POST /api/stripe/webhook` de verdad los
  envió Stripe (comprueba la firma del cuerpo crudo de la petición).
- **Formato:** empieza por `whsec_...`.
- **Dónde se obtiene:**
  - Producción/preview: Dashboard de Stripe > Desarrolladores > Webhooks > Añadir endpoint, con
    la URL final (`https://<api>/api/stripe/webhook`, sin redirecciones) y el evento
    `checkout.session.completed`.
  - Local: `stripe listen --forward-to localhost:5000/api/stripe/webhook` lo imprime.
- **Obligatoria:** no -- sin ella, el webhook responde 503 y el respaldo `confirmar-sesion`
  (cuando el comprador vuelve a la página de éxito) sigue registrando la venta igual.
- **Importante:** se deja vacía a propósito en la plantilla -- un valor de relleno cuenta como
  "configurado" y el webhook rechazaría todos los eventos reales sin que se notara.
- **Ejemplo (enmascarado):** `STRIPE_WEBHOOK_SECRET=whsec_Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### `RESEND_API_KEY`
- **Qué hace:** clave para enviar emails (bienvenida, aviso de venta al admin, confirmación al
  comprador) a través de Resend.
- **Formato:** empieza por `re_...`.
- **Dónde se obtiene:** cuenta en resend.com, Dashboard > API Keys.
- **Obligatoria:** no -- si se deja en blanco, el envío se simula en vez de fallar: en el log queda
  solo `[email simulado omitido: falta RESEND_API_KEY, contenido con datos personales]` y de qué
  correo se trata, sin ningún dato del cliente (H27). En producción tiene que estar puesta: sin
  ella, los clientes no reciben ningún correo.
- **Ejemplo (enmascarado):** `RESEND_API_KEY=re_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxx`

### `EMAIL_DEBUG_DATOS`
- **Qué hace:** solo para depurar en local. Con `true`, el modo simulación (sin `RESEND_API_KEY`)
  vuelve a escribir en el log el contenido de cada correo: destinatario, pedido, mensaje de
  contacto...
- **Formato:** `true` o nada. Cualquier otro valor cuenta como no puesta.
- **Obligatoria:** no, y **no se pone nunca en producción**. Con `NODE_ENV=production` no tiene
  ningún efecto, a propósito: los datos personales no deben acabar en los logs de Vercel (H27).
- **Ejemplo:** `EMAIL_DEBUG_DATOS=true` (en `server/.env`, en local)

### `RESEND_FROM`
- **Qué hace:** dirección remitente de los emails.
- **Formato:** `"Nombre visible <direccion@dominio>"`.
- **Dónde se obtiene:** con el plan gratuito de Resend, sin un dominio propio verificado, solo se
  puede usar el dominio sandbox `onboarding@resend.dev` -- y ese dominio solo entrega a la
  dirección con la que se verificó la cuenta de Resend. Si se verifica un dominio propio
  (Dashboard > Domains), se cambia por una dirección real.
- **Obligatoria:** no -- tiene un valor por defecto de pruebas.
- **Ejemplo:** `RESEND_FROM=Nave 5 Barcelona <onboarding@resend.dev>`

### `ADMIN_EMAIL`
- **Qué hace:** dirección donde llegan los avisos de nueva venta y las alertas operativas (un
  pago cobrado que no se pudo registrar, una doble venta...). También recibe los mensajes del
  formulario de contacto cuando `CONTACT_EMAILS` no está puesta.
- **Formato:** una dirección de email.
- **Obligatoria:** no.
- **Ejemplo:** `ADMIN_EMAIL=admin@nave5barcelona.com`

### `CONTACT_EMAILS`
- **Qué hace:** quién recibe los mensajes del formulario de contacto. Sirve para que lleguen a
  varias personas sin tocar `ADMIN_EMAIL`, que sigue siendo solo para avisos de venta y alertas.
- **Formato:** una o varias direcciones separadas por comas. Los espacios y las comas de sobra
  se ignoran.
- **Obligatoria:** no -- vacía o sin poner, los mensajes van a `ADMIN_EMAIL`, como antes.
- **Importante:** con el remitente sandbox de Resend (`onboarding@resend.dev`, ver `RESEND_FROM`),
  Resend solo entrega a la dirección con la que se verificó la cuenta de Resend. Las demás
  direcciones de la lista no recibirán nada hasta que se verifique un dominio propio en Resend y
  se cambie `RESEND_FROM`.
- **Ejemplo:** `CONTACT_EMAILS=tienda@example.com,otra-persona@example.com`

### `GOOGLE_CLIENT_ID`
- **Qué hace:** valida en el servidor el token que devuelve el botón "Continuar con Google" del
  frontend.
- **Formato:** termina en `.apps.googleusercontent.com`.
- **Dónde se obtiene:** Google Cloud Console > APIs & Services > Credentials > OAuth Client ID.
  **Debe ser el mismo valor** que `VITE_GOOGLE_CLIENT_ID` en el cliente -- son las dos mitades de
  la misma credencial OAuth.
- **Obligatoria:** no -- si se deja en blanco, el botón de Google queda desactivado en vez de
  fallar.
- **Ejemplo (enmascarado):** `GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

### `MOSTRAR_PRECIOS`
- **Qué hace:** decide si el catálogo público enseña los precios y deja comprar (fase C; ver
  `server/src/utils/precios.js`).
  - `true`: todo como siempre.
  - Cualquier otro valor, o sin poner: `GET /api/muebles`, `/api/muebles/buscar` y
    `/api/muebles/:id` devuelven `precio_venta` y `precio_alquiler_dia` a `null`; la web enseña
    "Consultar precio" y el botón "Preguntar por esta pieza" (lleva a contacto) en vez de añadir a
    la cesta; y `POST /api/muebles/crear-sesion-pago` responde 403, así que no se puede pagar.
  - El panel (`GET /api/admin/muebles`) ve siempre los precios reales, y se pueden editar. La base
    de datos no se toca: es solo lo que sale en las respuestas.
- **Formato:** `true` exacto, en minúsculas. `TRUE`, `1` o `si` cuentan como "no".
- **Obligatoria:** no. **Por defecto, sin poner, los precios están ocultos.** Si se despliega este
  código sin la variable, la web deja de enseñar precios y de vender; para seguir como antes hay
  que ponerla a `true`.
- **Al cambiarla:** en Vercel hay que redesplegar. Además, la CDN guarda el catálogo hasta unos
  minutos (`s-maxage=120` más `stale-while-revalidate=300`), así que el cambio puede tardar en verse.
- **Ejemplo:** `MOSTRAR_PRECIOS=false` (catálogo sin precios ni compra) o `MOSTRAR_PRECIOS=true`

## Cliente (`client/.env`)

### `VITE_API_URL`
- **Qué hace:** URL base de la API del servidor a la que llama `client/src/services/api.js`.
- **Formato:** una URL completa terminada en `/api`, sin barra final adicional.
- **Obligatoria:** no -- por defecto `http://localhost:5000/api`.
- **Ejemplo:** `VITE_API_URL=http://localhost:5000/api`

### `VITE_GOOGLE_CLIENT_ID`
- **Qué hace:** Client ID que usa el botón de Google en el navegador.
- **Formato:** igual que `GOOGLE_CLIENT_ID` del servidor -- **debe ser el mismo valor**.
- **Obligatoria:** no -- sin ella, se muestra un botón desactivado en vez del login real.
- **Ejemplo (enmascarado):** `VITE_GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

### `VITE_GA_MEASUREMENT_ID`
- **Qué hace:** Measurement ID de Google Analytics 4. Solo se carga después de que el visitante
  acepta las cookies de analítica en el banner de consentimiento.
- **Formato:** `G-XXXXXXXXXX`.
- **Dónde se obtiene:** panel de GA4, Admin > Flujos de datos > Web.
- **Obligatoria:** no -- si se deja en blanco, no se carga GA4.
- **Ejemplo:** `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`

## Variables que pone la plataforma (no se rellenan)

El servidor lee dos variables que no están en la plantilla porque las define Vercel. Se documentan
aquí porque cambian cómo se comporta:

### `NODE_ENV`
- **Quién la pone:** Vercel, con el valor `production`. En local no hace falta.
- **Qué cambia en producción:**
  - el servidor exige que `SUPABASE_URL` empiece por `https://` (H8), y si no, no arranca;
  - redirige a HTTPS las peticiones que lleguen por HTTP (según `x-forwarded-proto`);
  - no escribe en el log la URL de Supabase en cada arranque.

### `VERCEL`
- **Quién la pone:** Vercel, con el valor `1`.
- **Qué cambia:** activa `trust proxy`, para que Express lea la IP real del visitante en
  `X-Forwarded-For`. Sin esto, los límites de peticiones (login, contacto, confirmación de pago)
  meterían a todo el mundo en el mismo contador.
- **No se pone en local:** sin el proxy de Vercel delante, cualquiera podría falsear su IP con esa
  cabecera.

## Nota, no una variable a rellenar: `client/.env` real tiene dos claves sin plantilla

*(Observación de esta misma tarea, no una acción -- se documenta, no se decide por cuenta
propia.)* El `client/.env` real de este entorno tiene `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`, que **no están en `client/.env.example`** ni se leen desde ningún sitio
de `client/src` (comprobado con una búsqueda en todo el árbol: cero resultados). Parecen resto de
un diseño anterior en el que el cliente hablaba con Supabase directamente; hoy toda la
comunicación pasa por la API propia (`VITE_API_URL`). No se han tocado ni el `.env` real ni su
plantilla -- si se confirma que están muertas, se pueden borrar del `.env` local sin que nada se
rompa.
