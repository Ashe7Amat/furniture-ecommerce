# Arquitectura (ARCHITECTURE.md)

Cómo está hecha la tienda: qué hay en cada carpeta, qué es común a cualquier cliente y qué es de la marca,
y cómo funcionan la venta, el alquiler por fechas y las sesiones. Escrito el 30 oct 2026 sobre la rama
`feat/starter-kit`. Los diseños completos, con sus porqués, están en `docs/` (se citan en cada sección).

---

## 1. Visión general

```
 Navegador ──► Web (React 18 + Vite, Vercel) ──fetch──► API (Express 4, función de Vercel) ──► Supabase (Postgres + Storage)
                     │                                       │  ▲
                     │                                       │  └── webhook ── Stripe
                     └── fotos públicas de Supabase ◄────────┘──► Stripe Checkout, Resend (correos)
```

- La web no habla con la base de datos: todo pasa por la API, que entra con la clave `service_role`.
  Las tablas tienen RLS de solo lectura pública como segunda barrera.
- La API no guarda estado en memoria entre peticiones (es una función serverless): sesiones, reservas y
  pedidos viven en Postgres.

## 2. Carpetas: núcleo, módulos y tema

El repositorio no está partido en carpetas `core/` y `modules/`; la separación es esta:

| Capa | Qué es | Dónde está |
|---|---|---|
| **Núcleo** (igual para cualquier cliente) | Catálogo, ficha, cesta, compra con Stripe, cuentas (registro, verificación de email, Google, contraseña olvidada), panel de administración, correos, sitemap y SEO | `client/src/pages`, `components`, `context`, `services/api.js`, `utils`; `server/src/routes`, `controllers`, `middleware`, `schemas`, `utils` |
| **Módulos** (se encienden con variables) | Precios y compra (`MOSTRAR_PRECIOS`), reservas por fechas con fianza y cron diario (`RESERVAS_ACTIVAS` + `VITE_RESERVAS_ACTIVAS`), analítica (`VITE_GA_MEASUREMENT_ID`), fotos WebP (`VITE_WEBP_OPTIMIZADAS`), acceso con Google (`GOOGLE_CLIENT_ID`) | Los mismos archivos; los interruptores están en `server/src/utils/precios.js`, `server/src/utils/reservas.js` y `client/src/utils/reservas.js` |
| **Tema y marca** (lo que cambia por cliente) | Colores, fuentes, radios y sombras; nombre, contacto, web, prefijo de referencias, colores y logo de los correos | `client/src/theme/` (`tokens.css`, `brand.config.js`, temas de ejemplo) y `server/src/config/brand.config.js` |

Otras carpetas:

- `client/public/`: fotos del hero, audio, favicon, `og-image.png`, `manifest.json`, `robots.txt`.
- `client/e2e/`: tests de Playwright con la API simulada (`apiSimulada.js`).
- `server/migrations/`: copia de cada migración aplicada, con su `.down.sql` (ver su `README.md`).
- `server/scripts/`: herramientas de línea de comandos (secretos, logo de los correos, fotos WebP, miniaturas).
- `scripts/init-client.js` (raíz): genera la marca y la paleta de un cliente nuevo (`npm run init:client`,
  tests con `npm test` en la raíz).
- `docs/`: diseños, auditorías y el registro de hallazgos (`mejoras-tecnicas.md`).

## 3. Tema y marca

- **`tokens.css`** es la única fuente de los valores visuales. Define los tokens con nombre genérico
  (`--color-primary`, `--color-surface`, `--font-display`, `--radius-md`...) en tres bloques: claro, oscuro
  del sistema (`prefers-color-scheme`) y oscuro elegido con el botón (`data-theme="dark"` en `<html>`).
  Mantiene los alias de antes (`--primary-color`, `--card-bg`...) apuntando a los nuevos, porque el resto
  de hojas los usan. Ninguna hoja ni componente lleva colores escritos a mano (lo vigila
  `client/src/theme/tokens.test.js`), con dos excepciones a propósito que no son de la marca: el QR de
  las etiquetas (negro sobre blanco, para que lo lean los móviles) y el fondo blanco de las fotos que se
  pasan a JPEG. El color de la barra del navegador (`theme-color` de `index.html`) sale de
  `--color-primary` al compilar.
- Solo `index.css` importa `tokens.css`, así que un tema importado detrás en `main.jsx` gana siempre
  (ejemplo: `theme-cliente-demo.css`).
- **`brand.config.js`** (web) exporta `BRAND`. Lo leen los componentes, `index.html` (marcadores
  `%BRAND_...%` que rellena un plugin de `vite.config.js`) y los datos estructurados. Su pareja
  **`server/src/config/brand.config.js`** lo usa la API en correos, sitemap, CSV y referencias. Los tests
  `client/src/theme/marca.test.js` y `server/src/config/marca.test.js` fallan si el nombre, la web o la
  dirección vuelven a escribirse a mano en el código.

## 4. Venta (compra con Stripe Checkout)

1. La ficha añade la pieza a la cesta (`CartContext`, en `localStorage`).
2. `POST /api/muebles/crear-sesion-pago` (también como invitado) comprueba que hay precios (`MOSTRAR_PRECIOS`), que las piezas
   siguen disponibles y crea la sesión de Stripe con las piezas en su metadata. Devuelve la URL de pago.
3. El cliente paga en Stripe. Dos caminos dan el pago por bueno (`server/src/utils/pagos.js`):
   - el **webhook** `checkout.session.completed` (`POST /api/stripe/webhook`, con la firma comprobada);
   - la vuelta a `/checkout/exito`, que llama a `GET /api/muebles/confirmar-sesion` por si el webhook tarda.
4. `procesarSesionPagada` es idempotente: el id del pedido es un UUID v5 sacado del id de la sesión de
   Stripe, así que aunque los dos caminos lleguen a la vez solo entra un pedido (el segundo choca con la
   clave primaria, error 23505) y solo quien lo registra envía los correos.
5. Cada pieza pasa de `disponible` a `vendido` (o `alquilado`) con un `UPDATE ... WHERE estado =
   'disponible'`; un trigger recalcula la columna `disponible`.
6. Correos: confirmación al comprador y aviso a `ADMIN_EMAIL`. El pedido aparece en la pestaña Pedidos.

## 5. Alquiler por fechas (reservas)

Diseño completo: `docs/reservas-diseno.md`. Todo detrás de `RESERVAS_ACTIVAS` (API) y
`VITE_RESERVAS_ACTIVAS` (web). Apagado, los endpoints de reservas y los del panel responden 403 sin tocar
la base de datos, y el cron 404. La disponibilidad y el presupuesto (solo lectura) siguen respondiendo.

1. La ficha pide `GET /api/muebles/:id/disponibilidad` y `GET /api/muebles/:id/presupuesto` (precio por
   días, portes y fianza, `FIANZA_PORCENTAJE`, 30 % por defecto).
2. `POST /api/reservas/sesion-pago` (sesión iniciada y email verificado) crea una **reserva provisional**
   (`estado = 'pendiente'`) y después la sesión de Stripe. La reserva se guarda antes de pagar, así que dos
   clientes no pueden pagar las mismas fechas: el segundo recibe un 409.
3. Lo que impide los solapes es la base de datos: la restricción de exclusión `reservas_sin_solape`
   (GiST sobre la pieza y el rango ocupado, extensión `btree_gist`) para las reservas `pendiente`,
   `confirmada`, `en_curso` y `devuelta`, y un índice único de una sola provisional por cliente.
4. El webhook `checkout.session.completed` la confirma; `checkout.session.expired` libera las fechas de
   la provisional que no se pagó.
5. Ciclo de vida: `pendiente` → `confirmada` → `en_curso` (entregada) → `devuelta`; o `cancelada` /
   `expirada`. El cliente solo pide la cancelación ("Mis reservas"); cancela y reembolsa el administrador
   desde el panel, que también gestiona la devolución de la fianza.
6. El cron diario (`GET /api/cron/reservas`, 08:00 UTC, protegido con `CRON_SECRET`) envía los
   recordatorios de entrega y recogida y los avisos de retraso.

## 6. Sesiones y seguridad

Diseño: `docs/tarea3-diseno.md` (sesiones) y `docs/verificacion-email-diseno.md` (verificación de email).

- **Access token**: JWT firmado con `JWT_SECRET`, 1 hora, con `sub`, `email`, `nombre` y `rol`. La web lo
  guarda **solo en memoria** y lo manda en `Authorization: Bearer`. `verificarToken` y `verificarAdmin`
  (`server/src/middleware/auth.js`) lo comprueban; el panel exige `rol = 'admin'` en la tabla `clientes`.
- **Refresh token**: 256 bits aleatorios, 7 días, en `localStorage`. En la base de datos
  (`refresh_tokens`) solo se guarda su HMAC con `REFRESH_TOKEN_HASH_SECRET`. Cada uso lo **rota**: el
  viejo queda revocado y apunta a su sucesor dentro de la misma familia (la sesión).
- **Detección de reuso**: presentar un refresh token ya revocado revoca la familia entera (alguien lo ha
  copiado), salvo un margen de 60 s para dos pestañas que renuevan a la vez.
- Cuando el access token caduca, `services/api.js` lo renueva (una sola renovación aunque fallen varias
  peticiones a la vez) y repite la petición. Si el servidor rechaza el refresh token, cierra la sesión;
  si es un fallo de red, no toca nada.
- **Secretos rotables**: con `*_PREVIOUS` se aceptan los tokens firmados con el secreto anterior mientras
  se cambia.
- **Email verificado** para ver "Mis pedidos", reservar y asociar las compras hechas como invitado. Los
  enlaces de verificación y de cambio de contraseña son de un solo uso y se guardan como HMAC
  (`EMAIL_TOKEN_HASH_SECRET`).
- Además: Helmet, CORS con lista exacta de orígenes (`CLIENT_URL` + `ALLOWED_ORIGINS`), límites de
  peticiones por IP en los endpoints sensibles, validación de entrada con Zod (`server/src/schemas`),
  respuestas con las columnas justas (nunca `select('*')` hacia el cliente), registro de acciones del
  panel (`audit_log`) y CSP en la web (`client/vercel.json`, de momento en modo informe).

## 7. Tests

- Web: Vitest + Testing Library (`npm test` en `client/`; cobertura con umbrales en `vite.config.js`) y
  Playwright con la API simulada (`npm run test:e2e`).
- API: el test runner de Node (`npm test` en `server/`; cobertura con umbrales en `package.json`).
- Los tests `Admin.*.test.jsx` del panel tienen la preparación de mocks congelada (decisión D-a de H12 en
  `docs/mejoras-tecnicas.md`): no se tocan sin permiso.
