# Tarea 4 — Diseño: partir `Admin.jsx` por pestañas

> **Estado: aprobado** (24 sep 2026), con los cuatro ajustes de la revisión incorporados: valor de retorno en éxito
> (H12), casos de la categoría preseleccionada (secciones 5 y 6), `status` compartido (H14) y plan de
> comprobación en el navegador (sección 6). Decisiones de enfoque: conservar el estado al cambiar de pestaña, no
> llevar las pestañas a la URL y escribir tests de caracterización antes de mover código.
> Rama `feature/mejoras-tecnicas`. No toca `main`, ni la base de datos, ni el servidor.

## 1. Punto de partida (comprobado leyendo el código)

- `client/src/pages/Admin.jsx`: **1037 líneas, un solo componente**. Tiene cinco vistas (`resumen`, `crear`,
  `inventario`, `pedidos`, `categorias`), dos modales de edición (mueble y categoría), el modal de confirmación y
  **23 `useState`** (todos en la tabla de la sección 5). Cambiar de pestaña es un `useState` (`vistaActiva`) con
  renderizado condicional.
- Se carga en diferido desde `App.jsx` (`lazy(() => import('./pages/Admin'))`), en la ruta `/admin`, dentro de
  `ProtectedRoute adminOnly`.
- **Duplicaciones:** el selector de categoría con `<optgroup>` está copiado igual en "Añadir mueble" y en el modal
  de edición. El objeto `ICONS` y el componente `Icon` viven dentro del archivo.
- **Sin ningún test.** La tarea 5 lo dejó explícitamente para después de este refactor.
- Contiene la doble escritura de `categoria_id` de la tarea 3a (`idDeCategoria`), que se mueve tal cual.
- **Cosas del comportamiento actual que el refactor conserva, aunque alguna no guste** (los tests las fijan):
  - Los filtros, la página del inventario y los formularios a medio rellenar ("Añadir mueble" y "Nueva categoría")
    sobreviven a un cambio de pestaña, porque todo vive en `Admin`.
  - **Rareza con las fotos:** al volver a "Añadir mueble", los archivos elegidos siguen en el estado (`files`),
    pero el `<input type="file">` se ve vacío (el DOM se rehízo). Como el input es `required`, el navegador obliga
    a elegirlos otra vez. Se conserva y queda anotado (H13).
  - Borrar un mueble, borrar varios, borrar una categoría y el cambio de estado en lote enseñan éxito sin mirar la
    respuesta (H12). **No se arregla en este refactor**: va después, en su propio commit.
  - El bloque "Avisos / Últimas Ventas" del resumen no lee pedidos: lista las piezas con `estado` vendido o
    alquilado, sin orden. Es un nombre engañoso; se anota, no se toca.
  - Un solo `status` para todos los formularios, con sus efectos cruzados (H14).

## 2. Estructura de archivos

**Decisión: el contenedor sigue siendo `pages/Admin.jsx`, y sus piezas van en `pages/admin/`.** Sin contexto nuevo.

```
client/src/pages/
  Admin.jsx                      ← contenedor (~150 líneas): barra lateral, pestaña activa, estado compartido, modales
  admin/
    Icon.jsx                     ← ICONS + Icon (hoy dentro de Admin.jsx)
    SelectorCategoria.jsx        ← el <select> con <optgroup> de "Añadir" y "Editar"
    categorias.js                ← funciones puras: idDeCategoria, generales, especificasDe
    pestanas/
      ResumenTab.jsx
      CrearMuebleTab.jsx
      InventarioTab.jsx
      PedidosTab.jsx
      CategoriasTab.jsx
    modales/
      EditarMuebleModal.jsx
      EditarCategoriaModal.jsx
    hooks/
      useAdminDatos.js           ← muebles, categorías, pedidos y su carga
      useInventarioVista.js      ← búsqueda, filtros, orden, paginación y selección
      useConfirmacion.js         ← estado del ConfirmModal y confirmarBorrado()
```

**Por qué así:**
- **`pages/Admin.jsx` se queda en su sitio:** la ruta, el `lazy` de `App.jsx` y cualquier enlace siguen igual; el
  diff de `App.jsx` es cero.
- **`pages/admin/` y no `components/admin/`:** `components/` es la carpeta de piezas públicas que usa cualquier
  página (`ProductCard`, `Header`...). Estas son privadas del panel; si mañana se borra el panel, se borra una
  carpeta. Una carpeta `admin` junto a `Admin.jsx` no choca en Windows: uno es un archivo y el otro una carpeta.
- **Sin `AdminContext`:** la jerarquía tiene un solo nivel (contenedor → pestaña o modal). Un contexto escondería
  de dónde viene cada dato, obligaría a envolver cada test en otro Provider y no ahorra nada con esta profundidad.
  Se reconsidera si una pestaña llega a tener subcomponentes que necesiten los mismos datos varios niveles abajo.

## 3. Comunicación contenedor ↔ pestaña

- **Solo props, de un nivel.** El contenedor pasa a cada pestaña los datos que usa, el trozo de estado que le toca
  conservar y funciones con nombre de intención (`recargarMuebles`, `irA`, `confirmarBorrado`, `abrirEditorMueble`).
- **`vistaActiva` vive en el contenedor**, que es quien pinta la barra lateral y decide qué pestaña montar. Las
  pestañas que navegan reciben `irA(vista)`:
  - "Añadir mueble" va al inventario tras crear.
  - Las alertas del resumen tienen un botón "Ver inventario".
- **Los manejadores de cada formulario viven en su pestaña** (`handleSubmit` en `CrearMuebleTab`,
  `handleAddCategoria` en `CategoriasTab`...). Llaman a `api.js` directamente y luego al callback de recarga del
  contenedor. Así cada pestaña se entiende y se prueba sola.
- **`ToastContext`** lo lee cada pestaña con `useContext`, como hoy el propio `Admin` (los tests ya lo simulan así).
- **`status` / `setStatus`** ("Guardando producto...", "Actualizando..."): hoy es **un solo estado compartido**. Lo
  escriben el formulario de crear, el de categorías y los dos modales. Solo se pinta en "Añadir mueble", y los
  botones de los modales se desactivan según su texto. Para no cambiar nada, **sigue siendo uno y vive en el
  contenedor**, que pasa `status` y `setStatus` a quien los usa hoy. Separarlo por formulario es razonable, pero
  cambiaría qué mensaje se ve en qué pestaña: no en este refactor. Anotado como H14 en `mejoras-tecnicas.md`.
- **Barra lateral:** una lista `PESTANAS = [{ id, etiqueta, icono }]` en el contenedor genera los botones, con el
  mismo HTML y las mismas clases que hoy (incluida la insignia de pedidos pendientes). Es lo que hace que añadir
  "Reservas" sea una entrada más (sección 7).

## 4. Modales de edición

- **Se extraen a `modales/EditarMuebleModal.jsx` y `modales/EditarCategoriaModal.jsx`.** Cada uno se abre desde una
  sola pestaña (inventario y categorías), pero **los sigue pintando el contenedor**, fuera de `<main>`, como hoy.
  Así el HTML queda en el mismo sitio (el CSS y la capa de fondo dependen de ello) y la pestaña solo tiene que
  llamar a `abrirEditorMueble(m)` o `abrirEditorCategoria(cat)`.
- Su estado (`muebleAEditar`, `editMuebleFiles`, `categoriaAEditar`, `editCategoriaFile`) vive en el contenedor. El
  manejador del envío (`handleUpdateMuebleSubmit`...) se mueve dentro del modal, que recibe `categorias`,
  `status/setStatus`, `confirmarBorrado` (para quitar fotos), `onGuardado` (recarga) y `onCerrar`.
- **Compartidos de verdad** entre "Añadir mueble" y el modal de edición: `SelectorCategoria` e `idDeCategoria`.
  Viven en `pages/admin/` (sección 2), no dentro de ninguno de los dos.
- `ConfirmModal` (componente público que ya existe) no cambia. Su estado pasa al hook `useConfirmacion`.

## 5. Dónde queda cada `useState`

Criterio aprobado: **lo que hoy sobrevive a un cambio de pestaña sigue en el contenedor; lo demás, local.**

| Estado (hoy en `Admin`) | Dónde queda | Motivo |
|---|---|---|
| `vistaActiva` | Contenedor | Decide qué pestaña se monta |
| `muebles`, `categorias`, `pedidos` | Contenedor, en `useAdminDatos` | Los usan varias pestañas y la insignia de la barra lateral |
| `busqueda`, `filtroCategoria`, `filtroEstado`, `orden`, `pagina`, `seleccionados`, `bulkEstado` | Contenedor, en `useInventarioVista` | Estado de vista: sobrevive al cambio de pestaña (aprobado) |
| `filtroEstadoPedido` | Contenedor | Estado de vista (mismo criterio) |
| `formData`, `files` (añadir mueble) | Contenedor | Formulario a medio rellenar: sobrevive hoy. Se conserva y se anota como UX discutible (H13) |
| `nuevaCat`, `nuevaCatPadre`, `categoriaFile` | Contenedor | Mismo criterio que el anterior |
| `muebleAEditar`, `editMuebleFiles`, `categoriaAEditar`, `editCategoriaFile` | Contenedor | Los modales se pintan fuera de las pestañas (sección 4) |
| `status` | Contenedor | Compartido entre formularios (sección 3) |
| `confirmConfig` | Contenedor, en `useConfirmacion` | Un solo `ConfirmModal` para todo el panel |
| Listas derivadas (filtradas, página visible, totales del resumen) | Local: `useMemo` / cálculo en la pestaña | Se recalculan; no son estado |
| `ESTADOS_PEDIDO`, `ETIQUETA_ESTADO_PEDIDO`, `PAGE_SIZE` | Constantes de módulo | No cambian nunca |

**Detalle que hay que conservar:** hoy `cargarCategorias()` pone la primera categoría específica (la primera con
`categoria_padre_id`, en el orden de la API) en `formData.categoria`, **solo si está vacía**. Se ejecuta al montar
y cada vez que se recargan las categorías, pero no al crear un mueble. Con `useAdminDatos`, eso pasa a un
`useEffect` del contenedor que tiene que cumplir dos cosas:

```js
useEffect(() => {
  const especificas = categorias.filter(c => c.categoria_padre_id);
  if (especificas.length > 0 && !formData.categoria) {
    setFormData(prev => ({ ...prev, categoria: especificas[0].nombre }));
  }
  // Solo [categorias], a propósito: ver caso C.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [categorias]);
```

- **La condición `!formData.categoria`**: sin ella se pisa lo que el usuario ya eligió (caso B).
- **Depender solo de `categorias`**, no de `formData.categoria`: si dependiera de las dos, el efecto rellenaría la
  categoría justo después de vaciar el formulario al crear un mueble (caso C), y hoy eso no pasa.

Los tres casos tienen su test de caracterización (sección 6):
- **Caso A:** al entrar con la categoría vacía, "Añadir mueble" preselecciona la primera específica. Si solo hay
  categorías generales, no preselecciona nada.
- **Caso B:** el usuario elige "Mesas" en "Añadir mueble", va a Categorías, crea una categoría nueva (eso recarga
  las categorías) y vuelve. La categoría sigue siendo "Mesas".
- **Caso C:** tras crear un mueble con éxito, el formulario se vacía y la categoría queda en "Selecciona una
  categoría", sin volver a rellenarse hasta la siguiente recarga de categorías.

## 6. Estrategia de tests

**Primero se caracteriza, luego se mueve.** Los tests se escriben contra el `Admin.jsx` actual y deben seguir en
verde, **sin tocarlos**, en cada commit del refactor. Es el invariante que demuestra que nada ha cambiado.

- **Qué se simula:** `vi.mock('../services/api')`, con cada función devolviendo lo que devuelve de verdad, incluido
  el `null` de error (el contrato actual de las escrituras, H12). `AuthContext` y `ToastContext` se simulan con su
  `Provider`. Es el mismo patrón que los tests de `Header`, `CartDrawer` y `CheckoutModal` de la tarea 5. **No se
  usa `fakeSupabase.js`**: ese doble es del servidor. El cliente solo habla con `api.js`.
- **Un archivo por pestaña**, no uno monolítico. Todos montan `<Admin />` (antes del refactor no hay pestañas
  sueltas) con un ayudante común (`renderAdmin`, en `pages/adminTestUtils.jsx`) y entran por la barra lateral:
  - `Admin.resumen.test.jsx`: contadores, valor en stock, alertas de fotos y categoría, botón "Ver inventario".
  - `Admin.crear.test.jsx`: `FormData` enviado (con `categoria_id`), éxito que limpia y lleva al inventario, error.
    Casos A y C de la categoría preseleccionada (sección 5).
  - `Admin.inventario.test.jsx`: búsqueda, filtros, orden, paginación de 20 en 20, selección de página, lote
    (estado y borrado), estado en línea, borrado con confirmación.
  - `Admin.pedidos.test.jsx`: filtro por estado, cambio de estado (éxito y error), datos del cliente.
  - `Admin.categorias.test.jsx`: crear (general y dentro de otra), editar, borrar, agrupación por categoría general.
  - `Admin.modales.test.jsx`: editar mueble (fotos existentes y nuevas) y editar categoría.
  - `Admin.navegacion.test.jsx`: cambiar de pestaña y volver **conserva** filtros, página y formularios a medio
    rellenar. Caso B de la categoría preseleccionada (sección 5), que cruza dos pestañas.
- **Los tests describen lo que hace hoy, aunque esté mal.** Los casos del H12 llevan este comentario y se cambiarán
  en el commit del arreglo, no antes:
  ```js
  // CARACTERIZACIÓN: comportamiento actual incorrecto (H12): enseña éxito aunque deleteMueble devuelva null.
  ```
- **Consultas:** por rol, etiqueta y texto visible. **Nada de instantáneas (snapshots):** romperían con cualquier
  cambio de marcado y no dirían qué comportamiento se ha perdido.
- **Comprobación por mutación:** antes de commitear cada archivo de caracterización se meten fallos deliberados en
  `Admin.jsx`, de uno en uno, con un script que restaura el archivo al terminar. Después se comprueba que algún test
  detecta cada fallo. Si un fallo no lo detecta ningún test, falta un test o hay uno que no comprueba nada. En el
  test del resumen se detectaron los 10 fallos. Se repite con cada pestaña. El script es
  `client/scripts/mutantes-panel.js` (uso y cómo añadir mutantes, en su cabecera), con una lista de fallos por
  pestaña en `client/scripts/mutantes/`: `node scripts/mutantes-panel.js crear`, desde `client/`.
- **Durante el refactor** se añaden tests unitarios de las piezas nuevas que tienen lógica: `useInventarioVista`
  (con `renderHook`), `categorias.js` y `SelectorCategoria`.
- **Comprobación en el navegador al final**, en dos sitios y siempre de solo lectura:
  - **El recorrido:** navegar por las cinco pestañas; en el inventario, búsqueda, filtros, orden y paginación;
    filtro de pedidos; abrir y cerrar sin guardar los dos modales de edición; y cambiar de pestaña y volver para
    ver que se conservan filtros y formularios. Si hace falta probar guardar o borrar, será con una pieza de
    prueba creada y borrada con tu permiso, como en la verificación de multer.
  - **En local** (`npm run dev` en `client/`), contra el servidor local o contra la API de producción. Las dos
    opciones funcionan sin tocar nada: `http://localhost:5173` ya está en la lista de CORS del servidor. Las dos
    leen la base de datos real, por eso el recorrido es de solo lectura. El inicio de sesión como administrador lo
    haces tú: yo no escribo contraseñas.
  - **En el despliegue de vista previa de Vercel, antes del merge a `main`.** Así, si el refactor rompe algo, se ve
    sin tocar producción. Tiene tres requisitos, y los dos primeros necesitan tu permiso:
    1. Subir la rama (`git push`). El 24 sep, `origin/feature/mejoras-tecnicas` iba 14 commits por detrás.
    2. Añadir la URL de vista previa **de la rama** (la estable, `…-git-feature-mejoras-tecnicas-….vercel.app`,
       no la de cada despliegue) a `ALLOWED_ORIGINS` en el servidor de producción. Desde la tarea 2, CORS solo
       admite orígenes exactos.
    3. Comprobar que `VITE_API_URL` está definida para el entorno Preview del cliente. Si no, la vista previa
       apunta a `localhost:5000`.

    **Sin el punto 2 el panel sale vacío y parece un fallo del refactor:** la llamada falla por CORS, y con el
    contrato C (H12) un fallo de carga se ve igual que una lista vacía. Si no se quiere tocar `ALLOWED_ORIGINS`,
    la comprobación en local basta.
  - **Si algo falla:** `git bisect` sobre los commits del refactor (6 a 11), con el commit 5 marcado como bueno: los
    commits de tests 1 a 5 no cambian la aplicación. Cada commit pasa el gate, así que cualquiera se puede arrancar
    y recorrer.

## 7. Encaje de `AdminReservas` (bloque R-d de reservas)

- **Una pestaña más, con el mismo patrón:** `pestanas/ReservasTab.jsx`, una entrada en `PESTANAS` y su caso en el
  contenedor. Sus datos (reservas, bloqueos) los carga **su propio hook** (`useReservasAdmin`) dentro de la
  pestaña, no `useAdminDatos`, porque ninguna otra pestaña los necesita. Si el resumen llega a enseñar contadores
  de reservas, se decide entonces.
- **Detrás del interruptor `VITE_RESERVAS_ACTIVAS`** (diseño de reservas, 9.1): con él apagado, la entrada no aparece
  en `PESTANAS` y el componente ni se importa.
- **Carga diferida dentro del panel**, con `lazy(() => import('./admin/pestanas/ReservasTab'))` y un `<Suspense>`
  alrededor. Los calendarios traerán una librería de fechas (react-day-picker) que no tiene por qué descargar quien
  solo edita el inventario. Es el mismo mecanismo que ya usa `App.jsx` para el panel entero.
- **Nada de esto se hace en la tarea 4.** Lo único que deja preparado es `PESTANAS`, la carpeta y el patrón.

## 8. Alcance cerrado: qué NO se toca

- **Las pestañas no van en la URL** (`/admin/inventario`). Si algún día se hace, habrá que decidir si `/admin` sigue
  siendo la entrada por defecto y qué pasa con los enlaces antiguos.
- **Ningún cambio visual:** mismo HTML y mismas clases (`Admin.css` no se toca), mismos textos, mismos mensajes.
- **Ningún cambio de comportamiento**, tampoco los que parecen fallos: H12, la rareza de las fotos (H13) y el nombre
  "Últimas Ventas". Cada uno irá en su propio commit después, o se decidirá con el cliente.
- **Accesibilidad:** la que ya hay. No se añaden roles ARIA ni gestión de foco nuevos.
- **Ni `api.js`, ni el servidor, ni la base de datos, ni `App.jsx`.**
- **No cambia la estrategia de carga** (los tres listados al entrar) ni se añade ninguna dependencia.
- **Sin estado global ni contexto nuevo.**

## 9. Orden de commits

Cada commit con su gate (`npm run lint` + `npm test` en `client/` y `server/`) y el diff revisado antes de
commitear. **Desde el commit 6, los tests de caracterización no se tocan**: si alguno falla, el refactor ha cambiado
algo y se corrige el refactor, no el test.

1. `test(client): caracterización del panel — resumen`, con el ayudante `renderAdmin`
2. `test(client): caracterización del panel — añadir mueble`
3. `test(client): caracterización del panel — inventario`
4. `test(client): caracterización del panel — pedidos y categorías`
5. `test(client): caracterización del panel — modales de edición y navegación`. La navegación va aquí y no en el
   commit 1 porque comprueba que se conserva el estado de "Añadir mueble", del inventario y de categorías: tiene
   más sentido cuando esas pestañas ya están caracterizadas.
6. `refactor(client): extraer Icon, SelectorCategoria y utilidades de categorías del panel`
7. `refactor(client): hooks del panel (datos, vista de inventario, confirmación)`, con tests unitarios
8. `refactor(client): pestañas Resumen y Añadir mueble`
9. `refactor(client): pestaña Inventario`
10. `refactor(client): pestañas Pedidos y Categorías`
11. `refactor(client): modales de edición`
12. `docs: cierre de la tarea 4`: este documento, `mejoras-tecnicas.md` y la comprobación en el navegador.

**Después de la tarea 4, fuera de ella:** `fix(client): comprobar la respuesta de las mutaciones del panel (H12)`,
que cambia a propósito los tests marcados con el comentario de caracterización.

**Tamaño:** ≈ 2–3 días. Los tests de caracterización son la mitad del trabajo, y la otra mitad es mover código.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un cambio de comportamiento que nadie nota | Tests de caracterización intocables desde el commit 6 y recorrido en el navegador |
| Perder el estado al cambiar de pestaña | Test explícito de navegación (sección 6) |
| Cambiar el HTML y romper `Admin.css` | Mismas clases y misma posición de los modales; se revisa en el navegador |
| Conflictos con la tarea 3 | Se toca `categoria_id` solo para moverlo. La migración A5 (quitar `categoria`) será más fácil después: el selector estará en un solo sitio. 3b cambia `api.js` y `AuthContext`, no el panel |
| Que el arreglo de H12 cambie cómo se escriben estos tests | H12 se decide antes de empezar (ver `mejoras-tecnicas.md`): el arreglo no cambia el contrato de `api.js` en esta fase, así que los mocks de hoy siguen valiendo |
| Que el `useEffect` de la categoría preseleccionada pise la elección del usuario o rellene el formulario recién vaciado | La condición y las dependencias exactas de la sección 5, y los tests de los casos A, B y C |
| Que la vista previa de Vercel salga vacía por CORS y se tome por un fallo del refactor | Los requisitos de la sección 6. Si no se cumplen, basta la comprobación en local |
