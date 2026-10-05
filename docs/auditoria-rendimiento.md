# Auditoría de rendimiento del cliente (5 oct 2026)

Rama `feature/mejoras-tecnicas`, sesión autónoma del 5 oct (tarea 4.2).

## Cómo se ha medido

- `vite build --sourcemap` y un script que reparte los bytes del paquete inicial entre sus archivos de origen,
  usando el sourcemap.
- Los tamaños son los que imprime Vite, sin comprimir y con gzip.

## Punto de partida

**Las rutas ya se cargaban bajo demanda** (`React.lazy` en `App.jsx`, desde antes de esta sesión). Cada página
tiene su chunk: el panel (`Admin`, 48 KB), el catálogo (14 KB), la ficha, la cuenta, etc. Solo la portada va
en el paquete inicial, a propósito, porque es la página de entrada.

**Paquete inicial antes del cambio:** 217,5 KB de JS (69,0 KB con gzip) y 41,3 KB de CSS (8,2 KB con gzip).

De qué está hecho el JS inicial:

| Origen | Bytes | % |
|---|---|---|
| `react-dom` | 130 661 | 60,1 |
| `react-router` + `@remix-run/router` + `react-router-dom` | 21 316 | 9,8 |
| `react` + `scheduler` | 11 158 | 5,1 |
| `Header.jsx` | 10 580 | 4,9 |
| `services/api.js` | 7 798 | 3,6 |
| **`CheckoutModal.jsx`** | **7 178** | **3,3** |
| `Home.jsx` | 4 492 | 2,1 |
| `CartDrawer.jsx` | 4 161 | 1,9 |
| **`AuthModal.jsx`** | **2 766** | **1,3** |
| El resto (App, contextos, pie, logo, cookies…) | ~17 000 | ~8 |

Tres cuartas partes son React y React Router: no se pueden quitar sin cambiar de librería (por ejemplo, a
Preact), y no compensa.

## Lo que se ha cambiado

**`CheckoutModal` y `AuthModal` pasan a `React.lazy`**, dentro de `CartDrawer.jsx`, con su CSS. Venían en el
paquete inicial de todas las páginas, pero solo se usan desde la cesta, al pagar o al iniciar sesión antes de
pagar.
- **Cuándo se descargan:** al abrir la cesta. Así, "Confirmar Pedido" no espera.
- **Cuándo se montan:** la primera vez que hacen falta, y se quedan montados para no perder sus animaciones
  de cierre.

| Paquete inicial | Antes | Después | Ahorro |
|---|---|---|---|
| JS | 217,5 KB (69,0 gzip) | 208,0 KB (66,5 gzip) | 9,5 KB (2,5 gzip) |
| CSS | 41,3 KB (8,2 gzip) | 34,1 KB (7,2 gzip) | 7,2 KB (1,0 gzip) |

**Comprobado en el navegador:** los chunks no se piden hasta abrir la cesta, y el modal de inicio de sesión
sale al pulsar "Confirmar Pedido". Los tests de `CartDrawer` siguen en verde sin cambios.

## Recomendaciones (sin hacer)

1. **Fotos del hero en tamaños para el móvil (lo que más pesa).** Las cuatro fotos del slider son WebP de
   1600×1200 o 1200×1600, de 197 a 405 KB. En el móvil se enseñan a 375 px de ancho, y la primera
   (`hero-almacen.webp`, 367 KB) es la imagen más grande de la portada (LCP).
   - **Propuesta:** versiones de 800 px de ancho y `srcset`/`sizes` en `Home.jsx`. Por proporción, deberían
     quedar en unos 80-120 KB cada una.
   - **Por qué no se ha hecho:** el ImageMagick del contenedor no escribe WebP, y no se han querido subir
     imágenes generadas con otra herramienta sin verlas.
2. **`hero-showroom.webp` es vertical** (1200×1600), pero el hero de escritorio es apaisado: se recorta más de
   la mitad de la foto, y se descarga entera. Mejor una versión apaisada.
3. **Fuentes:** van desde Google Fonts con `preconnect` y `display=swap`, que es lo correcto. Se piden
   Fraunces (4 variantes) e Inter (4 pesos). Desde el logo en SVG (sesión del hero), Fraunces ya no está en
   la cabecera, pero se sigue usando en títulos. Revisar si hacen falta las cuatro variantes.
4. **`Header.jsx` (10,6 KB)** incluye el buscador y el menú lateral, que solo se abren al pulsar. Se podrían
   cargar bajo demanda como los modales, pero el ahorro (unos 3 KB con gzip) no compensa el retraso al
   abrirlos por primera vez.
