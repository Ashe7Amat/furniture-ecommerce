# Hero a pantalla completa y logotipo nuevo (5 oct 2026)

Capturas del antes y el después, hechas con Chromium (Playwright) sobre `npm run dev`, con la API
simulada de los E2E (`client/e2e/apiSimulada.js`) y con las fuentes reales de Google (Inter, Fraunces).

| Archivo | Qué es |
|---|---|
| `hero-1440-antes.jpg` / `hero-1440-despues.jpg` | Portada hasta el final del hero, a 1440 px |
| `hero-375-antes.jpg` / `hero-375-despues.jpg` | Lo mismo, a 375 px (móvil) |
| `header-1440-antes.jpg` / `header-1440-despues.jpg` | Cabecera a 1440 px |
| `header-375-antes.jpg` / `header-375-despues.jpg` | Cabecera a 375 px |

## Comprobado

- **Anchos 1440, 1024, 768 y 375:** sin scroll horizontal en ninguno. Desde 768 px, el hero mide el
  85 % de la altura de la ventana, con el texto abajo a la izquierda. Por debajo de 768 px, la foto va
  arriba (4:3) y el texto debajo, sobre el fondo oscuro.
  Antes, a 375 px, la cabecera se salía 12 px (con Fraunces, "Nave 5 Barcelona" ocupaba dos líneas y
  empujaba los iconos). Con el logo nuevo, ya no se sale.
- **Logo:** se ve en la cabecera y en el menú lateral, en modo claro y en modo oscuro. Toma el color
  del texto. El enlace se llama "Nave 5, ir al inicio" para los lectores de pantalla.
- **Tests:** los de Vitest de la cabecera y de la portada, y los 10 E2E, en verde.

## Contraste (WCAG AA)

**Cómo se ha medido.** El hero cambia entre 4 fotos, así que se ha medido con cada una, a 1440, 1024 y
768 px. Se oculta el texto, se fotografía lo que queda detrás de cada línea y se toma el píxel más
claro, que es el peor caso.

**El primer intento no pasaba.** Solo con el velo negro al 35 % que se pedía, la descripción bajaba a
**2,5:1** sobre las paredes blancas y el suelo, y el título a 2,5:1. El AA pide 4,5:1 para el texto
normal y 3:1 para el grande.

**La solución.** Encima del velo se ha añadido un degradado que sube desde abajo: 45 % de negro abajo,
35 % a media altura y nada al 90 %. Solo oscurece la zona del texto.

Resultado, en el peor píxel de las 4 fotos:

| Texto | 1440 px | 1024 px | 768 px | Mínimo AA |
|---|---|---|---|---|
| "Almacén de ideas" (12 px, #F5F2EC) | 6,37:1 | 5,25:1 | 4,90:1 | 4,5:1 |
| "NAVE 5" (texto grande) | 5,60:1 | 5,67:1 | 6,15:1 | 3:1 |
| "BARCELONA" (texto grande) | 7,35:1 | 7,23:1 | 6,76:1 | 3:1 |
| Descripción (16–18 px, blanco) | 6,13:1 | 6,11:1 | 6,02:1 | 4,5:1 |

**En móvil** el texto ya no va sobre la foto, sino sobre el fondo #221B16:
- blanco, 17,1:1;
- "Almacén de ideas" (#F5F2EC), 15,2:1.

**El botón "Descubrir"** es #1a1a1a sobre #F5F2EC: 15,5:1.
