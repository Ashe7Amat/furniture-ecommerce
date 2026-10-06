# Informe de la sesión UX (5 oct 2026, noche)

Rama `feature/mejoras-tecnicas`, desde `a33c742`. El usuario no estaba delante. Producción sigue en `035cffa`.

## En resumen

- **Hechas:** las 5 tareas (H41, H43, H45, H38 y H42), cada una con su commit, su gate en verde y su push.
  H38 queda resuelto en parte: faltan las tablas base, que necesitan al usuario (abajo).
- **Paradas:** ninguna.
- **Tests:**
  - cliente: de 737 a 796;
  - servidor: 556, sin cambios (esta sesión no ha tocado el servidor);
  - E2E: de 19 a 26.
- **Cobertura:** sube un poco en el cliente; los umbrales no se tocan.
- **Mutantes del panel:** 127, como antes: 126 detectados y 1 superviviente esperado (más el de control, que muere
  en la comprobación previa). Pasados al final, sobre `498e0c3`: "Todos los mutantes detectados".
- **Ni `main`, ni Vercel se han tocado. La base de datos, solo leída** (`schema_migrations`, para H38).

## `git log --oneline -15`

Este informe va en el commit siguiente, `docs: cierre de la sesión UX`.

```
498e0c3 perf(client): versiones optimizadas de las fotos del hero (H42)
f5070b8 docs: recuperar las migraciones antiguas en el repositorio (H38)
a49c25d fix(client): volver a la página pedida tras login (H45)
329a947 fix(client): corregir jerarquía de títulos y h1 en login (H43)
5babdb3 fix(client): categorías del catálogo accesibles por teclado (H41)
a33c742 docs: anotar H46 (actions de Node 20 en CI)
6d50358 docs: anotar H45 (volver a la página pedida tras login)
432b0ea test(server): el tope del carrito coincide en servidor y cliente
f979d4e docs: límite del carrito aprobado y análisis de react-router (H44)
d059023 test(client): esperar a los modales de la cesta, que se cargan bajo demanda
eca998d docs: cierre de la sesión autónoma
ab0c623 test: cubrir áreas con cobertura baja
72c8b2e perf(client): lazy loading de rutas grandes
5db945b fix(client): mejoras de accesibilidad
9849118 feat(admin): paginar la lista de pedidos (H37)
```

## Gate de cada commit

Cada comando, en su propia llamada, leyendo la salida entera antes del commit.

| Commit | Cliente: lint | Cliente: tests y cobertura (líneas / ramas / funciones) | Cliente: build | Servidor: lint, formato | Servidor: tests y cobertura | E2E |
|---|---|---|---|---|---|---|
| `5babdb3` H41 | 0 errores | 743/743 · 98,39 / 95,67 / 93,02 | ✓ | 0 · ✓ | 556/556 · 99,06 / 91,82 / 99,54 | — |
| `329a947` H43 | 0 errores | 752/752 · 98,62 / 95,68 / 93,02 | ✓ | 0 · ✓ | 556/556 · 99,06 / 91,82 / 99,54 | 25/25 |
| `a49c25d` H45 | 0 errores (al segundo intento, ver abajo) | 782/782 · 98,63 / 95,71 / 93,06 | ✓ | 0 · ✓ | 556/556 · 99,06 / 91,82 / 99,54 | 26/26 |
| `f5070b8` H38 | 0 errores | 782/782 · 98,63 / 95,71 / 93,06 | ✓ | 0 · ✓ | 556/556 · 99,06 / 91,82 / 99,54 | — |
| `498e0c3` H42 | 0 errores | 796/796 · 98,63 / 95,71 / 93,06 | ✓ | 0 · ✓ | 556/556 · 99,06 / 91,82 / 99,54 | 26/26 |

**Un fallo del gate**, en H45 (no dos seguidos): el lint del cliente marcó `history` sin `window.` en el E2E
(`no-restricted-globals`) y una expresión regular con caracteres de control (`no-control-regex`). Se arregló
(`window.history` y `\p{Cc}`), y el segundo intento salió en verde.

Los avisos que salen en los tests (los "Future Flag" de React Router y los `act(...)` de `Profile` y `Header`)
son los de antes de la sesión: los mismos, en los mismos tests.

## Cobertura, antes y después

| | Líneas | Ramas | Funciones | Umbral |
|---|---|---|---|---|
| Cliente, antes (`a33c742`) | 98,39 % (5 588/5 679) | 95,67 % (1 660/1 735) | 93,02 % (347/373) | 97 / 95 / 92 |
| Cliente, después (`498e0c3`) | 98,63 % (5 628/5 706) | 95,71 % (1 675/1 750) | 93,06 % (349/375) | 97 / 95 / 92 |
| Servidor, antes y después | 99,06 % | 91,82 % | 99,54 % | 98 / 91 / 99 |

## Tareas

### 1. H41: categorías del catálogo con el teclado (`5babdb3`)

- Cada categoría es un `<button type="button" aria-pressed>`: tabulador, Enter y Espacio. La foto, con
  `alt=""`, como en la portada.
- El CSS quita el aspecto de botón del navegador, así que se ve igual. Con el foco, se eleva como con el ratón.
- **Tests:** Enter, Espacio, el tabulador, `aria-pressed`, y las reglas de foco del CSS.
  - Estas últimas van en un test aparte, con entorno node: jsdom no calcula `:focus-visible`, y Vitest no
    procesa el CSS (un `import` con `?raw` llega vacío).
  - El test de la foto genérica lleva `CAMBIADO A PROPÓSITO`.

### 2. H43: orden de los títulos y `h1` en el inicio de sesión (`329a947`)

- **Antes de tocar nada:**
  - el esquema de títulos de 13 páginas y 4 paneles abiertos, sacado del navegador;
  - los avisos de axe: faltaba el `h1` en el login, y había saltos en el catálogo, Contacto y el pie (este
    último, en todas las páginas).
- **Cambios:**
  - login: el título pasa a `h1`;
  - pie: `h3`/`h4` pasan a `h2`;
  - nombre de las piezas del catálogo: pasa a `h2`;
  - Contacto: los bloques pasan a `h2`;
  - Mi cuenta, la cesta y los paneles de la cabecera: un nivel menos.
- **Sin cambios a la vista:**
  - El CSS sigue a la etiqueta. Varias reglas solo fijaban `margin-bottom`, y el `margin-top` lo ponía el
    navegador según el nivel. Ahora se fija a mano.
  - En Contacto, `.info-content h2` le habría puesto la tipografía de los títulos.
  - Medido con Playwright: 16 propiedades calculadas de cada título, iguales antes y después, a 1280 y
    a 375 px.
- **Tests:**
  - un `h1` y sin saltos en 8 páginas, con cabecera, pie y cesta. Se comprobó que fallan con los niveles
    de antes;
  - `h1` en "Crear una cuenta";
  - en el E2E, `heading-order` y `page-has-heading-one` de axe, que antes no contaban por ser moderados.

### 3. H45: volver a la página pedida tras iniciar sesión (`a49c25d`)

- **Cómo funciona:**
  - `ProtectedRoute` manda al login con la ruta en el `state` (no en la URL);
  - `Login` vuelve a ella con `replace`, con contraseña, registro y Google;
  - `utils/rutaInterna.js` solo acepta rutas de la web.
- **Decisión:** la ruta guardada incluye el `?tab=...`, no solo el `pathname` que decía la tarea. Si no, el
  botón "Ver mi pedido" del correo (`/cuenta?tab=pedidos`) volvería a "Mis Datos". H45 ya lo pedía.
- **Validación:** se rechazan `https://…`, `//…`, `/\…`, espacios y caracteres de control. El navegador quita
  los tabuladores de una URL, así que `/\t/otra.web` acabaría siendo `//otra.web`.
- **Tests:**
  - 22 casos de `rutaInterna`;
  - `ProtectedRoute`;
  - `Login`: vuelta con contraseña, registro y Google, y un `state` manipulado que va a la portada;
  - un E2E que comprueba que el historial no crece. Se comprobó que falla si se quita `replace`.

### 4. H38: migraciones antiguas en el repositorio (`f5070b8`)

- **Qué se hizo:**
  - solo consultas de lectura sobre `schema_migrations`: 23 migraciones registradas, cada una con una sola
    sentencia;
  - las 7 que faltaban están ahora en `server/migrations/`, con el mismo MD5 que lo registrado (en el archivo y
    en el commit);
  - `server/migrations/README.md`: la convención, cómo se aplica, cómo se comprueba y la tabla de las 23;
  - comprobado: base de datos, archivos y tabla coinciden, 23/23.
- **Dos diferencias antiguas** (documentadas, sin tocar; el texto es el mismo):
  - 10 archivos tienen un salto de línea final de más;
  - A3 se registró con `\r\n`, y git la guarda con `\n` por `.gitattributes`.
- **Sin `.down.sql` para las 7:** el estado de antes no consta, y escribir su reversión sería inventarla.
- **Queda:** el `CREATE TABLE` de las cuatro tablas base. No hay ninguna migración que las cree (ver "Para el
  usuario").

### 5. H42: fotos del hero para el móvil (`498e0c3`)

- **Generadas** con `sharp` 0.35, que ya era dependencia del servidor: 800 px para las 4 fotos y 1200 px para
  las 3 apaisadas, en WebP. Revisadas a ojo junto al original: no se ve diferencia.
- **Cómo se sirven:**
  - en un `<picture>`: 800 en el móvil (< 768 px, el corte del CSS), 1200 hasta 1200 px y el original por
    encima;
  - comprobado en Chromium a 7 anchos (también 375 a 3x): a cada uno se pide su versión, y la foto ocupa la
    caja como antes.
- **Decisión: `client/public/img`, no el bucket.**
  - Las fotos del hero ya estaban ahí, servidas por Vercel.
  - Subirlas al bucket habría sido escribir en Supabase (Storage guarda cada archivo en `storage.objects`,
    que está en la base de datos) y cambiar la CSP.
- **Peso de las 4 fotos:** en el móvil, de 1 223 a 400 KB; hasta 1200 px, 805 KB.
- **`hero-showroom`:** es vertical y ya mide 1200: solo tiene versión de 800. No se ha recortado a apaisada,
  porque es una decisión de diseño (ver "Para el usuario").
- **Tests:**
  - los `<source>` de cada `<picture>`, y la prioridad de la primera foto;
  - que los 11 archivos que pide `Home.jsx` están en `public/img`.

### 6. Cierre

- `docs/mejoras-tecnicas.md`:
  - H41, H42, H43 y H45, resueltos;
  - H38, resuelto en parte;
  - una nota en H44 sobre la vuelta tras iniciar sesión;
  - hallazgos nuevos H47-H50.
- Puestos al día:
  - `docs/auditoria-accesibilidad.md` (A10 y A11 arreglados);
  - `docs/auditoria-rendimiento.md` (la recomendación 1, hecha);
  - `docs/testing-e2e.md` (26 tests).

## Hallazgos nuevos

| # | Gravedad | Qué | Arreglo |
|---|---|---|---|
| H47 | MEDIA | Mi cuenta: dos campos sin etiqueta asociada (axe, crítico), la etiqueta "Contraseña actual" a 2,76:1 (grave) y dos `<main>` (moderado). El E2E de accesibilidad no pasa por `/cuenta` | `id` y `htmlFor`; `--accent-text`; `<div>` en vez del segundo `<main>`; añadir `/cuenta` al E2E |
| H48 | MEDIA | El enlace "Política de Privacidad" del aviso de cookies, a 2,97:1. Lo ve todo el que entra por primera vez; el E2E cierra el aviso antes de pasar axe | `color: var(--accent-text)` en `.cookie-banner p a` |
| H49 | BAJA | Las 4 fotos del hero se descargan al cargar, aunque 3 no se ven: `loading="lazy"` no actúa porque están apiladas dentro de la pantalla | Poner cada foto cuando le toque (o a la anterior) |
| H50 | BAJA | Sin sesión, "Mi cuenta" y "Mis pedidos" del pie van directos a `/login`, sin la ruta de vuelta de H45: tras entrar, a la portada | Que apunten a `/cuenta` y `/cuenta?tab=pedidos`; `ProtectedRoute` ya hace el resto |

H47 y H48 son arreglos de una línea o poco más. Las dos son de las que axe marca como graves o críticas.
Propongo que vayan las primeras en la próxima sesión.

## Para el usuario

1. **H38, las tablas base.** Para tener el `CREATE TABLE` de `muebles`, `categorias`, `clientes` y `pedidos`, hay
   que volcar el esquema (`supabase db dump` o `pg_dump --schema-only`). Eso pide la cadena de conexión de la
   base de datos, que esta sesión no tiene: o lo lanzas tú, o me la das para hacerlo solo leyendo.
2. **`hero-showroom` apaisada (recomendación 2 de la auditoría de rendimiento).** En el escritorio y en el
   móvil se ve recortada al centro. Una versión apaisada pesaría menos, pero cambiaría lo que se ve en una
   tableta en vertical. ¿Recorte al centro, o eliges tú el encuadre?
3. **H47 y H48:** ¿los arreglo en la próxima sesión? Son de accesibilidad grave o crítica, y pequeños.
4. **Lo que se ve distinto:**
   - en el catálogo, las categorías de arriba tienen anillo de foco al usar el tabulador;
   - tras iniciar sesión, se vuelve a la página que se pedía.
   - Los títulos han cambiado de nivel, pero no de aspecto.
5. **Antes del merge:** nada de esta sesión necesita variables de entorno nuevas ni migraciones. Con el gate y
   el E2E en verde, se puede mergear cuando quieras.

---

# Sesión de accesibilidad (6 oct 2026)

Rama `feature/mejoras-tecnicas`, desde `05a9f28`. El usuario no estaba delante. Producción, en `3b3accf` (el
merge de la sesión UX); esta sesión no se ha mergeado.

## En resumen

- **Hechas:** las 4 tareas (H47, H48, H49 y H50) y el cierre, cada una con su commit, su gate en verde y su
  push. **Paradas:** ninguna.
- **Gate:** sin ningún fallo en esta sesión.
- **Tests:**
  - cliente: de 796 a 807;
  - servidor: 556, sin cambios (no se ha tocado);
  - E2E: de 26 a 39.
- **Mutantes del panel:** 127, como antes: 126 detectados y 1 superviviente esperado (más el de control, que muere en la comprobación previa). Pasados al final de la sesión, sobre `d287d31`: "Todos los mutantes detectados".
- **Ni `main`, ni Vercel, ni la base de datos se han tocado** (esta sesión no ha hecho ninguna consulta a la base de datos).

## `git log --oneline -10`

Este informe va en el commit siguiente, `docs: cierre de la sesión de accesibilidad`.

```
d287d31 fix(client): "Mis pedidos" del pie vuelve a pedidos tras login (H50)
26d0ff8 perf(client): cargar solo la primera foto del hero al inicio (H49)
a5b6f54 fix(client): subir el contraste del enlace del aviso de cookies (H48)
2d39756 fix(client): corregir etiquetas, contraste y main en Mi Cuenta (H47)
05a9f28 docs: cerrar H51 (sin cambios) y H52 (no prioritario)
e4682bb docs: anotar H51 (finales de línea) y H52 (tablas base)
074e80c docs: cierre de la sesión UX
498e0c3 perf(client): versiones optimizadas de las fotos del hero (H42)
f5070b8 docs: recuperar las migraciones antiguas en el repositorio (H38)
a49c25d fix(client): volver a la página pedida tras login (H45)
```

## Gate de cada commit

Cada comando, en su propia llamada, leyendo la salida entera antes del commit. El servidor, en todos:
lint 0 errores, formato ✓, 556/556 tests y 99,06 / 91,82 / 99,54.

| Commit | Cliente: lint | Cliente: tests y cobertura (líneas / ramas / funciones) | Build | E2E |
|---|---|---|---|---|
| `2d39756` H47 | 0 errores | 799/799 · 98,63 / 95,71 / 93,06 | ✓ | 33/33 |
| `a5b6f54` H48 | 0 errores | 802/802 · 98,63 / 95,71 / 93,06 | ✓ | 35/35 |
| `26d0ff8` H49 | 0 errores | 807/807 · 98,65 / 95,74 / 93,08 | ✓ | 37/37 |
| `d287d31` H50 | 0 errores | 807/807 · 98,65 / 95,73 / 93,08 | ✓ | 39/39 |

## Cobertura, antes y después

| | Líneas | Ramas | Funciones | Umbral |
|---|---|---|---|---|
| Cliente, antes (`05a9f28`) | 98,63 % (5 628/5 706) | 95,71 % (1 675/1 750) | 93,06 % (349/375) | 97 / 95 / 92 |
| Cliente, después (`d287d31`) | 98,65 % (5 643/5 720) | 95,73 % (1 682/1 757) | 93,08 % (350/376) | 97 / 95 / 92 |
| Servidor, antes y después | 99,06 % | 91,82 % | 99,54 % | 98 / 91 / 99 |

## Tareas

### 1. H47 (crítico): Mi cuenta (`2d39756`)

- **Qué había** (axe, en `/cuenta`): dos campos sin etiqueta (crítico), una etiqueta a 2,76:1 (grave) y dos
  `<main>` (moderado).
- **Arreglo:** `id` y `htmlFor` en los cinco campos; la etiqueta pasa a `--accent-text`; el `<main>` interior
  pasa a `<div>` (el CSS va por la clase, y no hay selectores globales de `main`).
- **El E2E de `/cuenta`:**
  - Mi cuenta en sus tres pestañas, en claro y en oscuro, con `label`, `color-contrast` y `landmark-*`; un solo
    `<main>`, un solo `h1`; y cada campo localizable por su etiqueta.
  - **Se entra por el formulario de login con la API simulada.** No hace falta ninguna credencial ni secreto, y
    funciona igual en el CI que en local. (El job de E2E del CI arranca Vite y simula la API en el navegador, y
    además no bloquea: `continue-on-error`.)
  - **Un fallo mío, cazado antes del commit:** la primera versión sembraba la sesión en `localStorage`. Sin
    *access token* en memoria, "Mis pedidos" recibía un 401, la web echaba a `/login` y el test, que pasaba,
    estaba mirando la página de login. Se vio al comprobar que fallaba antes del arreglo: las pestañas de
    `pedidos` no fallaban. Ahora se comprueba también la URL final.
  - Comprobado revirtiendo cada arreglo por separado: cada regla falla sola.
- **El aviso de cookies** se evita sembrando la elección, no pulsando: `cerrarCookies` solo actúa si el aviso
  ya se ha pintado, y eso era una carrera.

### 2. H48 (grave): enlace del aviso de cookies (`a5b6f54`)

- De 2,97:1 a 5,03:1 sobre `--card-bg` (calculado a mano) con `--accent-text`. En oscuro, el mismo color que ya
  pasaba.
- E2E con el aviso abierto y sin pulsar nada, en claro y oscuro: falla antes del arreglo solo en claro.
- Una comprobación en Vitest de que ese enlace y la etiqueta de H47 siguen usando `--accent-text`, porque el CI
  no bloquea por el E2E. Comprobado por mutación.

### 3. H49: solo la primera foto del hero al cargar (`26d0ff8`)

- **Medido en Chromium** (peticiones a `/img/hero`):

  | | Móvil (375 px) | Escritorio (1440 px) |
  |---|---|---|
  | Antes, al cargar | 4 fotos, 400 KB | 4 fotos, 1 223 KB |
  | Después, al cargar | 1 foto, 98 KB | 1 foto, 359 KB |
  | Después, a los 3,6 s / 9,6 s | 2 / 3 fotos | 2 / 3 fotos |

- **Cómo:** solo hay `<picture>` de la foto que se ve y de las ya vistas. La siguiente se pide 3 s después de
  mostrar la actual, 2,5 s antes de que le toque. Al pulsar un punto, la foto sale en ese mismo render.
  Comprobado en el navegador: la segunda ya está cargada al mostrarse, y el punto 4 enseña su foto.
- **Tests:** Vitest con relojes simulados (comprobado por mutación: pintar las cuatro, y quitar la precarga),
  y un E2E que cuenta las peticiones reales. Usa `page.clock`, así que no depende de lo que tarde en cargar la
  máquina (9/9 repitiéndolo 3 veces).
- **Limitación:** con una conexión muy lenta (menos de ~1,3 Mbit/s para la foto de 359 KB) la siguiente puede
  no haber llegado, y se vería el fondo oscuro un momento.

### 4. H50: "Mis pedidos" del pie (`d287d31`)

- Los enlaces del pie apuntan siempre a `/cuenta` y `/cuenta?tab=pedidos`; sin sesión, `ProtectedRoute` manda al
  login con la ruta guardada (H45). Con sesión, nada cambia.
- Lo que sí **usa otro mecanismo** (la tarea lo preguntaba): el pie llevaba directo a `/login`, sin pasar por
  `ProtectedRoute`, y por eso no llevaba la ruta. El icono "Cuenta" de la cabecera también va a `/login`; se
  deja, porque es el acceso genérico y no hay página que recordar.
- E2E: sin sesión, "Mis pedidos" → login → `/cuenta?tab=pedidos` (y "Mi cuenta" → `/cuenta`). Falla antes del
  arreglo, acabando en la portada.

### 5. Cierre

`docs/mejoras-tecnicas.md` (H47-H50 resueltos, H53 nuevo), `docs/auditoria-accesibilidad.md`,
`docs/auditoria-rendimiento.md` y `docs/testing-e2e.md` (39 tests).

## Hallazgo nuevo

| # | Gravedad | Qué |
|---|---|---|
| H53 | BAJA | `AuthModal` (3 etiquetas) y `CheckoutModal` (8, el formulario de compra) tienen `<label>` sin `htmlFor`, y los campos, sin `id`. Tienen `placeholder`, que axe acepta como nombre, así que probablemente no lo marque; pero pulsar la etiqueta no lleva al campo. En `ProductDetail`, "Cantidad" y "Modalidad" etiquetan un grupo de botones. **No comprobado con axe:** el intento de abrir los modales desde un E2E agotó el tiempo y no se averiguó por qué. |

## Para el usuario

1. **Merge.** Son cambios de front y documentación: sin migraciones ni variables de entorno nuevas. Es tu
   decisión.
2. **Comprobar en producción, después del merge:**
   - `/cuenta`: un solo `<main>` (Elements) y los campos con su etiqueta;
   - el enlace del aviso de cookies (primera visita, ventana de incógnito): su color es `#8A644C`;
   - la portada en móvil, Network filtrando "hero": al cargar, una sola foto;
   - sin sesión, "Mis pedidos" del pie → login → debe volver a `/cuenta?tab=pedidos`.
3. **H53:** ¿lo hago en la próxima sesión? Es de prioridad baja. Lo único que pide decisión es si merece
   averiguar antes, con axe, si los modales dan avisos.
4. **El E2E del CI no bloquea** (`continue-on-error`). Los tests de esta sesión que vigilan el contraste
   tienen además una comprobación en Vitest, que sí bloquea.

---

# Sesión de los modales de la cesta (6 oct 2026)

Rama `feature/mejoras-tecnicas`, desde `0d7db75`. En dos partes: el diagnóstico de por qué el E2E no llegaba a
los modales (con axe), y H54. Producción sigue en `654f640`; nada de esto está mergeado.

## `git log --oneline -5`

Este informe va en el commit siguiente, `docs: cierre de la sesión de accesibilidad de modales`.

```
30044a0 fix(client): corregir el contraste del lema en AuthModal (H54)
9c36aeb test(e2e): abrir los modales de la cesta y pasarles axe (H53, H54)
64bd70a docs: causa real del E2E que no abría los modales de la cesta (H53)
0d7db75 docs: anotar en H53 el diagnóstico previo del E2E de CheckoutModal
c528bcd docs: decisiones del usuario sobre H53 y la limitación de H49
```

## Cobertura

| | Líneas | Ramas | Funciones | Tests |
|---|---|---|---|---|
| Cliente, antes y después | 98,65 % (5 643/5 720) | 95,73 % (1 682/1 757) | 93,08 % (350/376) | 807 → 808 |
| Servidor, antes y después | 99,06 % | 91,82 % | 99,54 % | 556 |

Umbrales sin cambios (cliente 97 / 95 / 92; servidor 98 / 91 / 99). E2E: de 39 a 44. El gate de los tres commits
de código y documentación salió en verde a la primera, cada comando en su propia llamada. Los mutantes del panel
no se han vuelto a pasar: no se ha tocado código del panel (127 la última vez, sobre `d287d31`).

## Tareas hechas

1. **Diagnóstico del E2E de los modales** (`64bd70a`, `9c36aeb`):
   - un test mínimo con un log tras cada paso (3 repeticiones, con y sin sesión) localizó el fallo: no era el
     selector (la sospecha era falsa) ni la carga diferida. **"Confirmar Pedido" está desactivado** porque
     `validateCart` copia en la cesta el precio de la API, y la API simulada lo da a `null`, como producción (C4);
   - confirmado con una prueba mínima (con precio, se abren los dos modales, 12 de 12) y documentado en H53 en
     su propio commit **antes** de tocar ningún test;
   - `e2e/cesta.spec.js`: la cesta no deja pagar con precios ocultos, y con una pieza con precio se abren
     `AuthModal` y `CheckoutModal` y se les pasa axe.
2. **axe sobre los modales:** ninguna violación de `label` (los campos tienen `placeholder`), así que **H53 pasa a
   UX menor, prioridad baja**. Salió otra cosa: el contraste del lema de `AuthModal` (H54).
3. **H54** (`30044a0`): el lema "Almacén de ideas" pasa a `--accent-text`, de 2,97:1 a 5,03:1. axe: **cero
   violaciones en los dos modales, en claro y en oscuro**. Las guardas (E2E y Vitest) fallan si se vuelve atrás.
4. **Los PDF de espejos y sillas** (verificados en esta sesión, solo lectura): 5 espejos con nombre y medidas.
   Las sillas no salen 14 claras: 15 páginas, entre ellas un taburete o mesita plegable, una foto de detalle y
   posibles repeticiones; sin nombres ni precios.

## Puntos pendientes

- **Merge:** esta sesión cambia un estilo (`AuthModal.css`), un test E2E nuevo y documentación. Sin migraciones ni
  variables de entorno. Tu decisión.
- **H53 (UX menor, baja):** asociar las etiquetas en los dos modales y el título de grupo en la ficha.
- **H55 (pendiente de decisión):** los modales no se anuncian como modales (`role="dialog"`, `aria-modal`, foco).
- **H56 (baja):** más `--accent-color` en el modal de acceso, en estados que axe no prueba: el texto del botón
  "¿No tienes cuenta?" al pasar el ratón (2,97:1) y el borde de foco de los campos (por debajo de 3:1).
- **Sillas:** que el cliente diga cuántas piezas son y cuáles, con nombre (y precio, si quiere).
