# Despliegue (DEPLOY.md)

Cómo poner en marcha una tienda hecha con este repositorio: base de datos (Supabase), API (Express en
Vercel), web (React + Vite en Vercel), pagos (Stripe) y correos (Resend). Para el orden de trabajo con un
cliente nuevo, ver [NUEVO_CLIENTE.md](NUEVO_CLIENTE.md); para cada variable, [ENV_VARS.md](ENV_VARS.md).

Escrito el 30 oct 2026 a partir del código de la rama `feat/starter-kit`. Los pasos de Vercel, Stripe y
Resend no se han podido repetir desde el contenedor (no llega a esos servicios): están sacados del código y
de cómo está montado Nave 5 hoy.

---

## 0. Piezas y dónde vive cada una

| Pieza | Carpeta | Dónde se despliega | Notas |
|---|---|---|---|
| Web | `client/` | Proyecto de Vercel con *Root Directory* `client` | Vite genera `dist/`. `client/vercel.json`: reescrituras, caché y cabeceras de seguridad |
| API | `server/` | Otro proyecto de Vercel con *Root Directory* `server` | `server/api/index.js` exporta la app de Express como función. `server/vercel.json`: todo a esa función y el cron diario |
| Base de datos y fotos | — | Supabase (Postgres + Storage) | La API entra con la clave `service_role`; la web nunca habla con Supabase directamente, solo carga fotos públicas |
| Pagos | — | Stripe Checkout + webhook | La API crea la sesión y Stripe avisa al webhook |
| Correos | — | Resend | Sin `RESEND_API_KEY` la API no envía nada (solo deja una línea en el log) |

Cada `push` a la rama de producción de Vercel (en Nave 5, `main`) despliega los dos proyectos.

---

## 1. Supabase

### 1.1 Proyecto
1. Crea un proyecto en Supabase (región de la UE si la tienda es europea).
2. En *Settings > API* anota la **Project URL** (`SUPABASE_URL`) y la clave **service_role**
   (`SUPABASE_SERVICE_ROLE_KEY`). La `service_role` se salta RLS: solo va en la API, nunca en la web.

### 1.2 Esquema
> **Hueco conocido.** El repositorio no tiene el `CREATE TABLE` de las cuatro tablas base (`muebles`,
> `categorias`, `clientes` y `pedidos`): existían antes de la primera migración (3 sep 2026) y se crearon
> a mano (ver `server/migrations/README.md`, "Lo que no está aquí"). Hasta que se exporte ese esquema, una
> base de datos nueva no se puede montar solo con el repositorio.
>
> Cómo cerrarlo, una sola vez y en solo lectura sobre Nave 5: `supabase db dump --schema-only` (o
> `pg_dump --schema-only`) del proyecto actual, guardado como `server/migrations/00000000000000_esquema_base.sql`.

Con el esquema base aplicado, el resto son las migraciones de `server/migrations/`, **en orden de
nombre** y solo los `.sql` que no acaban en `.down.sql` (las `.down.sql` son la marcha atrás de cada una).
Algunas son datos de Nave 5 y en un proyecto nuevo no hacen nada o sobran:

- `*_backfill_*`, `*_respaldo_agrupacion_muebles`, `*_agrupar_fichas_juntar_fotos`: arreglos de datos
  de Nave 5. En una base vacía no tocan nada, pero tampoco hacen falta.
- `*_add_categoria_espejos`: crea la categoría «Espejos». Bórrala después si el cliente no la quiere.
- `20261014110000_enable_btree_gist` y `20261014110001_create_reservas`: el borrador de reservas, que
  `20261019233700_reemplazar_borrador_reservas_por_r2` sustituye. Hay que aplicarlas igual, en orden.

En Nave 5 se aplican con la herramienta `apply_migration` del MCP de Supabase, nunca desde el SQL Editor
(lo que se ejecuta ahí no queda registrado en `supabase_migrations.schema_migrations`). En un proyecto
nuevo cualquiera de las dos vale, pero conviene la misma regla para que el repositorio refleje la base.

### 1.3 Fotos
1. *Storage > New bucket*: nombre **`imagenes`**, público. Es el que usa la API
   (`server/src/utils/upload.js`).
2. Ahí van las fotos que se suben desde el panel (piezas y portada) y el logo de los correos (carpeta
   `marca/`).

### 1.4 Primer administrador
No hay pantalla para crearlo. Regístrate en la web con el correo del administrador, confirma el email y,
en el SQL Editor (es un dato, no una migración):

```sql
UPDATE clientes SET rol = 'admin', email_verificado = true, email_verificado_en = now()
WHERE email = 'admin@tu-dominio.com';
```

Cierra sesión y vuelve a entrar: el rol va dentro del token.

---

## 2. Secretos de la API

```bash
cd server && npm run secrets:generate
```

Saca tres valores aleatorios distintos: `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET` y
`EMAIL_TOKEN_HASH_SECRET`. Uno por entorno (producción, preview, local) y nunca el mismo en dos tiendas.
Para cambiarlos sin cerrar las sesiones abiertas, ver las variables `*_PREVIOUS` en [ENV_VARS.md](ENV_VARS.md).

---

## 3. Stripe

1. *Developers > API keys*: la clave secreta es `STRIPE_SECRET_KEY` (`sk_test_...` para probar,
   `sk_live_...` en producción).
2. *Developers > Webhooks > Add endpoint*:
   - URL: `https://<dominio-de-la-api>/api/stripe/webhook`
   - Eventos: **`checkout.session.completed`** (compras y reservas) y **`checkout.session.expired`**
     (libera las fechas de una reserva que no se pagó). El resto se acusa con 200 y no se usa.
   - El *Signing secret* (`whsec_...`) es `STRIPE_WEBHOOK_SECRET`. Sin él el webhook responde 503 y
     Stripe reintenta.
3. Si el webhook no llega, la página `/checkout/exito` confirma el pago por su cuenta
   (`confirmar-sesion`): el pedido sale una sola vez aunque lleguen los dos (`server/src/utils/pagos.js`).

---

## 4. Resend

1. Crea una API key: `RESEND_API_KEY`.
2. Verifica el dominio del cliente (registros SPF y DKIM en su DNS).
3. `RESEND_FROM`, por ejemplo `Tu Marca <hola@tu-dominio.com>`. Sin dominio verificado, el valor por
   defecto (`onboarding@resend.dev`, en `server/src/config/brand.config.js`) solo entrega al dueño de la
   cuenta de Resend.
4. `ADMIN_EMAIL` recibe los avisos de ventas y reservas; `CONTACT_EMAILS` (separados por comas) los
   mensajes del formulario de contacto.

El logo de la cabecera de los correos es un PNG público: `server/scripts/logo-email.js` lo genera a partir
del logo de la web, y su URL va en `BRAND.email.logo` y `BRAND.email.logo2x`.

---

## 5. Vercel

### 5.1 API (`server/`)
1. *Add New > Project*, el repositorio, *Root Directory* `server`. Sin comando de build.
2. Variables de entorno: las de "Servidor" en [ENV_VARS.md](ENV_VARS.md). Las imprescindibles para
   arrancar son `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `REFRESH_TOKEN_HASH_SECRET`,
   `EMAIL_TOKEN_HASH_SECRET` y `CLIENT_URL`.
3. El cron de `server/vercel.json` llama cada día a las 08:00 UTC a `/api/cron/reservas` (recordatorios
   y avisos de las reservas). Necesita `CRON_SECRET` en el proyecto: sin ella responde 503. Con
   `RESERVAS_ACTIVAS` apagada responde 404 y no hace nada.

### 5.2 Web (`client/`)
1. *Add New > Project*, el mismo repositorio, *Root Directory* `client`. Vercel detecta Vite
   (`npm run build`, salida `dist`).
2. Variables: `VITE_API_URL` (`https://<dominio-de-la-api>/api`) y las opcionales de "Cliente" en
   [ENV_VARS.md](ENV_VARS.md). Son de compilación: tras cambiarlas hay que volver a desplegar.
3. **Edita `client/vercel.json` para el cliente nuevo**: lleva escritos el dominio de la API de Nave 5
   (`nave5-api.vercel.app`, en la reescritura de `/sitemap.xml` y en `connect-src` de la CSP) y el de su
   Supabase (`gdrmpxcpucmaxvtpljge.supabase.co`, en `img-src`). Lo mismo el `preconnect` a Supabase de
   `client/index.html`. Si cambias el script en línea de `index.html`, su hash de la CSP también cambia
   (lo comprueba `client/src/cspVercel.test.js`).

### 5.3 Dominios
- Web: el dominio del cliente y su `www` en el proyecto de la web.
- API: un subdominio propio o el `*.vercel.app` del proyecto. Pon el mismo origen de la web en
  `CLIENT_URL` (y los demás orígenes permitidos en `ALLOWED_ORIGINS`), o la API rechazará las peticiones
  por CORS.

---

## 6. Comprobaciones después de desplegar

1. `curl https://<api>/api/health`: dice si llega a Supabase y a Stripe.
2. `https://<web>/sitemap.xml`: las páginas fijas, las categorías y las fichas.
3. Portada, catálogo y una ficha: textos de la marca, colores y fotos.
4. Panel (`/admin`) con el administrador: alta de una pieza con foto. Su referencia debe empezar por el
   prefijo de `brand.config.js` (en Nave 5, `NAV-`).
5. Compra de prueba con `sk_test_...` y la tarjeta `4242 4242 4242 4242`: pedido en el panel y correos al
   comprador y a `ADMIN_EMAIL`.
6. Si las reservas van encendidas: una reserva de prueba y, al día siguiente, el cron en los logs de Vercel.

---

## 7. Marcha atrás

- **Código:** en Vercel, *Deployments*, el despliegue bueno anterior, *Promote to Production*. O
  `git revert` del commit y push.
- **Base de datos:** cada migración propia tiene su `.down.sql`. Léelo antes: algunos llevan una
  `ADVERTENCIA` porque borrarían datos escritos después.
- **Secretos:** si uno se filtra, genera otro, pon el viejo en su variable `*_PREVIOUS` el tiempo de una
  sesión (7 días para los refresh tokens) y quítalo después.
