# Sesión autónoma (7 oct 2026, 2): clientes en CSV, logo de los correos, miniaturas y SEO por ficha

Rama `feature/mejoras-tecnicas`, desde `73dcd2a` (el merge del 7 oct, que es lo que hay en producción). Al empezar,
la rama estaba en `b785b88`, con el mismo árbol que `main`: se avanzó a `73dcd2a` sin tocar `main` (fast-forward).
El usuario no estaba delante. Sin merge: producción sigue en `73dcd2a`.

## En resumen

- **Hechas, cada una con su gate, su commit y su push:**
  - Tarea 1: exportar clientes a CSV.
  - Tarea 2: logo PNG en la cabecera de los correos.
  - Tarea 3: miniaturas para las tarjetas del catálogo (opción B; las 88 piezas de antes, pendientes).
  - Tarea 4: descripción y og:image por ficha (solo en el navegador).
- **Paradas:** ninguna entera. De la tarea 3 queda la parte que necesita escribir en Storage y en la base de datos
  (opción C, H61). H58 estaba fuera de la sesión y **no se ha tocado**.
- **Gate:** un fallo, en la tarea 3: el proceso de Node de un archivo de test del servidor se cerró en seco con la
  cobertura activada (H60, no es un test que falle). Se repitió ese paso y pasó. Detalle abajo.
- **Tests:** cliente de 844 a 871; servidor de 557 a 575; E2E de 56 a 60.
- **Mutantes del panel:** 127, "Todos los mutantes detectados" (126 y el superviviente esperado).
- **`main`, Vercel y la base de datos, sin tocar.** Storage: solo los dos PNG del logo (autorizado).

## `git log --oneline -10`

Este informe va en el commit siguiente, `docs: cierre de la sesión de SEO e imágenes`.

```
1494162 feat(client): meta description y og:image por producto
0a7cfc3 perf(client): servir imágenes optimizadas en las tarjetas del catálogo
156f5a0 style(server): usar el logo real en la cabecera de los emails
3777707 feat(admin): exportar clientes a CSV
73dcd2a Merge branch 'feature/mejoras-tecnicas'
b785b88 docs: cierre de la sesión de accesibilidad y fotos
f9e1812 feat(admin): reordenar fotos y marcar portada en el editor (H57)
8f99ff5 test(e2e): congelar el reloj en el test del hero (H59)
cd7f438 fix(client): contraste en estados hover y foco del AuthModal (H56)
0c6d7dc fix(client): role dialog y gestión de foco en los modales (H55)
```

## Cobertura, antes y después

Medida al empezar sobre `73dcd2a` (salida guardada) y en el gate del último commit.

| | Líneas | Ramas | Funciones | Tests | Umbral |
|---|---|---|---|---|---|
| Cliente, antes (`73dcd2a`) | 98,76 % | 95,79 % | 93,68 % | 844 | 97 / 95 / 92 |
| Cliente, después (`1494162`) | 98,78 % | 95,95 % | 93,76 % | 871 | 97 / 95 / 92 |
| Servidor, antes (`73dcd2a`) | 99,06 % | 91,82 % | 99,54 % | 557 | 98 / 91 / 99 |
| Servidor, después (`1494162`) | 99,31 % | 92,15 % | 99,54 % | 575 | 98 / 91 / 99 |

Umbrales sin cambios. E2E: 60/60 (antes 56).

## Gate

Cada comando en su propia llamada, uno detrás de otro (nunca en paralelo), y la salida entera guardada en un
archivo antes de leerla. La salida literal de cada comando de cada commit está en el anexo, al final; los archivos
completos, en el scratchpad de la sesión (`sesion-seo/gate-N-*/`).

| Commit | Cliente: lint | Cliente: tests y cobertura | Servidor: lint, formato | Servidor: tests y cobertura | E2E |
|---|---|---|---|---|---|
| `3777707` tarea 1 | 0 errores | 852/852 · 98,77 / 95,81 / 93,73 | ✓ ✓ | 566/566 · 99,07 / 91,89 / 99,54 | 57/57 |
| `156f5a0` tarea 2 | 0 errores | 852/852 · 98,77 / 95,81 / 93,73 | ✓ ✓ | 566/566 · 99,07 / 91,89 / 99,54 | — (sin cambios en el cliente) |
| `0a7cfc3` tarea 3 | 0 errores | 859/859 · 98,77 / 95,93 / 93,75 | ✓ ✓ | 575/575 · 99,31 / 92,15 / 99,54 (2.ª vez; ver abajo) | 58/58 |
| `1494162` tarea 4 | 0 errores | 871/871 · 98,78 / 95,95 / 93,76 | ✓ ✓ | 575/575 · 99,31 / 92,15 / 99,54 | 60/60 |

El cliente no tiene `format:check` (solo el servidor).

- **Tarea 1:** el primer gate del servidor dio 91,78 % de ramas (por encima del 91, pero por debajo del 91,82 de
  partida) por una rama sin probar del controlador nuevo (`data || []`). Se añadió el test y se repitió la parte
  del servidor: 91,89. No fue un fallo; la salida de esa primera vuelta se sobrescribió con la segunda.
- **Tarea 3, el único fallo de la sesión:** `npm run test:coverage` del servidor dio 567 tests y 1 fallo:
  `controladoresErrores.test.js`, un archivo que no tiene nada que ver con las miniaturas, contado entero como
  un fallo y sin ningún detalle ("test failed"). Es H60 (ver "Hallazgos"):
  - el proceso de Node de ese archivo se cerró en seco (`exitCode: 3221226505`, `0xC0000409`);
  - no es un test que falle.
  - Se diagnosticó antes de repetir nada: lo mismo en 1 de 5 ejecuciones completas y en 1 de 30 de otro archivo
    solo.
  - Después se repitió el paso del gate: 575/575. Las dos salidas están guardadas y en el anexo.
  - Era el primer fallo del gate en esa tarea, así que la regla de parar con dos fallos seguidos no llegó a
    aplicarse.

## Tareas

### 1. Exportar clientes a CSV (`3777707`)

- **Servidor:** `GET /api/admin/clientes/export`, con `verificarAdmin`.
  - Columnas `id`, `email`, `nombre`, `rol` y `creado_en`, las de `clientes` según
    `docs/verificacion-email-diseno.md` (comprobado el 29 sep).
  - Se piden una a una, nunca `select('*')`: la contraseña (el hash) no sale nunca.
  - Mismo formato que el CSV del catálogo (`utils/csv.js`): BOM UTF-8, punto y coma, CRLF y apóstrofo delante de
    lo que Excel tomaría por fórmula.
  - Nombre `clientes-nave5-AAAA-MM-DD.csv` (fecha de Madrid). Sin caché: son datos personales.
- **Panel:** no hay pestaña de clientes, así que va en una sección "Clientes" al final del Resumen, con el botón
  "Exportar clientes (CSV)" y una línea que dice qué lleva el archivo.
- **Tests:** 9 del servidor (BOM, cabeceras en orden, 401/403, sin `password` ni hash, orden, fórmulas, vacío,
  `data` a null, 500), 4 de la llamada a la API, 4 del botón y un E2E que descarga el archivo de verdad en Chrome
  y compara su contenido.
- **Comprobado que el test de la contraseña sirve:** con `password` añadida a las columnas, fallan 4.

### 2. Logo PNG en la cabecera de los correos (`156f5a0`)

- **Generado con sharp** (que lee SVG con librsvg) desde el SVG de `client/src/components/Logo.jsx`, en `#F5F2EC` y
  fondo transparente: `logo-nave5.png` (240 × 90) y `logo-nave5@2x.png` (480 × 179). El script queda en
  `server/scripts/logo-email.js`, para rehacerlos.
- **Subidos a Supabase Storage** (bucket `imagenes`, carpeta `marca/`, que no existía), sin pisar nada. URLs
  públicas:
  - <https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5.png>
  - <https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5@2x.png>
  - Descargadas de vuelta: 200, `image/png` e idénticas byte a byte a las generadas.
- **`server/src/utils/email.js`:** la cabecera (la comparten las dos plantillas, contacto y confirmación) lleva
  `<img src="…logo-nave5.png" srcset="…logo-nave5@2x.png 2x" alt="NAVE 5" width="120"
  style="display:block;border:0;outline:none;height:auto;max-width:120px;">`, tal cual pedía la tarea. La celda
  conserva su estilo, así que con las imágenes bloqueadas el texto alternativo sale como antes salía "NAVE 5".
- **Visto en Chrome** con el correo de contacto renderizado: el logo en la cabecera oscura, a 120 × 45, y con los PNG
  bloqueados, "NAVE 5" en su lugar.
- **Tests:**
  - la única `<img>` de las dos plantillas es el logo (src, srcset, alt, ancho, estilo y celda oscura);
  - los de escape (H2) quitan solo esa etiqueta y siguen exigiendo que no se cuele ninguna otra;
  - sin el `alt`, fallan 2.

### 3. Imágenes de las tarjetas del catálogo (`0a7cfc3`): opción B; la C, pendiente

- **El problema, medido** (HEAD de las 88 portadas en producción): 25,2 MB en total, media 293 KB, mediana 314 KB;
  solo una baja de 60 KB.
- **Opción A, no disponible:** `/storage/v1/render/image/...?width=400&quality=80` responde
  `403 FeatureNotEnabled`. Según la documentación de Supabase es de los planes de pago ("Pro Plan and above": 100
  imágenes de origen al mes incluidas y 5 USD por cada 1.000 más).
- **Opción B, hecha:**
  - Al crear o editar un mueble con fotos, el servidor guarda también una miniatura de 400 px.
  - La grande pasa a llamarse `<base>-full.webp` y la miniatura `<base>-thumb.webp`. La miniatura se sube antes; si
    falla, la foto se guarda sin ella y con su nombre de siempre.
  - El cliente (`miniatura(url)` en `utils/images.js`) la usa en las tarjetas (cuadrícula y lista) solo para las
    fotos `-full.webp`. La ficha y la vista rápida siguen con la grande.
- **Medido con fotos reales:** las 5 portadas más pesadas y la mediana (316-499 KB) dan miniaturas de 26 a 52 KB.
- **E2E en móvil (Pixel 5):** la tarjeta baja solo la miniatura (26 KB, menos de 60) y la ficha, la grande
  (359 KB). Con la tarjeta pidiendo la grande, el E2E falla.
- **Lo que falta (opción C, H61):** las 88 piezas de antes no tienen miniatura. Generarlas escribe 344 archivos en
  Storage y cambia las URLs de 88 fichas: fuera de lo autorizado en esta sesión.
- **No cuadraba con la tarea:** "las 88 piezas tienen una sola versión de cada foto (WebP, máximo 1600px)". De las
  172 fotos, 160 son JPG, que no pasaron por la optimización del servidor (que las guarda en WebP), y 12 WebP. Medidas
  sueltas: tres JPG de 1400 px de ancho y tres WebP en vertical de 1440 × 1920 (H62).

### 4. Descripción y og:image por ficha (`1494162`)

- **No cuadraba del todo con la tarea:** `useDocumentMeta` ya aceptaba título, descripción e imagen (`image`), y
  `ProductDetail` ya los pasaba. Por eso no se ha tocado el hook. Cambia lo que pasa la ficha:
  - descripción: el principio de la de la pieza, 150 caracteres como mucho y cortada en un espacio (antes iba
    entera); sin descripción, "{nombre} — pieza única disponible en Nave 5 Barcelona." (antes, una frase fija);
  - og:image y twitter:image: la primera foto de la pieza aunque se mire otra (antes seguía a la foto elegida, y
    sin fotos era la imagen de "sin foto"; ahora, la de la web);
  - título: "{nombre} | Nave 5 Barcelona" (ya era así).
- **Tests:**
  - el resumen de la descripción;
  - la ficha: título, descripción, og:image, al pasar a otra ficha y al salir (con el código de antes fallan 4);
  - dos E2E: uno en el navegador y otro que pide el HTML de una ficha tal cual se sirve y comprueba que sigue con
    las etiquetas de la portada.
- **Limitación (H34, sigue pendiente):** WhatsApp, Facebook, LinkedIn o X leen ese HTML sin ejecutar JavaScript, así
  que las vistas previas siguen siendo las de la portada. Lo arreglaría prerenderizar las fichas o servirlas con un
  render en el servidor.

### 5. Cierre

- `docs/mejoras-tecnicas.md`:
  - resumen de la sesión arriba del todo;
  - H34 (sigue pendiente; la tarea 4 solo mejora lo del navegador), H60 (datos nuevos), H61 y H62;
  - la sesión anterior, marcada como mergeada.
- Este informe.

## Hallazgos

- **H60, con datos nuevos (VIGILAR):**
  - el fallo suelto es el proceso de Node de un archivo de test que se cierra en seco (`0xC0000409`) con la
    cobertura activada, en archivos distintos cada vez;
  - 2 de 6 ejecuciones completas aquí (Windows, Node 24.15); 0 en las 6 últimas del CI (Ubuntu, Node 22);
  - sin causa encontrada: un test trivial, uno que solo carga sharp y la app sin sharp, 0 de 40 cada uno;
  - pasos siguientes en H60.
- **H61 (en parte):** miniaturas para las tarjetas; faltan las de las fotos de antes (opción C) y otras vistas
  pequeñas (tira de la ficha, cesta, favoritos, panel).
- **H62 (anotado):** las fotos en vertical se guardan a 1440 × 1920: el servidor limita el ancho y no el lado
  mayor. Propuesta en H62; no se ha cambiado.

## Fuera del repositorio: lo que se ha leído y escrito

- **Escrito:** solo los dos PNG del logo en Supabase Storage (`imagenes/marca/`), lo autorizado para la tarea 2.
- **Leído (sin escribir nada):**
  - el listado de las carpetas de `imagenes/` y de `imagenes/marca/`;
  - HEAD de las 88 portadas y la descarga de 6 fotos, para medir;
  - una petición de prueba a la URL de transformación (403);
  - el catálogo público ya se había descargado (`GET /api/muebles`) al comprobar producción tras el merge, antes
    de empezar.
- **Base de datos:** ni consultas ni cambios en esta sesión.
- **`main`:** en `73dcd2a` en local y en origin, sin tocar.
- **Vercel:** sin tocar.

## Para el usuario

1. **Merge a `main`, cuando quiera.** No añade dependencias. Después:
   - Mandar un mensaje desde el formulario de contacto y mirar el correo en Gmail: el logo en la cabecera.
   - Subir una foto a una pieza de prueba desde el panel y mirar el catálogo en el móvil: la tarjeta debería pedir
     la `-thumb.webp`.
   - Exportar los clientes desde el Resumen y abrir el CSV en Excel.
2. **H61:**
   - **opción C:** generar las miniaturas de las 172 fotos de antes. Escribe en Storage y en la base de datos;
     necesita su permiso expreso y una sesión para ello;
   - **u opción A:** el plan de pago de Supabase.
3. **H34:** si importan las vistas previas al compartir una ficha por WhatsApp, decidir prerenderizado o SSR.
4. **H60:** nada urgente. Si molesta, probar con Node 22 en este equipo.
5. **H58** (fotos cruzadas): **no se ha tocado**. Queda para usted con el cliente.

## Anexo: salida del gate de cada commit

La salida tal cual la escribió cada comando (sin los códigos de color): entera la de lint y formato, y el bloque
final de los tests, la cobertura, los E2E y los mutantes.

<details>
<summary>`3777707` feat(admin): exportar clientes a CSV</summary>

**Cliente: `npm run lint`**

```
> client@0.0.0 lint
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
```

**Cliente: `npm test`**

```
Test Files  70 passed (70)
      Tests  852 passed (852)
   Start at  03:27:36
   Duration  16.33s (transform 3.60s, setup 21.57s, collect 20.61s, tests 87.25s, environment 131.74s, prepare 12.11s)
```

**Cliente: `npm run test:coverage`**

```
Test Files  70 passed (70)
      Tests  852 passed (852)
   Start at  03:27:58
   Duration  19.89s (transform 3.66s, setup 22.22s, collect 21.81s, tests 124.79s, environment 140.67s, prepare 13.75s)

=============================== Coverage summary ===============================
Statements   : 98.77% ( 5884/5957 )
Branches     : 95.81% ( 1762/1839 )
Functions    : 93.73% ( 374/399 )
Lines        : 98.77% ( 5884/5957 )
================================================================================

All files          |   98.77 |    95.81 |   93.73 |   98.77 |
```

**Servidor: `npm run lint`**

```
> server@1.0.0 lint
> eslint src/
```

**Servidor: `npm test`**

```
ℹ tests 566
ℹ suites 135
ℹ pass 566
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3725.9844
```

**Servidor: `npm run format:check`**

```
> server@1.0.0 format:check
> prettier --check src/

Checking formatting...
All matched files use Prettier code style!
```

**Servidor: `npm run test:coverage`**

```
ℹ tests 566
ℹ suites 135
ℹ pass 566
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4161.7203
ℹ all files                  |  99.07 |    91.89 |   99.54 |
```

**E2E (Playwright con Chrome)**

```
57 passed (24.9s)
```

**Mutantes del panel (`node scripts/mutantes-panel.js`)**

```
MATADO (2)      control: una pieza sin estado deja de contar como disponible
(126 líneas MATADO en las listas)
SOBREVIVE (esperado: el caso B cruza dos pestañas y lo cubre Admin.navegacion.test.jsx)  caso B: pisa la categoría que ya había elegido el usuario
Todos los mutantes detectados.
```

</details>

<details>
<summary>`156f5a0` style(server): usar el logo real en la cabecera de los emails</summary>

**Cliente: `npm run lint`**

```
> client@0.0.0 lint
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
```

**Cliente: `npm test`**

```
Test Files  70 passed (70)
      Tests  852 passed (852)
   Start at  03:46:44
   Duration  16.69s (transform 3.69s, setup 22.33s, collect 20.34s, tests 88.83s, environment 134.08s, prepare 12.28s)
```

**Cliente: `npm run test:coverage`**

```
Test Files  70 passed (70)
      Tests  852 passed (852)
   Start at  03:47:07
   Duration  20.08s (transform 3.46s, setup 22.34s, collect 21.70s, tests 126.31s, environment 144.05s, prepare 13.95s)

=============================== Coverage summary ===============================
Statements   : 98.77% ( 5884/5957 )
Branches     : 95.81% ( 1762/1839 )
Functions    : 93.73% ( 374/399 )
Lines        : 98.77% ( 5884/5957 )
================================================================================

All files          |   98.77 |    95.81 |   93.73 |   98.77 |
```

**Servidor: `npm run lint`**

```
> server@1.0.0 lint
> eslint src/
```

**Servidor: `npm test`**

```
ℹ tests 566
ℹ suites 135
ℹ pass 566
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3795.2783
```

**Servidor: `npm run format:check`**

```
> server@1.0.0 format:check
> prettier --check src/

Checking formatting...
All matched files use Prettier code style!
```

**Servidor: `npm run test:coverage`**

```
ℹ tests 566
ℹ suites 135
ℹ pass 566
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4165.3129
ℹ all files                  |  99.07 |    91.89 |   99.54 |
```

</details>

<details>
<summary>`0a7cfc3` perf(client): servir imágenes optimizadas en las tarjetas del catálogo</summary>

**Cliente: `npm run lint`**

```
> client@0.0.0 lint
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
```

**Cliente: `npm test`**

```
Test Files  70 passed (70)
      Tests  859 passed (859)
   Start at  03:52:58
   Duration  16.53s (transform 3.97s, setup 22.05s, collect 20.71s, tests 89.02s, environment 132.38s, prepare 12.14s)
```

**Cliente: `npm run test:coverage`**

```
Test Files  70 passed (70)
      Tests  859 passed (859)
   Start at  03:53:21
   Duration  19.96s (transform 3.62s, setup 21.91s, collect 22.78s, tests 125.05s, environment 142.19s, prepare 13.91s)

=============================== Coverage summary ===============================
Statements   : 98.77% ( 5893/5966 )
Branches     : 95.93% ( 1768/1843 )
Functions    : 93.75% ( 375/400 )
Lines        : 98.77% ( 5893/5966 )
================================================================================

All files          |   98.77 |    95.93 |   93.75 |   98.77 |
```

**Servidor: `npm run lint`**

```
> server@1.0.0 lint
> eslint src/
```

**Servidor: `npm test`**

```
ℹ tests 575
ℹ suites 137
ℹ pass 575
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3957.0106
```

**Servidor: `npm run format:check`**

```
> server@1.0.0 format:check
> prettier --check src/

Checking formatting...
All matched files use Prettier code style!
```

**Servidor: `npm run test:coverage` (1.ª vez: el proceso de un archivo se cerró en seco, H60)**

```
ℹ tests 567
ℹ suites 134
ℹ pass 566
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4236.7257
ℹ all files                  |  98.98 |    91.30 |   99.54 | 

✖ failing tests:

test at src\__tests__\controladoresErrores.test.js:1:1
✖ src\__tests__\controladoresErrores.test.js (1631.1063ms)
```

**Servidor: `npm run test:coverage`**

```
ℹ tests 575
ℹ suites 137
ℹ pass 575
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4209.6882
ℹ all files                  |  99.31 |    92.15 |   99.54 |
```

**E2E (Playwright con Chrome)**

```
58 passed (25.5s)
```

</details>

<details>
<summary>`1494162` feat(client): meta description y og:image por producto</summary>

**Cliente: `npm run lint`**

```
> client@0.0.0 lint
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
```

**Cliente: `npm test`**

```
Test Files  71 passed (71)
      Tests  871 passed (871)
   Start at  04:01:49
   Duration  16.71s (transform 3.17s, setup 22.34s, collect 21.39s, tests 89.23s, environment 134.55s, prepare 12.15s)
```

**Cliente: `npm run test:coverage`**

```
Test Files  71 passed (71)
      Tests  871 passed (871)
   Start at  04:02:12
   Duration  20.30s (transform 3.75s, setup 22.71s, collect 22.50s, tests 126.28s, environment 146.25s, prepare 14.24s)

=============================== Coverage summary ===============================
Statements   : 98.78% ( 5912/5985 )
Branches     : 95.95% ( 1781/1856 )
Functions    : 93.76% ( 376/401 )
Lines        : 98.78% ( 5912/5985 )
================================================================================

All files          |   98.78 |    95.95 |   93.76 |   98.78 |
```

**Servidor: `npm run lint`**

```
> server@1.0.0 lint
> eslint src/
```

**Servidor: `npm test`**

```
ℹ tests 575
ℹ suites 137
ℹ pass 575
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3989.5808
```

**Servidor: `npm run format:check`**

```
> server@1.0.0 format:check
> prettier --check src/

Checking formatting...
All matched files use Prettier code style!
```

**Servidor: `npm run test:coverage`**

```
ℹ tests 575
ℹ suites 137
ℹ pass 575
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4219.2847
ℹ all files                  |  99.31 |    92.15 |   99.54 |
```

**E2E (Playwright con Chrome)**

```
60 passed (26.5s)
```

</details>
<details>
<summary>Este commit: docs: cierre de la sesión de SEO e imágenes (solo documentación)</summary>

**Cliente: `npm run lint`**

```
> client@0.0.0 lint
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
```

**Cliente: `npm test`**

```
Test Files  71 passed (71)
      Tests  871 passed (871)
   Start at  04:07:59
   Duration  16.95s (transform 3.87s, setup 22.25s, collect 21.96s, tests 88.50s, environment 136.89s, prepare 12.81s)
```

**Cliente: `npm run test:coverage`**

```
Test Files  71 passed (71)
      Tests  871 passed (871)
   Start at  04:08:22
   Duration  20.51s (transform 3.59s, setup 23.19s, collect 22.66s, tests 127.16s, environment 147.34s, prepare 14.43s)

=============================== Coverage summary ===============================
Statements   : 98.78% ( 5912/5985 )
Branches     : 95.95% ( 1778/1853 )
Functions    : 93.76% ( 376/401 )
Lines        : 98.78% ( 5912/5985 )
================================================================================

All files          |   98.78 |    95.95 |   93.76 |   98.78 |
```

**Servidor: `npm run lint`**

```
> server@1.0.0 lint
> eslint src/
```

**Servidor: `npm test`**

```
ℹ tests 575
ℹ suites 137
ℹ pass 575
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3957.4435
```

**Servidor: `npm run format:check`**

```
> server@1.0.0 format:check
> prettier --check src/

Checking formatting...
All matched files use Prettier code style!
```

**Servidor: `npm run test:coverage`**

```
ℹ tests 575
ℹ suites 137
ℹ pass 575
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4282.4488
ℹ all files                  |  99.31 |    92.15 |   99.54 |
```

</details>
