# Variables de entorno (ENV_VARS.md)

Todas las variables que lee el código, sacadas de `process.env` (API) e `import.meta.env` (web) el 30 oct
2026. Las plantillas son `server/.env.example` y `client/.env.example`. El detalle de cada una (historia,
por qué existe, qué pasa si falta) está en [env-vars.md](env-vars.md).

Lo que es de la **marca** (nombre, web, dirección, colores, logo de los correos) no va en variables: está en
`client/src/theme/brand.config.js` y `server/src/config/brand.config.js` (ver [NUEVO_CLIENTE.md](NUEVO_CLIENTE.md)).
Las variables son para secretos y para lo que cambia según el entorno.

Columna **¿Obligatoria?**: *Sí* = sin ella la API no arranca o la función principal falla; *Prod* = hace
falta en producción, en local se puede dejar vacía; *No* = opcional.

## API (`server/`, proyecto de Vercel de la API)

| Variable | ¿Obligatoria? | Para qué sirve | Ejemplo |
|---|---|---|---|
| `SUPABASE_URL` | Sí | URL del proyecto de Supabase | `https://abcd1234.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave con la que la API lee y escribe (se salta RLS). Nunca en la web | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | No | Solo la usa `src/seed.js` (datos de ejemplo en local) | `eyJhbGciOi...` |
| `JWT_SECRET` | Sí | Firma los access tokens (1 hora) | 64 caracteres aleatorios (`npm run secrets:generate`) |
| `REFRESH_TOKEN_HASH_SECRET` | Sí | HMAC de los refresh tokens guardados (7 días, con rotación) | otro valor aleatorio |
| `EMAIL_TOKEN_HASH_SECRET` | Sí | HMAC de los enlaces de verificación de email y de cambio de contraseña | otro valor aleatorio |
| `JWT_SECRET_PREVIOUS` | No | El `JWT_SECRET` anterior durante un cambio de secreto: los tokens firmados con él siguen valiendo | el valor viejo |
| `REFRESH_TOKEN_HASH_SECRET_PREVIOUS` | No | Lo mismo para `REFRESH_TOKEN_HASH_SECRET` | el valor viejo |
| `EMAIL_TOKEN_HASH_SECRET_PREVIOUS` | No | Lo mismo para `EMAIL_TOKEN_HASH_SECRET` | el valor viejo |
| `JWT_SECRET_FALLBACK`, `REFRESH_TOKEN_HASH_FALLBACK`, `EMAIL_TOKEN_HASH_FALLBACK` | No | Nombres antiguos de las tres de arriba; se leen si las `*_PREVIOUS` no están | — |
| `CLIENT_URL` | Sí | Origen de la web: CORS, vuelta de Stripe y enlaces de los correos | `https://www.tu-dominio.com` |
| `ALLOWED_ORIGINS` | No | Más orígenes exactos para CORS, separados por comas (p. ej. una preview de Vercel) | `https://tienda-git-rama.vercel.app` |
| `STRIPE_SECRET_KEY` | Prod | Crear sesiones de pago y reembolsos | `sk_test_...` / `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Prod | Comprobar la firma del webhook `/api/stripe/webhook` (sin ella responde 503) | `whsec_...` |
| `RESEND_API_KEY` | Prod | Enviar correos. Sin ella no se envía nada y solo queda una línea en el log | `re_...` |
| `RESEND_FROM` | Prod | Remitente. Por defecto, el de `brand.config.js` (`onboarding@resend.dev`, solo para pruebas) | `Tu Marca <hola@tu-dominio.com>` |
| `ADMIN_EMAIL` | Prod | Recibe los avisos de ventas y reservas. Por defecto, el de `brand.config.js` | `avisos@tu-dominio.com` |
| `CONTACT_EMAILS` | No | Quién recibe el formulario de contacto, separados por comas. Si falta, `ADMIN_EMAIL` | `hola@tu-dominio.com,tienda@tu-dominio.com` |
| `EMAIL_DEBUG_DATOS` | No | `true` escribe en el log el contenido de los correos simulados (nunca con `NODE_ENV=production`) | `true` |
| `GOOGLE_CLIENT_ID` | No | Inicio de sesión con Google (el mismo que `VITE_GOOGLE_CLIENT_ID`) | `1234-abc.apps.googleusercontent.com` |
| `MOSTRAR_PRECIOS` | No | `true` enseña los precios y deja comprar. Apagada (Nave 5 hoy), solo se pregunta por las piezas | `false` |
| `RESERVAS_ACTIVAS` | No | `true` enciende las reservas por fechas (endpoints, cron, correos). Va con `VITE_RESERVAS_ACTIVAS` | `false` |
| `FIANZA_PORCENTAJE` | No | Fianza de los alquileres en % del alquiler, entero de 0 a 100. Si falta o no es válido, 30 | `30` |
| `CRON_SECRET` | Con reservas | Vercel la manda al cron diario `/api/cron/reservas`; sin ella el cron responde 503 | valor aleatorio |
| `PORT` | No | Puerto en local (`npm run dev`) | `5000` |
| `NODE_ENV` | La pone la plataforma | `production` en Vercel | — |
| `VERCEL` | La pone la plataforma | Vercel la pone a `1`: la API se fía de la IP que da su proxy (límites de peticiones por IP) | — |

## Web (`client/`, proyecto de Vercel de la web)

Son de compilación: Vite las mete en el JavaScript al hacer `npm run build`, así que todo lo que se pone aquí
es público, y tras cambiarlas hay que volver a desplegar.

| Variable | ¿Obligatoria? | Para qué sirve | Ejemplo |
|---|---|---|---|
| `VITE_API_URL` | Sí | Dirección de la API, con `/api` al final | `https://api.tu-dominio.com/api` |
| `VITE_GOOGLE_CLIENT_ID` | No | Botón de Google en el acceso. Sin ella no sale | `1234-abc.apps.googleusercontent.com` |
| `VITE_GA_MEASUREMENT_ID` | No | Google Analytics 4, solo si el visitante acepta las cookies de medición | `G-XXXXXXXXXX` |
| `VITE_RESERVAS_ACTIVAS` | No | `true` enseña el calendario de reserva en las fichas y "Mis reservas" | `false` |
| `VITE_WEBP_OPTIMIZADAS` | No | `true` sirve las fotos de las piezas como WebP en varios tamaños (tras `npm run images:optimize` en `server/`) | `false` |

## Para encender las reservas

Las dos a la vez, en sus proyectos: `RESERVAS_ACTIVAS=true` (API) y `VITE_RESERVAS_ACTIVAS=true` (web),
más `CRON_SECRET` en la API y el evento `checkout.session.expired` en el webhook de Stripe.
