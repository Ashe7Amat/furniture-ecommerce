# Tarea 4 — Diseño: partir `Admin.jsx` por pestañas

> **Estado: propuesta para revisión** (23 sep 2026). Decisiones de enfoque ya aprobadas: conservar el estado al
> cambiar de pestaña, no llevar las pestañas a la URL y escribir tests de caracterización antes de mover código.
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
  cambiaría qué mensaje se ve en qué pestaña: no en este refactor.
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

**Detalle que hay que conservar:** hoy `cargarCategorias()` pone la primera categoría específica en
`formData.categoria` si está vacía. Con `useAdminDatos`, eso pasa a un `useEffect` del contenedor sobre `categorias`.
En la práctica es equivalente, porque `categorias` solo cambia al recargarlas. Tiene su propio test de
caracterización ("al abrir Añadir mueble, la categoría preseleccionada es la primera específica").

## 6. Estrategia de tests

**Primero se caracteriza, luego se mueve.** Los tests se escriben contra el `Admin.jsx` actual y deben seguir en
verde, **sin tocarlos**, en cada commit del refactor. Es el invariante que demuestra que nada ha cambiado.

- **Qué se simula:** `vi.mock('../services/api')`, con cada función devolviendo lo que devuelve de verdad, incluido
  el `null` de error (el contrato actual de las escrituras, H12). `AuthContext` y `ToastContext` se simulan con su
  `Provider`. Es el mismo patrón que los tests de `Header`, `CartDrawer` y `CheckoutModal` de la tarea 5. **No se
  usa `fakeSupabase.js`**: ese doble es del servidor. El cliente solo habla con `api.js`.
- **Un archivo por pestaña**, no uno monolítico. Todos montan `<Admin />` (antes del refactor no hay pestañas
  sueltas) y entran por la barra lateral:
  - `Admin.resumen.test.jsx`: contadores, valor en stock, alertas de fotos y categoría, botón "Ver inventario".
  - `Admin.crear.test.jsx`: `FormData` enviado (con `categoria_id`), éxito que limpia y lleva al inventario, error.
  - `Admin.inventario.test.jsx`: búsqueda, filtros, orden, paginación de 20 en 20, selección de página, lote
    (estado y borrado), estado en línea, borrado con confirmación.
  - `Admin.pedidos.test.jsx`: filtro por estado, cambio de estado (éxito y error), datos del cliente.
  - `Admin.categorias.test.jsx`: crear (general y dentro de otra), editar, borrar, agrupación por categoría general.
  - `Admin.modales.test.jsx`: editar mueble (fotos existentes y nuevas) y editar categoría.
  - `Admin.navegacion.test.jsx`: cambiar de pestaña y volver **conserva** filtros, página y formularios a medio
    rellenar.
- **Los tests describen lo que hace hoy, aunque esté mal.** Los casos del H12 llevan este comentario y se cambiarán
  en el commit del arreglo, no antes:
  ```js
  // CARACTERIZACIÓN: comportamiento actual incorrecto (H12): enseña éxito aunque deleteMueble devuelva null.
  ```
- **Consultas:** por rol, etiqueta y texto visible. **Nada de instantáneas (snapshots):** romperían con cualquier
  cambio de marcado y no dirían qué comportamiento se ha perdido.
- **Durante el refactor** se añaden tests unitarios de las piezas nuevas que tienen lógica: `useInventarioVista`
  (con `renderHook`), `categorias.js` y `SelectorCategoria`.
- **Comprobación en el navegador al final:** servidor y cliente en local contra la API y recorrido de solo lectura
  por las cinco pestañas: filtros, paginación, abrir y cerrar modales sin guardar. Si hace falta probar guardar o
  borrar, será con una pieza de prueba creada y borrada con tu permiso, como en la verificación de multer.

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

1. `test(client): caracterización del panel — navegación y resumen`
2. `test(client): caracterización del panel — añadir mueble`
3. `test(client): caracterización del panel — inventario`
4. `test(client): caracterización del panel — pedidos y categorías`
5. `test(client): caracterización del panel — modales de edición`
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
