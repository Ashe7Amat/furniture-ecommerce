# Nave 5 Barcelona

Tienda online de muebles y piezas de colección restauradas a mano. Catálogo público,
carrito y checkout con Stripe, panel de administración para gestionar inventario y pedidos, y
cuenta de cliente con historial de compras.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, React Router 6, Context API (sin Redux) |
| Backend | Node.js 22+, Express 4, desplegado como función serverless en Vercel |
| Base de datos | Supabase (Postgres), acceso solo desde el servidor con la clave `service_role` |
| Pagos | Stripe Checkout (redirección a página de pago; sin Stripe Elements embebido) |
| Email | Resend (bienvenida, aviso de venta al admin, confirmación al comprador) |
| Autenticación | JWT propio (login con email/contraseña o con Google) |
| Tests | `node:test` + `supertest` en el servidor, Vitest + Testing Library en el cliente |
| Hosting | Vercel (frontend y backend en dos proyectos independientes) |

No es un monorepo con herramientas de workspace (Turborepo, pnpm workspaces...): `client/` y
`server/` son dos proyectos npm independientes, cada uno con su propio `package.json` y
`node_modules`.

## Estructura de carpetas

```
.
├── client/                  Frontend (React + Vite)
│   └── src/
│       ├── components/      Piezas de UI reutilizables (tarjetas, modales, cabecera...)
│       ├── context/         Estado global vía Context API (auth, carrito, favoritos, toasts)
│       ├── pages/           Una página por ruta (Catálogo, Detalle, Admin, Perfil...)
│       ├── services/        api.js -- único punto de entrada a la API del servidor
│       ├── styles/          Un .css por página/componente, variables de diseño en index.css
│       └── utils/           Funciones puras sin estado (formato, imágenes, hooks pequeños)
│
├── server/                   Backend (Express)
│   ├── api/index.js          Punto de entrada que usa Vercel (función serverless)
│   ├── migrations/           Espejo en texto de las migraciones aplicadas a Supabase
│   │                         (ver "Base de datos y migraciones" más abajo)
│   └── src/
│       ├── controllers/      Lógica de cada ruta (una función por endpoint)
│       ├── routes/           Definición de rutas Express + middlewares de cada una
│       ├── middleware/        Auth (JWT) y validación (Zod) reutilizables entre rutas
│       ├── schemas/          Esquemas Zod de validación de entrada, uno por recurso
│       ├── data/              Cliente de Supabase (supabase.js) -- único punto de conexión a la BD
│       ├── utils/             Email, Stripe, metadata de pagos, procesado de pedidos...
│       └── __tests__/         Tests (node:test), con dobles en memoria de Supabase/Stripe
│
├── docs/                      Documentación del proyecto (este mismo README enlaza a cada una)
└── .github/workflows/         CI (lint + test + build en cada push/PR contra main)
```

## Cómo arrancar en local

**Requisitos:** Node.js 22 o superior, npm, una cuenta de Supabase (gratuita) y, si vas a probar
pagos, una cuenta de Stripe en modo test.

```bash
# 1. Clona el repo y entra en cada carpeta para instalar dependencias
git clone https://github.com/Ashe7Amat/furniture-ecommerce.git
cd furniture-ecommerce/server && npm install
cd ../client && npm install

# 2. Copia las plantillas de variables de entorno y rellénalas
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edita ambos .env -- ver la sección de abajo y docs/env-vars.md para el detalle de cada variable

# 3. Arranca los dos servidores (en dos terminales distintas)
cd server && npm run dev     # http://localhost:5000
cd client && npm run dev     # http://localhost:5173
```

El servidor **falla al arrancar** si faltan `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` (con un
mensaje que dice exactamente cuál falta) -- es intencional, para no arrancar a medias con
permisos equivocados. El resto de variables tienen valores por defecto razonables o desactivan
una función concreta (Google login, analítica, emails reales...) si se dejan en blanco.

## Variables de entorno

Tabla resumen; el detalle de cada una (qué hace, formato, dónde se obtiene, ejemplo enmascarado)
está en **[docs/env-vars.md](docs/env-vars.md)**.

| Variable | Lado | Obligatoria |
|---|---|---|
| `PORT` | server | No (por defecto 5000) |
| `SUPABASE_URL` | server | **Sí** |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **Sí** |
| `SUPABASE_ANON_KEY` | server | No (solo la usa `server/src/seed.js`) |
| `JWT_SECRET` | server | **Sí** (sin ella, cualquier JWT firmado con el valor por defecto sería inseguro) |
| `REFRESH_TOKEN_HASH_SECRET` | server | No -- pendiente de usar, tarea 3b (JWT con refresh) |
| `CLIENT_URL` | server | Recomendada (URL de retorno de Stripe) |
| `ALLOWED_ORIGINS` | server | No (orígenes extra permitidos por CORS) |
| `STRIPE_SECRET_KEY` | server | Solo si se quieren cobrar pagos reales |
| `STRIPE_WEBHOOK_SECRET` | server | No (sin ella, el respaldo `confirmar-sesion` sigue registrando ventas) |
| `RESEND_API_KEY` | server | No (sin ella, los emails se simulan por log) |
| `RESEND_FROM` | server | No (tiene un valor por defecto de pruebas) |
| `ADMIN_EMAIL` | server | No (destino de las alertas de venta) |
| `GOOGLE_CLIENT_ID` | server | No (sin ella, el botón de Google queda desactivado) |
| `VITE_API_URL` | client | No (por defecto `http://localhost:5000/api`) |
| `VITE_GOOGLE_CLIENT_ID` | client | No (debe coincidir con `GOOGLE_CLIENT_ID` del servidor) |
| `VITE_GA_MEASUREMENT_ID` | client | No (sin ella, no se carga Google Analytics) |

## Base de datos y migraciones

Las migraciones se aplican con la herramienta nativa de Supabase (no hay una herramienta externa
como `node-pg-migrate` o `knex` en juego) y se guardan también, en texto, en
`server/migrations/<version>_<nombre>.sql` (+ su `.down.sql` de reversión) para poder revisarlas
en el diff igual que cualquier otro cambio de código. El procedimiento completo, las decisiones de
diseño y el porqué de cada una están en **[docs/tarea3-diseno.md](docs/tarea3-diseno.md)**.

## Comandos disponibles

| Comando | client | server |
|---|---|---|
| Arrancar en desarrollo | `npm run dev` | `npm run dev` |
| Compilar para producción | `npm run build` | -- (no aplica, es una función serverless) |
| Tests | `npm test` | `npm test` |
| Lint | `npm run lint` | `npm run lint` |
| Formato (comprobar) | -- | `npm run format:check` |
| Formato (aplicar) | -- | `npm run format` |

## Cómo se despliega

Vercel despliega automáticamente al hacer push a `main`: dos proyectos independientes, uno para
`client/` (build estático de Vite) y otro para `server/` (función serverless a partir de
`server/api/index.js`). Un push a cualquier otra rama **no** despliega nada -- solo `main`. Las
variables de entorno de producción se configuran en el panel de cada proyecto de Vercel, no en
este repositorio.

CI (`.github/workflows/ci.yml`) corre en cada push y cada Pull Request contra `main`: lint, tests
y build del cliente; tests (y, desde la tarea 8, lint/formato) del servidor. Un fallo en CI no
bloquea el deploy de Vercel por sí mismo (son dos sistemas independientes), pero si CI falla en
`main`, algo se ha desplegado roto.

## Más documentación

- **[docs/env-vars.md](docs/env-vars.md)** -- detalle completo de cada variable de entorno.
- **[docs/architecture.md](docs/architecture.md)** -- diagrama de la arquitectura, flujo de compra
  y flujo de autenticación.
- **[docs/tarea3-diseno.md](docs/tarea3-diseno.md)** -- diseño de las migraciones de BD y del JWT
  con refresh y rotación (tarea 3).
- **[docs/mejoras-tecnicas.md](docs/mejoras-tecnicas.md)** -- registro de trabajo de la rama
  `feature/mejoras-tecnicas`: estado de cada tarea, hallazgos de seguridad y pasos manuales
  pendientes al desplegar.
