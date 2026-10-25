# Guía de Onboarding: Nuevo Cliente en 30 Minutos (NUEVO_CLIENTE.md)

Este documento es una guía paso a paso y checklist operativo para clonar o utilizar este repositorio como plantilla starter para un nuevo cliente o marca comercial en aproximadamente 30 minutos.

---

## Tabla de Contenidos (TOC)

1. [Visión General del Proceso (Timeline de 30 Minutos)](#1-visión-general-del-proceso-timeline-de-30-minutos)
2. [Fase 1: Clonar y Personalizar la Marca (Minutos 0-8)](#2-fase-1-clonar-y-personalizar-la-marca-minutos-0-8)
   - [2.1 Clonar el Repositorio](#21-clonar-el-repositorio)
   - [2.2 Editar `brand.config.js`](#22-editar-brandconfigjs)
   - [2.3 Aplicar o Crear la Paleta del Cliente (`tokens.css`)](#23-aplicar-o-crear-la-paleta-del-cliente-tokenscss)
3. [Fase 2: Infraestructura y Base de Datos (Minutos 8-16)](#3-fase-2-infraestructura-y-base-de-datos-minutos-8-16)
   - [3.1 Proyecto en Supabase](#31-proyecto-en-supabase)
   - [3.2 Correr Migraciones](#32-correr-migraciones)
   - [3.3 Crear Bucket de Almacenamiento](#33-crear-bucket-de-almacenamiento)
4. [Fase 3: Pasarelas, Correos y Criptografía (Minutos 16-22)](#4-fase-3-pasarelas-correos-y-criptografía-minutos-16-22)
   - [4.1 Generar Secretos Criptográficos](#41-generar-secretos-criptográficos)
   - [4.2 Configurar Stripe](#42-configurar-stripe)
   - [4.3 Configurar Resend](#43-configurar-resend)
5. [Fase 4: Despliegue en Vercel (Minutos 22-26)](#5-fase-4-despliegue-en-vercel-minutos-22-26)
   - [5.1 Despliegue Backend](#51-despliegue-backend)
   - [5.2 Despliegue Frontend](#52-despliegue-frontend)
   - [5.3 Asignación de Dominio](#53-asignación-de-dominio)
6. [Fase 5: Verificación y Pruebas de Humo (Minutos 26-30)](#6-fase-5-verificación-y-pruebas-de-humo-minutos-26-30)
7. [Checklist Final de Lanzamiento](#7-checklist-final-de-lanzamiento)

---

## 1. Visión General del Proceso (Timeline de 30 Minutos)

```
[00:00 - 08:00]  Clonación + brand.config.js + Colores Theme
[08:00 - 16:00]  Supabase (Proyecto + Migraciones + Bucket)
[16:00 - 22:00]  npm run secrets:generate + Stripe + Resend
[22:00 - 26:00]  Vercel Deploy (Client & Server) + Dominios DNS
[26:00 - 30:00]  Smoke Tests (/health, Catálogo, Admin, Checkout)
```

---

## 2. Fase 1: Clonar y Personalizar la Marca (Minutos 0-8)

### 2.1 Clonar el Repositorio
```bash
git clone https://github.com/tu-organizacion/catalogo-muebles.git cliente-nueva-marca
cd cliente-nueva-marca
git checkout -b main
```

Instala las dependencias en ambos entornos:
```bash
cd server && npm install
cd ../client && npm install
cd ..
```

### 2.2 Editar `brand.config.js`
Abre [client/src/theme/brand.config.js](file:///c:/Users/amata/Desktop/catalogo-muebles/client/src/theme/brand.config.js) y adapta los datos del nuevo cliente:

```javascript
export const BRAND = {
  nombre: 'Studio Vintage Madrid',
  nombreCorto: 'Studio Vintage',
  descripcion: 'Mobiliario mid-century, antigüedades y diseño escandinavo en Madrid.',
  prefijoSku: 'SVM', // Prefijo usado en referencias automáticas de piezas (ej. SVM-001)
  moneda: 'EUR',
  locale: 'es-ES',
  contacto: {
    email: 'contacto@studiovintagemadrid.com',
    telefono: '+34 912 345 678',
    direccion: 'Calle Hermosilla 42, 28001 Madrid',
    horario: 'Lunes a Viernes de 10:30 a 19:30'
  },
  redes: {
    instagram: 'https://instagram.com/studiovintagemadrid',
    facebook: '',
    pinterest: ''
  },
  modulos: {
    ecommerce: true, // Tienda online con carrito y checkout Stripe
    bookings: true   // Sistema de alquiler por días con calendario y fianza
  }
};
```

### 2.3 Aplicar o Crear la Paleta del Cliente (`tokens.css`)
En [client/src/theme/tokens.css](file:///c:/Users/amata/Desktop/catalogo-muebles/client/src/theme/tokens.css), ajusta los valores de marca en `:root`.

Puedes tomar como inspiración la plantilla de demostración [client/src/theme/theme-cliente-demo.css](file:///c:/Users/amata/Desktop/catalogo-muebles/client/src/theme/theme-cliente-demo.css) (azul marino y dorado) o personalizar:

```css
:root {
  /* Paleta del Nuevo Cliente */
  --color-primary: #1E293B;      /* Azul pizarra elegante */
  --color-accent: #D97706;       /* Ámbar cálido / Oro viejo */
  --color-accent-hover: #B45309;
  --color-surface: #FFFFFF;
  --color-surface-alt: #F8FAFC;
  --color-border: #E2E8F0;
  --color-text: #0F172A;
  --color-text-muted: #64748B;
  
  /* Tipografía */
  --font-display: 'Fraunces', serif;
  --font-body: 'Inter', sans-serif;
}
```

---

## 3. Fase 2: Infraestructura y Base de Datos (Minutos 8-16)

### 3.1 Proyecto en Supabase
1. Entra en [Supabase](https://supabase.com/dashboard) y crea un proyecto (ej. `studio-vintage-prod`).
2. Anota la **Project URL** y la **service_role key** (desde Settings > API).

### 3.2 Correr Migraciones
Abre la consola de Supabase (SQL Editor) o conecta mediante Supabase CLI:
```bash
cd server
supabase link --project-ref tu-project-ref
supabase db push
```
*(O ejecuta secuencialmente los scripts de `server/migrations/` en el SQL Editor).*

### 3.3 Crear Bucket de Almacenamiento
1. En Supabase > **Storage**, pulsa **New Bucket**.
2. Nombre: `muebles`.
3. Activa la casilla **Public bucket** (para lectura pública de fotos mediante CDN).
4. Guarda los cambios.

---

## 4. Fase 3: Pasarelas, Correos y Criptografía (Minutos 16-22)

### 4.1 Generar Secretos Criptográficos
En la carpeta `server/`:
```bash
cd server
npm run secrets:generate
```
Copia el bloque generado de `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET` y `EMAIL_TOKEN_HASH_SECRET`.

### 4.2 Configurar Stripe
1. En el [Dashboard de Stripe](https://dashboard.stripe.com/):
   - Ve a **Desarrolladores > Claves de API** y copia `STRIPE_SECRET_KEY` (`sk_live_...`).
   - Ve a **Webhooks > Añadir endpoint**.
     - URL: `https://api.studiovintagemadrid.com/api/stripe/webhook`
     - Eventos: `checkout.session.completed`.
     - Copia el Secreto de firma `whsec_...` como `STRIPE_WEBHOOK_SECRET`.

### 4.3 Configurar Resend
1. En [Resend](https://resend.com):
   - Añade el dominio del cliente (ej. `studiovintagemadrid.com`).
   - Agrega los registros DNS (DKIM, SPF) en su panel de dominio.
   - Crea una API Key `re_...` y define `RESEND_FROM=Studio Vintage <hola@studiovintagemadrid.com>`.

---

## 5. Fase 4: Despliegue en Vercel (Minutos 22-26)

### 5.1 Despliegue Backend
1. En Vercel: **Add New > Project** > Selecciona el repo > Root directory: `server`.
2. Añade las variables de entorno:
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: `https://studiovintagemadrid.com`
   - `SUPABASE_URL`: `https://...`
   - `SUPABASE_SERVICE_ROLE_KEY`: `eyJ...`
   - `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET`, `EMAIL_TOKEN_HASH_SECRET`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`
   - `RESERVAS_ACTIVAS`: `true`
3. Despliega y asigna el dominio: `api.studiovintagemadrid.com`.

### 5.2 Despliegue Frontend
1. En Vercel: **Add New > Project** > Selecciona el mismo repo > Root directory: `client`.
2. Añade las variables de entorno:
   - `VITE_API_URL`: `https://api.studiovintagemadrid.com/api`
   - `VITE_RESERVAS_ACTIVAS`: `true`
3. Despliega y asigna los dominios: `studiovintagemadrid.com` y `www.studiovintagemadrid.com`.

### 5.3 Asignación de Dominio
En el panel DNS del cliente (Cloudflare / registrador):
- `A` / `@` -> `76.76.21.21`
- `CNAME` / `www` -> `cname.vercel-dns.com`
- `CNAME` / `api` -> `cname.vercel-dns.com`

---

## 6. Fase 5: Verificación y Pruebas de Humo (Minutos 26-30)

Comprobaciones rápidas para certificar que la tienda está 100% operativa:

1. **Health check**:
   ```bash
   curl -s https://api.studiovintagemadrid.com/api/health
   # Respuesta esperada: {"status":"ok",...}
   ```
2. **Acceso Admin**:
   - Entra en `https://studiovintagemadrid.com/admin`.
   - Crea o promueve la cuenta administradora inicial.
   - Sube un mueble de prueba con fotos y descripción.
3. **Catálogo y Ficha**:
   - Comprueba que la pieza aparece en el catálogo con el prefijo SKU correcto (ej. `SVM-001`).
   - Verifica el funcionamiento del botón de compra o reserva.
4. **Prueba de Pago**:
   - Realiza un pedido de prueba (modo test o real reembolsable).
   - Comprueba recepción de correo transaccional y registro en la pestaña de Pedidos.

---

## 7. Checklist Final de Lanzamiento

- [ ] `brand.config.js` actualizado con nombre, teléfono, CIF y redes del cliente.
- [ ] `tokens.css` ajustado con los colores corporativos.
- [ ] Migraciones de Supabase completadas sin errores (tablas `muebles`, `pedidos`, `reservas`, etc.).
- [ ] RLS activado en todas las tablas sensibles.
- [ ] Bucket `muebles` creado y público.
- [ ] Secretos únicos generados con `npm run secrets:generate`.
- [ ] Stripe en modo Live con Webhook HTTPS registrado.
- [ ] Resend con dominio verificado (SPF/DKIM/DMARC) y dirección `RESEND_FROM` válida.
- [ ] Variables de entorno cargadas en ambos proyectos de Vercel.
- [ ] DNS propagado y certificados SSL activos en Vercel.
- [ ] Smoke tests completados con éxito.
