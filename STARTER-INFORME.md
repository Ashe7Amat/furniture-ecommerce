# Informe: Nave 5 como starter kit white-label (rama `feat/starter-kit`)

Sesión autónoma del 30 oct 2026 (00:20-01:40 UTC). Rama `feat/starter-kit` creada desde
`feature/mejoras-tecnicas` en `89520bd`. No se ha tocado `main` ni `feature/mejoras-tecnicas`, no hay merge
ni PR, y no se ha conectado con Vercel, Supabase ni Stripe: todo es código local.

## Estado de cada tarea

| # | Tarea | Estado | Commit |
|---|---|---|---|
| 1 | Theme system y brand config | ✅ | `264d94d` feat(theme): sistema de tokens CSS y brand.config.js |
| 2 | Desacoplar los textos de la marca | ✅ | `cc2f163` refactor(core): desacoplar strings hardcodeados de la marca |
| 3 | Documentación del starter | ⚠️ hecha, con un hueco que no se puede cerrar sin la base de datos (abajo) | `c5045a9` docs(starter): manuales de despliegue, variables, nuevo cliente y arquitectura |
| 4 | Script de inicialización | ✅ | `f987d96` feat(cli): script interactivo de inicialización de cliente |

Punto de partida: `tokens.css`, `brand.config.js`, `theme-cliente-demo.css` y las cuatro guías ya existían
(maratón del 24-25 oct). Las tareas 1 y 3 han sido completarlos y corregirlos, no crearlos.

## Gate de cada tarea

Todas las tareas pasaron el gate completo antes de su commit:

| Comprobación | Base (`89520bd`) | Final (`f987d96`) |
|---|---|---|
| `npm run lint` cliente / servidor | 0 / 0 errores | 0 / 0 errores |
| `prettier --check` servidor | limpio | limpio (y `scripts/`) |
| `npm run build` | 0 avisos | 0 avisos |
| Tests del cliente (Vitest) | 2107 en 144 archivos | **2137 en 146 archivos**, 0 fallos |
| Cobertura del cliente | 99,28 % líneas, 96,89 % ramas | **99,28 % líneas, 96,89 % ramas** (umbrales 97/95) |
| Tests del servidor (`npm test`) | 1550 | **1560**, 0 fallos |
| Cobertura del servidor (`test:coverage`) | pasa | pasa (99,28 % líneas) |
| Tests de `scripts/` (`npm test` en la raíz) | — | **6**, 0 fallos |
| `Admin.*.test.jsx` congelados | — | **sin tocar** |

## Verificación visual ("pixel perfect")

Sin navegador a mano, pero sí con Chromium en el contenedor: se compararon builds de `89520bd` y de cada
tarea con la API simulada de los E2E, en **114 páginas** (17 rutas públicas + 9 vistas del panel; claro y
oscuro; escritorio y móvil; y el tema elegido con el botón contra el del sistema):

- **Estilos calculados idénticos** en los 28.747 elementos (unas 50 propiedades por elemento, más
  `::before`, `::after` y `::placeholder`), **mismas variables CSS** con los mismos valores en `:root`,
  mismo texto, título y metas.
- **Capturas idénticas al píxel** en 112 de 114; las otras dos (catálogo) difieren en 6-12 bytes, lo mismo
  que entre dos capturas de la misma build (suavizado del texto).
- **`index.html` generado idéntico** byte a byte (salvo los hashes de los assets).
- **Los 23 correos** de `server/src/utils/email.js`, con datos fijos, **idénticos byte a byte** (asunto,
  remitente, HTML y texto).

El comparador cazó un fallo real a mitad de la tarea 2: escribir `Hola {BRAND.nombre}.` en JSX crea varios
nodos de texto y Chrome los mide con diferencias de subpíxel (176 páginas con 0,016 px de diferencia). Se
arregló escribiendo cada tramo como una sola plantilla. Las herramientas están en
`/mnt/project-files/starter-kit/comparador/` del proyecto, con un `LEEME.md`.

## Qué ha cambiado

**Tarea 1.** `tokens.css` es la única fuente de la paleta: `index.css` la redefinía entera con hex y la
pisaba. Unos 140 colores sueltos de `index.css`, `Admin.css`, `AdminReservas.css` y `ProductDetail.css`
pasaron a tokens (constantes nuevas para blanco/negro, velos, botón oscuro de la ficha, insignias del panel
y grises de impresión), y esas cuatro hojas usan los nombres nuevos (`--color-*`); los alias viejos siguen
en `tokens.css` para el resto. Solo `index.css` importa `tokens.css`: las demás lo volvían a meter en sus
trozos y habrían pisado cualquier tema. El tema demo usaba `data-theme`, que es el del botón claro/oscuro:
ahora se activa importándolo detrás de `index.css` y respeta el modo oscuro. `brand.config.js` tiene los
atajos pedidos (`prefijoSKU`, `emailContacto`, `telefono`, `direccion`, `redesSociales`), que leen los
campos que ya había.

**Tarea 2.** Nombre, eslogan, ciudad, dirección, correo, web, dominio, Instagram, hashtag, razón social,
NIF y prefijo salen de `brand.config.js` en 28 archivos del cliente; `index.html` lleva marcadores
`%BRAND_...%` que rellena `vite.config.js`. En el servidor, `src/config/brand.config.js` (nuevo) alimenta los
correos de Resend (textos, logo y colores), el sitemap, los CSV, las referencias y los enlaces de
verificación. Las claves del navegador (`nave5Theme`, `nave5-cookie-consent`) no cambian de valor. Ningún
test existente ha cambiado: el texto que ven es el mismo. Dos tests nuevos (`client/src/theme/marca.test.js`
y `server/src/config/marca.test.js`) fallan si alguien vuelve a escribir la marca a mano.

**Tarea 3.** Las cuatro guías se reescribieron contra el código porque tenían errores: bucket `muebles`
(es `imagenes`), tabla `usuarios` (es `clientes`), `supabase db push`, rutas de pago inexistentes, un solo
evento del webhook (falta `checkout.session.expired`) y enlaces `file:///` a un disco de Windows.
`ENV_VARS.md` lista las 34 variables que lee el código (el commit dice 33 por error); `server/.env.example`
gana las que faltaban.

**Tarea 4.** `npm run init:client` (con `package.json` mínimo en la raíz) pregunta por consola y reescribe
las dos `brand.config.js` y `tokens.css`, con una paleta clara y oscura que pasa AA. Lo que no sabe lo deja
como `PENDIENTE`. Admite argumentos para usarlo sin preguntas.

## Hallazgos que el humano debe conocer

1. **El esquema base no está en el repositorio.** El `CREATE TABLE` de `muebles`, `categorias`, `clientes`
   y `pedidos` nunca se guardó (`server/migrations/README.md`, decisión H52). Sin él, una base de datos
   nueva no se puede montar desde el repo. Se arregla con un volcado de solo esquema de Nave 5
   (`supabase db dump --schema-only`), que esta sesión no podía hacer (regla 4).
2. **111 tests son de Nave 5.** Con la tienda inventada del script fallan 66 tests de la web (23 archivos)
   y 45 de la API (13 archivos) porque esperan «Nave 5 Barcelona», `NAV-SIL-001`, la web... La web funciona;
   hay que cambiar los textos esperados por cliente. Ninguno es un `Admin.*.test.jsx`.
3. **Quedan 110 colores sueltos** en otras 18 hojas (sobre todo `Home.css` 21, `ProductCard.css` 20,
   `AdminUI.css` 12, `ModalContacto.css` 12): la tarea pedía cuatro hojas. Con otra paleta se ven, por
   ejemplo, en el botón claro del hero.
4. **Fuera de la marca, a mano:** el logo SVG (`Logo.jsx`, «NAVE 5»), `client/public/` (favicon,
   og-image, manifest, robots, fotos del hero), `client/vercel.json` (dominio de la API y de Supabase en la
   CSP y el sitemap), los textos legales y de "Sobre nosotros". Están en `docs/NUEVO_CLIENTE.md`.
5. **Datos de ejemplo que siguen en `brand.config.js`:** teléfono `+34 930 00 00 00` (no se enseña en
   ningún sitio) y el NIF `B-00000000`, que ahora sale de `BRAND.contacto.cif`: cuando llegue el real,
   se cambia en un solo sitio y aparece en Aviso legal, Privacidad y el albarán.

## Checklist para mañana

- [ ] Leer `git log 89520bd..feat/starter-kit` y el diff de los 4 commits.
- [ ] Mirar las capturas de la tienda inventada en `/mnt/project-files/starter-kit/` (azul marino y dorado,
      generada con el script).
- [ ] Probar en local: `npm run dev` en `client/` y repasar portada, ficha, contacto, pie y panel en claro
      y oscuro (debería verse exactamente igual que hoy).
- [ ] Probar el script en una copia: `node scripts/init-client.js --dir=<copia>` y `git diff` en la copia.
- [ ] Decidir si se exporta el esquema base de Supabase al repositorio (hallazgo 1).
- [ ] Decidir si los 111 tests con textos de Nave 5 se pasan a leer la marca (hallazgo 2) y si se
      tokenizan las 18 hojas restantes (hallazgo 3), con el mismo comparador.
- [ ] Si se quiere llevar a `feature/mejoras-tecnicas`: pedir que se abra el PR (no se ha abierto).

## ¿Listo para clonar y montar otro cliente?

**La marca sí; la infraestructura todavía no del todo.** Cambiar nombre, contacto, prefijo, colores y
fuentes es `npm run init:client` más los `PENDIENTE`, y está probado: con otra marca la web compila sin
avisos y se ve con la paleta nueva en claro y oscuro. Lo que falta para montar un cliente de cero en 30
minutos es el esquema base de la base de datos (hallazgo 1), y después hay que actualizar los textos
esperados de 111 tests y cambiar a mano lo del hallazgo 4.
