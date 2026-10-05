# Auditoría de accesibilidad (5 oct 2026)

Rama `feature/mejoras-tecnicas`, sesión autónoma del 5 oct (tarea 4.1).

## Cómo se ha hecho

- **axe-core**, con `@axe-core/playwright` 4.13, en Chromium y con la API simulada de los E2E.
  - Reglas WCAG 2.0 y 2.1, niveles A y AA, más las de buenas prácticas de axe.
  - Páginas: portada, catálogo, ficha de una pieza, inicio de sesión, contacto, "Sobre nosotros" y 404, en
    modo claro y en modo oscuro. También con el buscador y el menú lateral abiertos.
- **Revisión del código** de lo que axe no ve: elementos con `onClick` que no son botones ni enlaces, botones
  de icono sin nombre y paneles ocultos que siguen recibiendo el foco.
- **Contraste de texto sobre foto:** el del hero se midió aparte (`docs/capturas-hero/README.md`).

Desde esta auditoría, `client/e2e/accesibilidad.spec.js` pasa axe por esas páginas en cada `npm run test:e2e`,
y falla si aparece un problema grave o crítico.

## Lo que se ha arreglado (graves y críticos, y lo que bloquea el teclado)

| # | Dónde | Problema | Gravedad | Arreglo |
|---|---|---|---|---|
| A1 | Contacto | Las etiquetas "Nombre", "Email" y "Mensaje" no estaban asociadas a sus campos: un lector de pantalla los anunciaba sin nombre | Crítico (axe `label`) | `htmlFor`/`id`, y `autoComplete` (`name`, `email`) |
| A2 | Contacto | Texto en terracota (#B38A70) sobre la arena: 2,76:1. Afecta al lema, al enlace del email y al texto del botón "Enviar Mensaje". El AA pide 4,5 | Grave (`color-contrast`) | Token nuevo `--accent-text` (#8A644C, 4,67:1) en modo claro. En oscuro, el acento ya pasaba |
| A3 | Portada y búsqueda | Etiqueta "VENDIDO": #A85338 sobre #F5E5DD, 4,32:1 | Grave (`color-contrast`) | `--danger-color` en modo claro, de #A85338 a #9C4A31 (4,98:1). Se nota también en las píldoras "vendido" del panel |
| A4 | Toda la web | No había `<main>`: el contenido quedaba fuera de cualquier región, ni había forma de saltar la cabecera con el teclado (WCAG 2.4.1, nivel A) | Moderado para axe, pero es un criterio de nivel A | `<main id="contenido">` y enlace "Saltar al contenido", visible al recibir el foco |
| A5 | Cesta lateral | Cerrada, solo se desplazaba fuera de la pantalla: con el tabulador se entraba en sus botones invisibles | Bloquea el teclado (axe no lo detecta) | Cerrada: `visibility: hidden` y `aria-hidden`. Abierta: diálogo con nombre, el foco va a "Cerrar cesta", Escape la cierra y el foco vuelve a donde estaba |
| A6 | Cabecera | El botón "☰" no tenía nombre (se leía "☰") | Bloquea el lector de pantalla | `aria-label="Abrir el menú"` y `aria-expanded` |
| A7 | Menú lateral, inicio de sesión y pago | Las "✕" no tenían nombre | Bloquea el lector de pantalla | "Cerrar el menú" y "Cerrar" |
| A8 | Buscador | Las sugerencias de categorías eran `<li>` con `onClick`: no se llegaba a ellas con el teclado | Bloquea el teclado | Botones dentro de cada `<li>` |
| A9 | Portada | Los círculos de "Compra por categoría" eran `<div>` con `onClick` | Bloquea el teclado | Enlaces (`<Link>`). La foto lleva `alt=""` porque la etiqueta ya da el nombre |

**Antes, en el mismo bloque de trabajo** (commits de H39, `6b53791`):
- el buscador se abre con un botón, recibe el foco, se cierra con Escape y devuelve el foco;
- en el móvil hay una lupa con nombre.

## Lo que queda (moderado, sin arreglar)

Con todo lo anterior, axe ya no encuentra nada de nivel A ni AA en esas páginas, ni en claro ni en oscuro.
Quedan avisos de buenas prácticas:

| # | Dónde | Aviso de axe | Por qué no se ha tocado |
|---|---|---|---|
| A10 | Catálogo (nombre de cada pieza), Contacto (bloques de datos), pie (boletín) | `heading-order`: se pasa de un `h1` o `h2` a un `h3` | **Arreglado el 5 oct (H43, `329a947`)**, sin cambios a la vista: medido antes y después. El E2E lo exige |
| A11 | Inicio de sesión | `page-has-heading-one`: no tiene `h1` | **Arreglado el 5 oct (H43, `329a947`)**: el título es el `h1`. El E2E lo exige |
| A12 | Cesta lateral | `region`: está fuera de `<main>` (va después del pie) | Es un diálogo, y cerrada ya está oculta (A5). Moverla dentro de `<main>` no aporta nada |

**Encontrado después (5 oct, noche), sin arreglar:** en Mi cuenta (`/cuenta`, que el E2E no recorre porque
hace falta sesión), dos campos sin etiqueta asociada (crítico), una etiqueta con poco contraste (grave) y dos
`<main>` (moderado): H47. Y el enlace del aviso de cookies, con 2,97:1 (grave): el E2E cierra el aviso antes de
pasar axe. Es H48. Los dos están en `docs/mejoras-tecnicas.md`.

**No revisado a fondo:** el panel de administración. Lo usa una sola persona y tiene sus propios tests congelados
(ver `docs/tarea4-diseno.md`); merece su propia pasada.
