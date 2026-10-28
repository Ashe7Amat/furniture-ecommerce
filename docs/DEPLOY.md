# Guía de Despliegue de Producción (DEPLOY.md)

Guía paso a paso y exhaustiva para poner en producción una instancia completa de la plataforma (Frontend React en Vercel + Backend Express/Node en Vercel + Base de Datos Supabase Postgres + Pasarela Stripe + Emails con Resend).

---

## Tabla de Contenidos (TOC)

1. [Requisitos Previos](#1-requisitos-previos)
2. [Paso 1: Setup de Supabase (Base de Datos & Auth)](#2-paso-1-setup-de-supabase-base-de-datos--auth)
   - [2.1 Creación del Proyecto](#21-creación-del-proyecto)
   - [2.2 Ejecución de Migraciones en Orden](#22-ejecución-de-migraciones-en-orden)
   - [2.3 Row Level Security (RLS) y Claves API](#23-row-level-security-rls-y-claves-api)
   - [2.4 Storage Bucket para Imágenes](#24-storage-bucket-para-imágenes)
3. [Paso 2: Generación de Secretos Criptográficos](#3-paso-2-generación-de-secretos-criptográficos)
4. [Paso 3: Configuración de Stripe (Test y Live)](#4-paso-3-configuración-de-stripe-test-y-live)
   - [4.1 Claves API y Modo Live](#41-claves-api-y-modo-live)
   - [4.2 Webhook Endpoint y Eventos](#42-webhook-endpoint-y-eventos)
   - [4.3 Rotación de Claves de Stripe](#43-rotación-de-claves-de-stripe)
5. [Paso 4: Configuración de Resend (Emails Transaccionales)](#5-paso-4-configuración-de-resend-emails-transaccionales)
   - [5.1 API Key](#51-api-key)
   - [5.2 Verificación de Dominio Propio (DNS: SPF, DKIM, DMARC)](#52-verificación-de-dominio-propio-dns-spf-dkim-dmarc)
6. [Paso 5: Configuración de Variables de Entorno](#6-paso-5-configuración-de-variables-de-entorno)
7. [Paso 6: Despliegue en Vercel (Backend y Frontend)](#7-paso-6-despliegue-en-vercel-backend-y-frontend)
   - [7.1 Despliegue del Backend (`server/`)](#71-despliegue-del-backend-server)
   - [7.2 Despliegue del Frontend (`client/`)](#72-despliegue-del-frontend-client)
   - [7.3 Asignación de Dominios Personalizados](#73-asignación-de-dominios-personalizados)
8. [Paso 7: Verificación Post-Deploy (Smoke Tests)](#8-paso-7-verificación-post-deploy-smoke-tests)
   - [8.1 Endpoint /api/health](#81-endpoint-apihealth)
   - [8.2 Sitemap y Robots](#82-sitemap-y-robots)
   - [8.3 Catálogo, Calendario de Alquiler y Checkout](#83-catálogo-calendario-de-alquiler-y-checkout)
   - [8.4 Panel de Administración](#84-panel-de-administración)
9. [Paso 8: Procedimientos de Rollback y Contingencia](#9-paso-8-procedimientos-de-rollback-y-contingencia)

---

## 1. Requisitos Previos

Antes de comenzar el despliegue, asegúrate de disponer de:
- **Node.js**: Versión `>= 20.x` (o `>= 22.x` recomendada, verificada en CI).
- **Git CLI**: Instalado y autenticado en tu terminal.
- **Cuenta en Vercel**: Para hosting serverless de API y SPA.
- **Cuenta en Supabase**: Para base de datos PostgreSQL y Storage.
- **Cuenta en Stripe**: Con negocio activado para pagos reales (o en modo test para pruebas).
- **Cuenta en Resend**: Con acceso para configurar registros DNS de tu dominio.
- **Dominio propio con acceso a DNS**: (ej. Cloudflare, Namecheap, Google Domains) para frontend, subdominio API y registros de correo.

---

## 2. Paso 1: Setup de Supabase (Base de Datos & Auth)

### 2.1 Creación del Proyecto
1. Inicia sesión en [Supabase Dashboard](https://supabase.com/dashboard) y crea una nueva organización y proyecto.
2. Selecciona la región geográfica más cercana a tus clientes (ej. `eu-west-3` París o `eu-central-1` Fráncfort para España/Europa).
3. Establece una contraseña segura para el usuario `postgres` y anótala en un gestor de contraseñas.

### 2.2 Ejecución de Migraciones en Orden
El backend contiene todas las migraciones SQL estructuradas y versionadas en `server/migrations/`.

Puedes aplicarlas usando el **SQL Editor de Supabase** o la **Supabase CLI**.
Si usas el SQL Editor, aplica los scripts respetando el prefijo cronológico `YYYYMMDDHHMMSS`:

```bash
# Ejemplo usando Supabase CLI (recomendado):
supabase link --project-ref tu-id-proyecto
supabase db push
```

Si ejecutas manualmente en el SQL Editor de Supabase, el orden maestro es:
1. `20260903091725_enable_rls_public_read_only.sql`
2. `20260903121124_sync_disponible_from_estado_trigger.sql`
3. `20260903121150_fix_search_path_sync_disponible_trigger.sql`
4. `20260904124456_add_categoria_padre_id.sql`
5. `20260904152538_pedidos_soporte_checkout_multiproducto.sql`
6. `20260905131103_cleanup_pedidos_phantom_columns_and_indexes.sql`
7. `20260905131118_move_http_extension_out_of_public.sql`
8. `20260922115443_add_muebles_categoria_id.sql`
9. `20260922115825_index_muebles_categoria_id.sql`
10. `20260924133146_backfill_muebles_categoria_id.sql`
11. `20260924195451_fix_pedidos_admin_policy.sql`
12. `20260924195820_add_pedidos_cliente_id.sql`
13. `20260924195828_index_pedidos_cliente_id.sql`
14. `20260926192617_backfill_pedidos_cliente_id.sql`
15. `20260926193731_create_refresh_tokens.sql`
16. `20261001193100_add_categorias_codigo.sql`
17. `20261001212500_add_muebles_referencia.sql`
18. `20261001220000_backfill_categorias_codigo.sql`
19. `20261002121823_backfill_muebles_referencia.sql`
20. `20261002174749_add_categoria_espejos.sql`
21. `20261002193936_respaldo_agrupacion_muebles.sql`
22. `20261002200855_agrupar_fichas_juntar_fotos.sql`
23. `20261005002322_create_mensajes_contacto.sql`
24. `20261012165218_verificacion_email.sql`
25. `20261013112123_marcar_admins_verificados.sql`
26. `20261014110000_enable_btree_gist.sql`
27. `20261014110001_create_reservas.sql`
28. `20261019233700_reemplazar_borrador_reservas_por_r2.sql`
29. `20261021223000_create_password_resets.sql`
30. `20261021232000_create_audit_log.sql`
31. `20261022130000_create_ajustes_home.sql`
32. `20261022190000_add_ajustes_home_imagenes_secciones.sql`

### 2.3 Row Level Security (RLS) y Claves API
- En **Project Settings > API**:
  - Copia la **Project URL** (`https://xxxxxxxxxxxxxx.supabase.co`).
  - Copia la clave **service_role** (secreta, solo para el backend).
  - La clave `anon` no se expone al cliente público; el backend gestiona toda interacción usando `service_role` tras validar la sesión y roles con Zod y JWT.
- Verifica que las tablas críticas (`pedidos`, `reservas`, `refresh_tokens`, `verificaciones_email`, `audit_log`, `mensajes_contacto`) tienen **RLS habilitado** (las migraciones lo activan por defecto).

### 2.4 Storage Bucket para Imágenes
1. Ve a **Storage** en el menú lateral de Supabase.
2. Crea un bucket llamado `imagenes` (o el configurado para tu catálogo).
3. Marca el bucket como **Public bucket** para que las URLs públicas puedan ser servidas mediante CDN.
4. Establece un límite de subida por archivo (recomendado: 10 MB) y tipos permitidos: `image/jpeg, image/png, image/webp, image/avif`.

### 2.5 Optimización por Lotes de Imágenes Existentes (WebP 400w, 800w, 1200w)
Si el bucket ya contiene fotografías históricas en JPEG/PNG sin comprimir:
1. Asegúrate de tener `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `server/.env`.
2. Ejecuta el script de optimización:
   ```bash
   cd server
   node scripts/optimizarImagenes.js
   ```
   - El script descargará cada JPEG/PNG, generará las 3 resoluciones WebP con calidad 82 (`-400.webp`, `-800.webp`, `-1200.webp`) y las subirá al bucket.
   - El script es idempotente: no vuelve a procesar imágenes que ya tengan sus versiones WebP creadas.
3. **TODO / Si no dispones de credenciales en local**:
   - Puedes probar el pipeline localmente ejecutando: `node scripts/optimizarImagenes.js --local` (procesará las imágenes de `server/scripts/__fixtures__/input/`).
   - Una vez desplegado en Vercel con las credenciales de producción, ejecuta el comando desde una terminal con acceso a Supabase o mediante una Serverless Function de mantenimiento puntual.

---

## 3. Paso 2: Generación de Secretos Criptográficos

El backend requiere claves criptográficas robustas para JWT, rotación de refresh tokens y hashes HMAC de verificación de email.

Ejecuta el generador integrado desde la raíz del servidor:
```bash
cd server
npm run secrets:generate
```

Esto generará un bloque listo para copiar:
```text
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REFRESH_TOKEN_HASH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_TOKEN_HASH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Aviso de Seguridad**: Guarda estos secretos en un almacén seguro (ej. 1Password o Doppler). Nunca los añadas al repositorio Git.

---

## 4. Paso 3: Configuración de Stripe (Test y Live)

### 4.1 Claves API y Modo Live
1. En el [Dashboard de Stripe](https://dashboard.stripe.com/):
   - Para pruebas: activa el switch **Test mode**.
   - Para producción: cambia a **Live mode**.
2. Ve a **Desarrolladores > Claves de API**:
   - Copia la **Clave secreta** (`sk_live_...` o `sk_test_...` para staging).
   - Guárdala como `STRIPE_SECRET_KEY` en las variables de entorno del servidor.

### 4.2 Webhook Endpoint y Eventos
1. Ve a **Desarrolladores > Webhooks > Añadir endpoint**.
2. **URL del Endpoint**: `https://<tu-api.dominio.com>/api/stripe/webhook`
   *(Importante: debe ser HTTPS y apuntar a la URL final sin redirecciones HTTP->HTTPS para evitar fallos de Stripe)*.
3. **Eventos a escuchar**:
   - `checkout.session.completed`
   - *(Opcional si usas reservas de pago diferido: `payment_intent.succeeded`)*.
4. Pulsa **Añadir endpoint**.
5. En la ficha del webhook creado, haz clic en **Revelar** en "Secreto de firma" (`whsec_...`).
6. Guárdalo como `STRIPE_WEBHOOK_SECRET` en el backend.

### 4.3 Rotación de Claves de Stripe
- Cuando necesites rotar claves:
  1. En Stripe Dashboard, añade un nuevo webhook endpoint con la misma URL.
  2. Obtén el nuevo `whsec_...`.
  3. Despliega la nueva variable en Vercel.
  4. Borra el endpoint antiguo en Stripe tras verificar que los nuevos eventos llegan correctamente.

---

## 5. Paso 4: Configuración de Resend (Emails Transaccionales)

### 5.1 API Key
1. Inicia sesión en [Resend](https://resend.com) y ve a **API Keys**.
2. Pulsa **Create API Key**, dale permisos de envío (`Sending access`) y copia la clave (`re_...`).
3. Asígnala a `RESEND_API_KEY` en el servidor.

### 5.2 Verificación de Dominio Propio (DNS: SPF, DKIM, DMARC)
Para enviar correos en producción a cualquier cliente (sin estar restringido al buzón de pruebas `onboarding@resend.dev`):
1. En Resend, ve a **Domains > Add Domain**.
2. Introduce tu dominio de envío (ej. `correos.tutienda.com` o `tutienda.com`).
3. Añade los registros DNS indicados por Resend en tu proveedor de DNS:
   - **DKIM**: Registro CNAME / TXT (ej. `resend._domainkey`).
   - **SPF**: Registro TXT (`v=spf1 include:amazonses.com ~all`).
   - **DMARC**: Registro TXT (`_dmarc.tutienda.com` con `v=DMARC1; p=none;`).
4. Espera a que Resend valide los registros (suele tardar de 5 a 30 minutos).
5. Una vez verificado el estado en verde, configura en el backend:
   ```env
   RESEND_FROM=Tu Marca <hola@tutienda.com>
   ```

---

## 6. Paso 5: Configuración de Variables de Entorno

Consulta la guía detallada [docs/ENV_VARS.md](file:///c:/Users/amata/Desktop/catalogo-muebles/docs/ENV_VARS.md) para la lista completa y explicada de cada parámetro.

Resumen rápido de las variables obligatorias en Producción:

### Backend (`server/`)
```env
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
JWT_SECRET=xxxx... (64 hex)
REFRESH_TOKEN_HASH_SECRET=xxxx... (64 hex)
EMAIL_TOKEN_HASH_SECRET=xxxx... (64 hex)
CLIENT_URL=https://tutienda.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM=Tu Marca <hola@tutienda.com>
ADMIN_EMAIL=admin@tutienda.com
RESERVAS_ACTIVAS=true
```

### Frontend (`client/`)
```env
VITE_API_URL=https://api.tutienda.com/api
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_RESERVAS_ACTIVAS=true
```

---

## 7. Paso 6: Despliegue en Vercel (Backend y Frontend)

Se recomienda desplegar Backend y Frontend como proyectos separados en Vercel para desacoplar el ciclo de vida y optimizar la caché de frontend:

### 7.1 Despliegue del Backend (`server/`)
1. En Vercel Dashboard, pulsa **Add New > Project** e importa el repositorio.
2. En **Root Directory**, selecciona `server`.
3. **Framework Preset**: `Other`.
4. En **Environment Variables**, introduce todas las variables del backend listadas arriba.
5. Haz clic en **Deploy**.
6. En **Settings > Domains**, asigna el subdominio de la API (ej. `api.tutienda.com`).

### 7.2 Despliegue del Frontend (`client/`)
1. En Vercel Dashboard, pulsa **Add New > Project** e importa el mismo repositorio.
2. En **Root Directory**, selecciona `client`.
3. **Framework Preset**: `Vite`.
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. En **Environment Variables**, añade las variables `VITE_*`.
7. Haz clic en **Deploy**.
8. En **Settings > Domains**, asigna el dominio raíz (`tutienda.com`) y el alias `www.tutienda.com`.

### 7.3 Asignación de Dominios Personalizados
Configura los registros DNS en tu proveedor de dominio:
- Para el Frontend:
  - `A` / `ALIAS` `@` apuntando a `76.76.21.21` (IP Anycast de Vercel).
  - `CNAME` `www` apuntando a `cname.vercel-dns.com`.
- Para el Backend:
  - `CNAME` `api` apuntando a `cname.vercel-dns.com`.

---

## 8. Paso 7: Verificación Post-Deploy (Smoke Tests)

Una vez completado el despliegue, realiza este checklist en orden:

### 8.1 Endpoint /api/health
Abre en tu navegador o terminal:
```bash
curl -I https://api.tutienda.com/api/health
```
- Debe responder `HTTP/1.1 200 OK` con JSON `{ "status": "ok", "uptime": ... }`.
- Si responde 500 o no conecta, revisa los logs de Vercel Functions para descartar fallo en `SUPABASE_URL` o claves faltantes.

### 8.2 Sitemap y Robots
- Navega a `https://tutienda.com/sitemap.xml`: debe devolver el XML con las rutas públicas y productos indexables.
- Navega a `https://tutienda.com/robots.txt`: debe permitir el rastreo de motores de búsqueda.

### 8.3 Catálogo, Calendario de Alquiler y Checkout
1. Abre la Home: comprueba que las imágenes cargan con WebP y tamaño responsivo.
2. Entra en una ficha de producto:
   - Verifica que el título y la descripción se renderizan sin layout shift (skeleton anti-CLS).
   - Comprueba la selección de fechas en el calendario (si `VITE_RESERVAS_ACTIVAS=true`).
3. Realiza una compra de prueba en Stripe Test Mode:
   - Añade una pieza al carrito.
   - Paga con tarjeta de prueba (4242...).
   - Comprueba que redirige a `/checkout/exito`.
   - Verifica en Stripe Dashboard que el evento `checkout.session.completed` devolvió `200 OK` en el webhook.
   - Revisa que el pedido figura en la base de datos y que se envió el email de confirmación.

### 8.4 Panel de Administración
1. Navega a `https://tutienda.com/admin`.
2. Inicia sesión con la cuenta de administrador.
3. Comprueba que cargan las pestañas: Resumen (KPIs), Inventario, Pedidos, Reservas, Mensajes y Actividad (Audit Log).
4. Sube una imagen de prueba y verifica que se genera correctamente en Supabase Storage.

### 8.5 Optimización por Lotes de Imágenes WebP
Si importaste un catálogo existente con imágenes JPEG o PNG pesadas, puedes generar las variantes responsive (400w, 800w, 1200w) en formato WebP con el script por lotes:
```bash
cd server
npm run images:optimize
```
- Lee el bucket `imagenes` (carpeta `muebles`) y procesa cada imagen con `sharp` (calidad 82).
- Es idempotente: solo procesa archivos que no tengan aún su variante WebP generada.
- Una vez procesado el lote, activa en el frontend `VITE_WEBP_OPTIMIZADAS=true` para que `<picture>` sirva automáticamente el `srcset` WebP.

---

## 9. Paso 8: Procedimientos de Rollback y Contingencia

Si se detecta una anomalía crítica tras el despliegue:

### 9.1 Rollback Inmediato en Vercel
1. Ve al proyecto en Vercel Dashboard > **Deployments**.
2. Localiza el despliegue anterior estable (marcado con commit previo).
3. Haz clic en los tres puntos `...` y pulsa **Promote to Production**.
4. El tráfico se reencamina en menos de 5 segundos sin tiempo de inactividad.

### 9.2 Rollback de Migraciones de Base de Datos
Cada migración en `server/migrations/` incluye su contraparte `.down.sql` para revertir cambios de forma controlada si fuera estrictamente necesario.
- Abre el SQL Editor de Supabase.
- Ejecuta el script `.down.sql` de la última migración aplicada en orden inverso.

### 9.3 Rotación de Emergencia de Secretos
Si se sospecha de un secreto comprometido:
1. Corre `npm run secrets:generate`.
2. Aplica la rotación sin downtime configurando el secreto antiguo en `*_PREVIOUS` y el nuevo en la variable principal:
   ```env
   JWT_SECRET=nuevo_secreto
   JWT_SECRET_PREVIOUS=secreto_anterior
   REFRESH_TOKEN_HASH_SECRET=nuevo_secreto
   REFRESH_TOKEN_HASH_SECRET_PREVIOUS=secreto_anterior
   EMAIL_TOKEN_HASH_SECRET=nuevo_secreto
   EMAIL_TOKEN_HASH_SECRET_PREVIOUS=secreto_anterior
   ```
3. Tras 24-48 horas, elimina las variables `*_PREVIOUS`.
