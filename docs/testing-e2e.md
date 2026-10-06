# Tests E2E (Playwright)

Recorren la web de verdad en un navegador (Chromium): la portada, el catálogo, el inicio de sesión y el panel.
Completan los tests de Vitest (`npm run test:coverage`), que prueban cada pieza por separado en jsdom.

## Cómo lanzarlos

Desde `client/`:

```bash
npm install                         # una vez: instala @playwright/test
npx playwright install chromium     # una vez: el navegador de esa versión (no hace falta en el contenedor de Claude Code)
npm run test:e2e                    # los lanza todos
npx playwright test e2e/login.spec.js   # solo uno
npx playwright test --headed        # viendo el navegador
npx playwright test --ui            # modo interactivo, para depurar
```

`playwright.config.js` arranca la web con Vite en el puerto 5173 (`npm run dev`). Si ya está arrancada, la
reutiliza, salvo en la CI. Cuando un test falla, quedan la captura y la traza en `client/test-results/`; se
abren con `npx playwright show-trace <archivo>`. Las dos carpetas de resultados están en `.gitignore`.

**Versión:** `@playwright/test` está fijada en **1.56.1** (sin `^`). Es la que corresponde al Chromium
preinstalado en el contenedor de Claude Code (revisión 1194, en `/opt/pw-browsers`), y así funciona ahí sin
descargar nada. Si se sube de versión, hay que hacer `npx playwright install chromium` en local. En la CI ya lo
hace el job `e2e`.

## Cómo funciona la API simulada

Los tests **no arrancan el servidor ni tocan la base de datos**. La web apunta a `http://localhost:5000/api`
(`VITE_API_URL`, en `playwright.config.js`). `e2e/apiSimulada.js` intercepta en el navegador todo lo que va ahí
(`page.route`) y responde con datos de prueba, con la misma forma que la API real:

- **Catálogo:** `GET /categorias`, `GET /muebles` (con `?limit=`) y `GET /muebles/:id`. Los precios van a `null`,
  como en producción mientras `MOSTRAR_PRECIOS` no esté en `true`.
- **Inicio de sesión:** `POST /auth/login` acepta las cuentas `ADMIN` y `CLIENTE` con `CONTRASENA` y devuelve
  `{ success, token, refreshToken, user }`. `POST /auth/refresh` responde 401: al recargar la página, la sesión
  se pierde, así que los tests no recargan después de entrar.
- **Panel:** `/admin/muebles`, `/admin/categorias/con-stats`, `/admin/mensajes` y `/pedidos` solo responden con
  el token del administrador (`Bearer access-u-admin`), como `verificarAdmin`.
- **Mi cuenta:** `GET /pedidos/mios` responde una lista vacía con cualquier sesión abierta (H45).
- **Lo que no está previsto** responde 404 y queda en `sinSimular`. Los tests principales comprueban que la
  lista está vacía: si la web empieza a llamar a una ruta nueva, el test lo dice.
- **Las fuentes de Google** se responden vacías, para no depender de la red ni ensuciar la consola.

Ayudantes:
- `vigilarConsola(page)` recoge los errores de la consola y las excepciones sin capturar.
- `cerrarCookies(page)` elige "Solo esenciales" en el banner de cookies.

## Qué cubren (44 tests)

| Archivo | Flujo |
|---|---|
| `e2e/home.spec.js` | La portada carga, enseña las 4 piezas destacadas (pide `?limit=4`, no el catálogo entero) y no deja errores en la consola. |
| `e2e/catalogo.spec.js` | El catálogo enseña todas las piezas y no ofrece ordenar por precio si no hay precios. Filtra por categoría (y lo pone en la URL) y por "Disponible". Pulsar una pieza abre su ficha, con la referencia y "Consultar precio". |
| `e2e/login.spec.js` | Con las credenciales buenas entra, saluda y guarda la sesión. Con una contraseña mala se queda con el error del servidor. Sin sesión, `/admin` manda al login. H45: sin sesión, `/cuenta?tab=pedidos` manda al login y, al entrar, vuelve ahí, sin dejar el login en el historial. H50: lo mismo pulsando "Mis pedidos" y "Mi cuenta" del pie. |
| `e2e/busqueda.spec.js` | H39. A 375 px, la barra de búsqueda está oculta y se busca con la lupa: abre el buscador con el foco en el campo, encuentra piezas, Escape lo cierra y devuelve el foco, y no hay scroll horizontal. En escritorio, la barra se abre con el teclado y la lupa no se ve. |
| `e2e/accesibilidad.spec.js` | axe-core (`@axe-core/playwright`) en la portada, el catálogo, una ficha, el inicio de sesión, contacto y la 404, y con el buscador y el menú lateral abiertos: falla si hay algún problema grave o crítico de WCAG 2.1 A/AA. H43: en esas mismas páginas, un solo `h1` y `heading-order` y `page-has-heading-one` de axe sin avisos, aunque sean moderados. H47: Mi cuenta (datos, favoritos y pedidos, en claro y oscuro) con `label`, `color-contrast` y `landmark-*`, un solo `<main>` y cada campo localizable por su etiqueta; se entra por el formulario de login. H48: el aviso de cookies abierto, en claro y oscuro. Ver `docs/auditoria-accesibilidad.md`. |
| `e2e/home.spec.js` (hero) | H49: a 375 y 1440 px, al cargar solo se pide la primera foto del hero, y la siguiente 3 s después. Usa `page.clock`: el tiempo avanza cuando el test lo dice. |
| `e2e/cesta.spec.js` | H53. Con los precios ocultos (como en producción), la cesta no deja pagar: "Confirmar Pedido" desactivado (C4). Con una pieza con precio simulada, se abren `AuthModal` (sin sesión) y `CheckoutModal` (con sesión), y se pasa axe sobre cada uno, en claro y oscuro, comparando con la lista de violaciones conocidas (hoy, solo H54). **Para llegar a un modal hay que simular precio:** `validateCart` copia en la cesta el precio que da la API, y la API simulada lo da a `null`. |
| `e2e/admin.spec.js` | El administrador entra al panel desde el menú de su cuenta, recorre las 6 pestañas, ve el inventario con referencias y la insignia de mensajes, sin llamadas sin simular ni errores en la consola. Un cliente no ve el enlace al panel. |

Comprobado el 4 oct 2026: 10 de 10 en verde, y 30 de 30 repitiéndolos 3 veces (`--repeat-each=3`) para
descartar tests inestables. El 5 oct, con `busqueda.spec.js`: 36 de 36 repitiéndolos 3 veces.

## En la CI

Job `e2e` de `.github/workflows/ci.yml`:
1. `npm ci`;
2. `npx playwright install --with-deps chromium`;
3. `npm run test:e2e`.

Si falla, sube el informe HTML como artefacto (`informe-playwright`, 7 días). **De momento no bloquea**
(`continue-on-error: true`): sale en rojo pero no para el CI. Cuando lleve unas semanas estable, se quita esa
línea.

La CI solo corre en los push a `main` y en los Pull Request contra `main`. Los push a las ramas de trabajo no la
lanzan.

## Cuándo añadir un test E2E

- **Sí:** un flujo que cruza varias páginas o depende del navegador de verdad. Por ejemplo, el enrutado, la
  sesión entre páginas, el almacenamiento local o la descarga de un archivo. También un fallo que se haya
  colado a producción aunque los tests de Vitest estaban en verde.
- **No:** el detalle de un componente (textos, estados, validaciones). Eso va en Vitest, que es mucho más rápido.
  Un E2E por flujo importante, no uno por caso.
- **Si el flujo llama a una ruta nueva de la API**, se añade su respuesta en `e2e/apiSimulada.js`, con la forma
  que devuelve el controlador real.
