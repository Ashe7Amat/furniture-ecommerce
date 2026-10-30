# Informe: Nave 5 como starter kit white-label (rama `feat/starter-kit`)

Dos sesiones autónomas el 30 oct 2026, las dos en la rama `feat/starter-kit` (creada desde
`feature/mejoras-tecnicas` en `89520bd`). No se ha tocado `main` ni `feature/mejoras-tecnicas`, no hay merge
ni PR, y no se ha conectado con Vercel, Supabase ni Stripe: todo es código local.

- **Sesión 2 (07:03-08:30 UTC):** cerrar los cuatro hallazgos de la primera. Es la sección siguiente.
- **Sesión 1 (00:20-01:40 UTC):** theme system, desacoplar la marca, guías y `init:client`. Más abajo,
  tal como se entregó, con el estado nuevo de cada hallazgo.

## Sesión 2: hallazgos cerrados

| Hallazgo de la sesión 1 | Estado | Commit |
|---|---|---|
| 3. Quedaban 110 colores sueltos en 18 hojas | ✅ **Cerrado.** Ninguna hoja ni componente lleva colores a mano: todo sale de `tokens.css` | `87df1c6` |
| 2. 111 tests (66 web, 45 API) esperaban textos de Nave 5 | ✅ **Cerrado.** Leen el valor esperado de `brand.config.js`. Con la marca de ejemplo de `init:client` pasan todos | `3651492` |
| 1. No había esquema base de la base de datos | ✅ **Cerrado, deducido del código.** `server/migrations/00_esquema_base.sql` | `ee7e251` |
| 4. Logo y archivos fuera de la marca | ✅ **Cerrado.** El logo lo elige la marca; guía clara de `client/public/` y `client/vercel.json` | `beb3686`, `5d281fc` |

### Tarea 1: el 100 % de los colores sale de `tokens.css`

- Las 18 hojas que quedaban (`Home.css`, `ProductCard.css`, `AdminUI.css`, `ModalContacto.css`...) usan
  variables. Hacían falta 20 variables nuevas en `tokens.css`, fijas en claro y oscuro: versiones `-rgb` de
  la marca para los `rgba(...)`, el fondo y la tinta del hero, el velo y el botón del contacto, la barra de
  administración y el check de éxito, entre otras. Se quitaron tres valores de reserva de `var()` que nunca
  se usaban.
- El `theme-color` de `index.html` sale de `--color-primary` al compilar (marcador `%BRAND_COLOR_TEMA%`).
- `tokens.test.js` falla si una hoja de `client/src` (las 28 o más) o un componente vuelve a escribir un
  color a mano. Dos excepciones, justificadas en el test: el QR del panel (negro sobre blanco, para que se
  lea) y el fondo blanco de las fotos JPEG.
- `init:client` deriva las variables nuevas de los colores del cliente: con otra marca no queda ningún tono
  de Nave 5 en `tokens.css` (lo comprueba su test).

### Tarea 2: los tests leen la marca

- **Web:** 66 tests en 23 archivos esperan ahora `BRAND.nombre`, `BRAND.web`, `` `${BRAND.prefijoSku}-SIL-001` ``,
  `BRAND.idInterno`... **API:** 45 tests en 13 archivos (correos, sitemap, CSV, referencias), igual.
  Ningún `Admin.*.test.jsx` congelado se ha tocado.
- `brand.config.test.js` comprueba la forma de los datos, y aparte (con `it.runIf`) que Nave 5 conserva su
  nombre, prefijo y correo. Con otra marca ese test, y el de la paleta exacta de Nave 5 en
  `tokens.test.js`, salen como omitidos: son los 2 `skipped`.
- Dos arreglos de código que salieron al desacoplar: el albarán escribía el NIF a mano (ahora
  `BRAND.contacto.cif`, y `marca.test.js` vigila el NIF), y los correos de una marca sin logo pintaban una
  imagen rota (ahora llevan el nombre en texto). Para Nave 5 los 23 correos son idénticos byte a byte.

### Tarea 3: `server/migrations/00_esquema_base.sql`

**El archivo existe** (409 líneas) y monta en un proyecto de Supabase vacío las 11 tablas que usa la API:
`categorias`, `muebles`, `clientes`, `pedidos`, `reservas`, `audit_log`, `refresh_tokens`,
`verificaciones_email`, `password_resets`, `mensajes_contacto` y `ajustes_home`. Lleva tipos, claves
primarias y foráneas, `UNIQUE`, `CHECK`, la exclusión que impide los solapes de reservas, 21 índices, 3
disparadores, RLS activado en las 11 tablas, las tres políticas de lectura pública (catálogo, categorías y
portada; lo demás solo lo toca la API con `service_role`) y el bucket `imagenes`. Va en una transacción.

- **De dónde sale:** las cuatro tablas sin `CREATE TABLE` (`categorias`, `muebles`, `clientes`, `pedidos`)
  están deducidas de las columnas que leen y escriben los controladores, los repositorios y los tests, y de
  lo que dan por existente las migraciones. El resto es copia de las 32 migraciones, ya juntadas.
- **Cómo se comprobó, en un PostgreSQL 16 local** con un esqueleto de Supabase (roles `anon`,
  `authenticated`, `service_role` y `auth.uid()`): (1) el catálogo (columnas, restricciones, índices,
  disparadores, funciones, políticas, RLS y comentarios) es igual que el de la base deducida más las 32
  migraciones aplicadas en orden; la única diferencia son 12 nombres de restricción de `reservas` que en
  Nave 5 acaban en «1», y la API no depende de ellos (reconoce los errores por su código); (2) pasa la
  prueba de las reservas `docs/reservas-sql/r2_pruebas.sql`; (3) `anon` lee el catálogo y no ve clientes ni
  pedidos.
- **No lleva historia de Nave 5:** ni `reservas_borrador`, ni la copia de respaldo, ni arreglos de datos,
  ni la categoría «Espejos», ni la extensión `http`. **No se ejecuta en la base de datos de Nave 5.**
- `esquemaBase.test.js` falla si la API empieza a usar una tabla que no está en el archivo, si una tabla
  queda sin RLS o si se cuela un dato de Nave 5.
- Guías al día: `server/migrations/README.md`, `docs/DEPLOY.md` (1.2 y 1.3), `docs/NUEVO_CLIENTE.md` (fuera
  el aviso de que el paso de Supabase no se podía hacer) y una nota en H52 de `docs/mejoras-tecnicas.md`.

### Tarea 4: logo y archivos a mano

- **`Logo.jsx` ya no lleva el dibujo:** lo elige el campo nuevo `logo` de `client/src/theme/brand.config.js`.
  Con `'texto'` (lo que deja `init:client`) pinta `BRAND.nombreCorto` en mayúsculas con la fuente de
  títulos; con `'dibujo'`, el SVG de `client/src/theme/LogoDibujo.jsx`.
- **Nave 5 sigue con `'dibujo'`:** sus letras de plantilla no son una fuente, y escribirlas como texto
  cambiaría cómo se ve, que es lo que el gate prohíbe. El dibujo es ahora un archivo de la marca, junto a
  `tokens.css` y `brand.config.js`.
- **Por qué `nombreCorto` y no `nombre`:** en Nave 5 `nombre` es «Nave 5 Barcelona» y el logo dice «NAVE 5»,
  sin Barcelona. Es lo mismo que ya hacía la API con `nombreLogo` en los correos.
- En el móvil un nombre corto largo se acorta con puntos suspensivos («STUDIO ...») para no echar los
  iconos de la cabecera fuera de la pantalla (lo cazó la captura de la tienda de ejemplo).
- `docs/NUEVO_CLIENTE.md` avisa arriba de que `init:client` no toca `client/public/` ni `client/vercel.json`,
  y tiene una sección «Archivos que se cambian a mano» con cada archivo (favicon, og-image de 1200 × 630,
  manifest, robots, fotos, sin-imagen, audio y `vercel.json`), lo que lleva de Nave 5 y qué hacer, más un
  `git grep` para comprobar que no queda nada.

### Gate de la sesión 2

| Comprobación | Nave 5 | Marca de ejemplo (`init:client`, Studio Vintage Madrid) |
|---|---|---|
| `npm run lint` cliente / servidor | 0 / 0 errores | 0 / 0 errores |
| `prettier --check` servidor y `scripts/` | limpio | limpio |
| `npm run build` | 0 avisos | 0 avisos |
| Tests del cliente (Vitest) | **2329 en 147 archivos**, 0 fallos | **2323 y 2 omitidos**, 0 fallos |
| Cobertura del cliente | 99,28 % líneas, 96,89 % ramas | — |
| Tests del servidor (`npm test`) | **1565**, 0 fallos | **1564**, 0 fallos |
| Cobertura del servidor (`test:coverage`) | pasa (99,28 % líneas) | — |
| Tests de `scripts/` | **6**, 0 fallos | **6**, 0 fallos |
| `Admin.*.test.jsx` congelados | sin tocar | sin tocar |

La marca de ejemplo se generó con `node scripts/init-client.js ... --si` en una copia limpia del repo, sin
tocar ningún test a mano. Sus capturas (con el logo en texto) están en `/mnt/project-files/starter-kit/`.

**Verificación visual de Nave 5**, con el comparador de la sesión 1 contra la build de `89520bd`, después de
la última modificación de CSS: **estilos calculados idénticos en los 28.747 elementos de las 114 páginas**,
mismas variables con los mismos valores (más las 20 nuevas), mismo texto, títulos y metas; capturas idénticas
al píxel en 113 de 114, y la otra (catálogo) con 6 bytes de diferencia, el mismo ruido de suavizado que
entre dos capturas de una misma build (6-16 bytes). `index.html` idéntico salvo los hashes de los assets.
Los 23 correos, idénticos byte a byte.

### Lo que queda (sesión 2)

1. **`00_esquema_base.sql` está deducido, no volcado.** Comprobado contra las migraciones, no contra la base
   real. Los tipos exactos de las cuatro tablas base (`varchar` o `text`, `numeric(10,2)`), sus valores por
   defecto y sus `UNIQUE`/`CHECK` conviene contrastarlos con `supabase db dump --schema-only` o una consulta
   de solo lectura a `information_schema`. Esta sesión no lo hizo (sin conexión a Supabase); se puede hacer
   en solo lectura con tu OK escrito.
2. **Lo que sigue a mano para cada cliente:** `client/public/`, `client/vercel.json`, el `preconnect` de
   `index.html`, los textos legales y de Sobre nosotros, y el logo de los correos (sin él, va el nombre en
   texto). Todo en `docs/NUEVO_CLIENTE.md`.
3. **Datos de ejemplo de Nave 5:** el teléfono `+34 930 00 00 00` y el NIF `B-00000000` siguen en
   `brand.config.js` (el NIF real sale ya en un solo sitio).

### ¿Listo para clonar y montar otro cliente?

**Sí, con lo de «a mano» de la guía.** `npm run init:client` cambia marca, paleta y logo; la web compila sin
avisos, los tests pasan en verde sin tocarlos, y la base de datos se monta con un archivo. Faltan las
imágenes y dominios de `client/public/` y `client/vercel.json`, que dependen del cliente, y contrastar el
esquema deducido con un volcado real (punto 1).

---

# Sesión 1 (00:20-01:40 UTC)

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

1. ✅ *Cerrado en la sesión 2 (`ee7e251`).* **El esquema base no está en el repositorio.** El `CREATE TABLE` de `muebles`, `categorias`, `clientes`
   y `pedidos` nunca se guardó (`server/migrations/README.md`, decisión H52). Sin él, una base de datos
   nueva no se puede montar desde el repo. Se arregla con un volcado de solo esquema de Nave 5
   (`supabase db dump --schema-only`), que esta sesión no podía hacer (regla 4).
2. ✅ *Cerrado en la sesión 2 (`3651492`).* **111 tests son de Nave 5.** Con la tienda inventada del script fallan 66 tests de la web (23 archivos)
   y 45 de la API (13 archivos) porque esperan «Nave 5 Barcelona», `NAV-SIL-001`, la web... La web funciona;
   hay que cambiar los textos esperados por cliente. Ninguno es un `Admin.*.test.jsx`.
3. ✅ *Cerrado en la sesión 2 (`87df1c6`).* **Quedan 110 colores sueltos** en otras 18 hojas (sobre todo `Home.css` 21, `ProductCard.css` 20,
   `AdminUI.css` 12, `ModalContacto.css` 12): la tarea pedía cuatro hojas. Con otra paleta se ven, por
   ejemplo, en el botón claro del hero.
4. ✅ *Cerrado en la sesión 2 (`beb3686`): el logo lo elige la marca y lo demás está en la guía.* **Fuera de la marca, a mano:** el logo SVG (`Logo.jsx`, «NAVE 5»), `client/public/` (favicon,
   og-image, manifest, robots, fotos del hero), `client/vercel.json` (dominio de la API y de Supabase en la
   CSP y el sitemap), los textos legales y de "Sobre nosotros". Están en `docs/NUEVO_CLIENTE.md`.
5. **Datos de ejemplo que siguen en `brand.config.js`:** teléfono `+34 930 00 00 00` (no se enseña en
   ningún sitio) y el NIF `B-00000000`, que ahora sale de `BRAND.contacto.cif`: cuando llegue el real,
   se cambia en un solo sitio y aparece en Aviso legal, Privacidad y el albarán.

## Checklist para mañana (sesión 1; los dos «Decidir» ya están resueltos en la sesión 2)

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

## ¿Listo para clonar y montar otro cliente? (sesión 1; la respuesta al día está arriba)

**La marca sí; la infraestructura todavía no del todo.** Cambiar nombre, contacto, prefijo, colores y
fuentes es `npm run init:client` más los `PENDIENTE`, y está probado: con otra marca la web compila sin
avisos y se ve con la paleta nueva en claro y oscuro. Lo que falta para montar un cliente de cero en 30
minutos es el esquema base de la base de datos (hallazgo 1), y después hay que actualizar los textos
esperados de 111 tests y cambiar a mano lo del hallazgo 4.
