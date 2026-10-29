# Referencia de Variables de Entorno (ENV_VARS.md)

Catálogo completo y unificado de todas las variables de entorno necesarias para ejecutar la plataforma en local, staging y producción.

---

## Tabla de Contenidos (TOC)

1. [Reglas Generales de Seguridad y Manejo](#1-reglas-generales-de-seguridad-y-manejo)
2. [Variables del Frontend (`client/`)](#2-variables-del-frontend-client)
3. [Variables del Backend (`server/`)](#3-variables-del-backend-server)
   - [3.1 Infraestructura Básica y Red](#31-infraestructura-básica-y-red)
   - [3.2 Base de Datos (Supabase)](#32-base-de-datos-supabase)
   - [3.3 Criptografía y Sesiones (JWT / HMAC)](#33-criptografía-y-sesiones-jwt--hmac)
   - [3.4 Pasarela de Pagos (Stripe)](#34-pasarela-de-pagos-stripe)
   - [3.5 Envío de Correos (Resend)](#35-envío-de-correos-resend)
   - [3.6 Módulo de Reservas y Alquiler](#36-módulo-de-reservas-y-alquiler)
   - [3.7 Autenticación con Terceros (Google OAuth)](#37-autenticación-con-terceros-google-oauth)
4. [Plantillas Copy-Paste Rápidas](#4-plantillas-copy-paste-rápidas)
   - [4.1 Plantilla Desarrollo Local (`.env`)](#41-plantilla-desarrollo-local-env)
   - [4.2 Plantilla Producción (Vercel Settings)](#42-plantilla-producción-vercel-settings)

---

## 1. Reglas Generales de Seguridad y Manejo

- **Archivos `.env` en Git**: NUNCA confirmes archivos `.env` o `.env.local` con valores reales en el control de versiones. El `.gitignore` los excluye por defecto.
- **Diferencia entre Frontend y Backend**:
  - Las variables en `client/` empiezan por `VITE_` y son **públicas**: se incrustan en el bundle JavaScript del navegador en tiempo de compilación. **NUNCA** pongas claves privadas (como `STRIPE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`) con prefijo `VITE_`.
  - Las variables en `server/` son privadas y solo son accesibles por el proceso Node.js en el servidor.
- **Rotación Cero Downtime**: Las variables de secretos soportan claves gemelas con sufijo `_PREVIOUS` para rotar sin cerrar la sesión a los usuarios activos.

---

## 2. Variables del Frontend (`client/`)

Todas las variables del cliente se configuran en `client/.env` (o en las variables de entorno de Vercel para el proyecto del frontend).

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `VITE_API_URL` | URL base absoluta de la API REST del backend | `http://localhost:5000/api` (dev) <br> `https://api.tutienda.com/api` (prod) | **SÍ** | dev, test, prod | **No** | Debe incluir el sufijo `/api`. Sin barra final. |
| `VITE_GOOGLE_CLIENT_ID` | Client ID público de Google OAuth para el botón "Continuar con Google" | `123456789-abc.apps.googleusercontent.com` | No (opcional) | dev, test, prod | **No** | Debe coincidir con `GOOGLE_CLIENT_ID` en el servidor. Si se deja en blanco, el botón se oculta o deshabilita. |
| `VITE_GA_MEASUREMENT_ID` | ID de medición de Google Analytics 4 | `G-XXXXXXXXXX` | No (opcional) | prod | **No** | Solo se activa si el usuario acepta las cookies de analítica en el banner de consentimiento. |
| `VITE_RESERVAS_ACTIVAS` | Feature flag para habilitar el módulo de alquiler/reservas por calendario en UI | `true` o `false` | No (default: false) | dev, test, prod | **No** | Variable de compilación. Debe coordinarse con `RESERVAS_ACTIVAS` del servidor. |

---

## 3. Variables del Backend (`server/`)

### 3.1 Infraestructura Básica y Red

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `PORT` | Puerto TCP en el que escucha el servidor Express local | `5000` | No (default: 5000) | dev, test | **No** | En Vercel Serverless este valor lo gestiona la plataforma automáticamente. |
| `NODE_ENV` | Entorno de ejecución de Node.js | `development` o `production` | **SÍ** en prod | dev, test, prod | **No** | En producción activa optimizaciones, cookies estrictas y oculta stack traces. |
| `CLIENT_URL` | URL pública del frontend. Se usa para redirecciones de Stripe y enlaces de email | `http://localhost:5173` (dev) <br> `https://tutienda.com` (prod) | **SÍ** | dev, test, prod | **No** | Vital para CORS y generación de enlaces de verificación de cuenta. |
| `CORS_ORIGENES_ADICIONALES` | Orígenes adicionales autorizados para CORS, separados por comas | `https://preview-1.tutienda.com,https://staging.tutienda.com` | No | test, prod | **No** | Útil para despliegues de preview en ramas de Vercel. Debe ser origen exacto con protocolo. |

### 3.2 Base de Datos (Supabase)

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | URL de la API REST del proyecto Supabase | `https://xyzproject.supabase.co` | **SÍ** | dev, test, prod | **No** | Sin ella el servidor no arranca (falla rápido). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta con privilegios elevados (`service_role`) para Postgres | `eyJhbGciOi...` | **SÍ** | dev, test, prod | 🔒 **SÍ** | **NUNCA exponer en cliente**. El servidor la usa para saltarse RLS en operaciones de gestión interna. |
| `SUPABASE_ANON_KEY` | Clave pública (`anon`) de Supabase | `eyJhbGciOi...` | No (solo seed) | dev | No | Solo requerida si ejecutas scripts de seed locales. |

### 3.3 Criptografía y Sesiones (JWT / HMAC)

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `JWT_SECRET` | Secreto criptográfico de alta entropía para firmar tokens JWT de sesión | `48+ bytes hexadecimal` | **SÍ** | dev, test, prod | 🔒 **SÍ** | Generar con `npm run secrets:generate`. |
| `JWT_SECRET_PREVIOUS` | Clave JWT anterior durante periodos de rotación | `48+ bytes hexadecimal` | No | prod | 🔒 **SÍ** | Permite verificar tokens emitidos antes de rotar sin invalidar sesiones. |
| `REFRESH_TOKEN_HASH_SECRET` | Secreto para derivar HMAC-SHA256 de refresh tokens almacenados en DB | `32+ bytes hexadecimal` | **SÍ** | dev, test, prod | 🔒 **SÍ** | Impide que una lectura indebida de la DB comprometa las sesiones activas. |
| `REFRESH_TOKEN_HASH_SECRET_PREVIOUS` | Secreto anterior de refresh token durante rotación | `32+ bytes hexadecimal` | No | prod | 🔒 **SÍ** | Permite rotación de refresh tokens con periodo de gracia de 24h. |
| `EMAIL_TOKEN_HASH_SECRET` | Secreto para derivar HMAC-SHA256 de tokens de confirmación de email y reset de password | `32+ bytes hexadecimal` | **SÍ** | dev, test, prod | 🔒 **SÍ** | Sin él `/api/auth/verificar-email` responde 503. |
| `EMAIL_TOKEN_HASH_SECRET_PREVIOUS` | Secreto anterior de email token durante rotación | `32+ bytes hexadecimal` | No | prod | 🔒 **SÍ** | Acepta enlaces enviados justo antes de la rotación. |

### 3.4 Pasarela de Pagos (Stripe)

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe API | `sk_test_...` (dev) <br> `sk_live_...` (prod) | **SÍ** | dev, test, prod | 🔒 **SÍ** | Utiliza siempre claves de test en desarrollo y live en producción. |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma del webhook de Stripe | `whsec_...` | **SÍ** | dev, test, prod | 🔒 **SÍ** | Valida que las notificaciones de pago provienen legítimamente de Stripe. |

### 3.5 Envío de Correos (Resend)

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `RESEND_API_KEY` | Clave de API de Resend para email transaccional | `re_...` | **SÍ** en prod | dev, test, prod | 🔒 **SÍ** | Si se deja vacía en local, entra en modo simulación (log sin enviar). |
| `RESEND_FROM` | Cabecera From del correo con nombre y dirección verificada | `Nave 5 <hola@nave5barcelona.com>` | **SÍ** | dev, test, prod | **No** | En desarrollo sin dominio verificado usar: `onboarding@resend.dev`. |
| `ADMIN_EMAIL` | Dirección de correo del administrador donde llegan las alertas de venta | `admin@nave5barcelona.com` | **SÍ** | dev, test, prod | **No** | Recibe resúmenes de pedidos y alertas de stock. |
| `CONTACT_EMAILS` | Lista de destinatarios para mensajes del formulario de contacto | `ventas@nave5.com,taller@nave5.com` | No | dev, test, prod | **No** | Si se omite, los mensajes van a `ADMIN_EMAIL`. |
| `EMAIL_DEBUG_DATOS` | Escribe el contenido de correos en logs de depuración local | `true` o vacía | No | dev | **No** | **NUNCA activar en producción** para cumplir RGPD. |

### 3.6 Módulo de Reservas y Alquiler

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `RESERVAS_ACTIVAS` | Habilita endpoints de reservas y disponibilidad de alquiler | `true` o `false` | No (default: false) | dev, test, prod | **No** | Requiere haber ejecutado las migraciones de reservas (`r1`, `r2`). |
| `CRON_SECRET` | Secreto de la tarea diaria de reservas (`GET /api/cron/reservas`, Vercel Cron). Vercel lo manda solo en la cabecera `Authorization: Bearer ...` | Cadena larga aleatoria (`openssl rand -hex 32`) | Solo con `RESERVAS_ACTIVAS=true` | prod | 🔒 **SÍ** | Sin ella la tarea responde 503 y no hace nada. Con `RESERVAS_ACTIVAS` apagado, 404. |
| `RESERVAS_WEBHOOK_SECRET` | Secreto opcional para webhooks dedicados del flujo de alquiler | `whsec_...` | No | prod | 🔒 **SÍ** | Usado si se segregan endpoints de reservas respecto a ventas estándar. |

### 3.7 Autenticación con Terceros (Google OAuth)

| Variable | Descripción | Ejemplo | Obligatoria | Entornos | Secret? | Notas |
|---|---|---|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google para validar tokens OAuth en backend | `123456789-xyz.apps.googleusercontent.com` | No | dev, test, prod | **No** | Verifica el token de Google enviado por el cliente en `/api/auth/google`. |

---

## 4. Plantillas Copy-Paste Rápidas

### 4.1 Plantilla Desarrollo Local (`.env`)

Guarda este contenido en `server/.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-secreta

# Cripto (generadas con `npm run secrets:generate`)
JWT_SECRET=f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8
REFRESH_TOKEN_HASH_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
EMAIL_TOKEN_HASH_SECRET=fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210

# Stripe (Test)
STRIPE_SECRET_KEY=sk_test_tuClaveTest
STRIPE_WEBHOOK_SECRET=whsec_tuWebhookSecretTest

# Resend
RESEND_API_KEY=
RESEND_FROM=Nave 5 Barcelona <onboarding@resend.dev>
ADMIN_EMAIL=admin@localhost.local

# Features
RESERVAS_ACTIVAS=true
```

Y en `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=
VITE_GA_MEASUREMENT_ID=
VITE_RESERVAS_ACTIVAS=true
```

### 4.2 Plantilla Producción (Vercel Settings)

Valores a introducir en **Vercel > Settings > Environment Variables** (Entorno: Production):

#### Proyecto Backend (`server`):
```text
NODE_ENV=production
CLIENT_URL=https://tutienda.com
SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... (service_role secreta)
JWT_SECRET=xxxx... (64 hex)
REFRESH_TOKEN_HASH_SECRET=xxxx... (64 hex)
EMAIL_TOKEN_HASH_SECRET=xxxx... (64 hex)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM=Tu Marca <hola@tutienda.com>
ADMIN_EMAIL=admin@tutienda.com
RESERVAS_ACTIVAS=true
```

#### Proyecto Frontend (`client`):
```text
VITE_API_URL=https://api.tutienda.com/api
VITE_RESERVAS_ACTIVAS=true
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```
