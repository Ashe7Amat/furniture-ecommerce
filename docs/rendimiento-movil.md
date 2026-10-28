# Rendimiento en móvil (28 oct 2026)

## Cómo se midió

- Lighthouse 12 en modo móvil (Moto G con 4G lenta y CPU 4x más lenta, lo que usa PageSpeed Insights),
  dos pasadas por página, sobre el build de `main` servido en local con el catálogo real de la API
  publicada (83 piezas). Desde el entorno de Claude no se llega a nave5barcelona.com ni a Supabase
  Storage, y PageSpeed Insights no tenía cupo ese día, así que las fotos de Supabase se sirven con el
  peso medio real de cada tipo: JPG 291 KB, WebP antigua 396 KB, `-full.webp` 153 KB, `-thumb.webp` 31 KB.
- Los pesos de las fotos salen de `storage.objects` (metadatos del bucket `imagenes`) y de
  `muebles.imagenes`, leídos en producción solo con SELECT.

## Resultado (mediana de dos pasadas)

| Página | Antes | Después |
|---|---|---|
| Portada | 76-95 puntos, LCP 2,7-3,9 s, 1.212 KB | 95-97, LCP 2,2-2,7 s, 745-923 KB |
| Catálogo | 84-87, LCP 3,8-3,9 s, 501 KB | 89, LCP 3,4-3,5 s, 402 KB |
| Ficha (pieza con foto antigua) | 81-82, LCP 4,4-4,6 s, 707 KB | 83-84, LCP 4,1 s, 609 KB |

Lo que cambia este PR:

1. **Caché** (`client/vercel.json`): Vercel servía todo con `max-age=0, must-revalidate`, también los
   archivos de `/assets` (llevan el hash del contenido en el nombre). Cada visita repetida volvía a
   preguntar por cada JS, CSS y foto. Ahora `/assets` se guarda un año (`immutable`) y `/img` y `/audio`
   un día, con otra semana de `stale-while-revalidate`. Lighthouse mide la primera visita, así que esta
   mejora no sale en la tabla: se nota al volver a la web o al pasar de una página a otra.
2. **Precarga de la foto del hero solo en la portada** (`client/index.html`): los `<link rel="preload">`
   fijos hacían que quien entraba por el catálogo o por una ficha (enlaces de Google, Wallapop o
   Instagram) descargara también la foto del hero (100 KB en el móvil) con prioridad alta. Ahora la
   precarga la pone un script de una línea solo si la ruta es `/`. Su hash está en la CSP; el test
   `cspVercel.test.js` falla si se cambia el script sin actualizarlo.
3. **Galería de la portada**: en el móvil pide la versión de 800 px de las dos fotos (61 y 121 KB en vez
   de 167 y 311 KB).

## Lo que más pesa y no se arregla con código: las fotos antiguas

Las tarjetas del catálogo piden la miniatura de 400 px de cada foto (H61), pero **50 de las 83 piezas**
tienen fotos subidas antes de las miniaturas (141 JPG de septiembre y 10 WebP del 6 de octubre). Para
esas, la tarjeta descarga la foto entera:

- Catálogo entero en el móvil: **16,3 MB** de portadas, de los que **15,2 MB** son esas 50 piezas
  (media 300 KB por foto, para pintarla a unos 300 px).
- Con miniaturas serían unos **2,7 MB** (las 33 piezas nuevas ya pesan 32 KB de media por tarjeta).

`server/scripts/miniaturasFotosAntiguas.js` (`npm run fotos:miniaturas`) las pasa al formato de hoy:
crea `<nombre>-thumb.webp` y `<nombre>-full.webp` con los mismos ajustes que una subida desde el panel y
cambia la URL en `muebles.imagenes`. No borra nada y guarda un JSON con las listas de antes y después de
cada mueble para poder volver atrás. Sin `--aplicar` solo simula. **Es un cambio en producción** (bucket
y tabla `muebles`): se ejecuta solo con el OK escrito de Ashe.

## Ideas que no entran aquí

- La ficha tarda en pintar la foto porque su URL llega con la API, después del JavaScript (LCP 4,1 s).
  Arreglarlo de verdad pide renderizar en el servidor (SSR), un cambio grande.
- `VITE_WEBP_OPTIMIZADAS` y `npm run images:optimize` (variantes -400/-800/-1200) no cubren las fotos
  `-full.webp` ni las WebP antiguas: si se activara hoy, las tarjetas de esas piezas pedirían archivos que
  no existen. Las miniaturas de este script son el camino que ya usa el panel.
