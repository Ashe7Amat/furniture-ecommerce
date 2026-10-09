# Limpieza del catálogo y alta de los espejos (9 oct 2026)

Cambios en la base de datos de producción hechos el 9 de octubre a partir de:

- la hoja que rellenó el cliente, "Inventario de piezas y fotos — revisión con cliente" (Google Sheets), con
  las columnas Duplicado, Duplicado de, Foto mal asignada y Notas;
- el PDF "Espejos Props NAVE5 01_10_2026" (6 fotos de 5 espejos, con el nombre y las medidas escritos en
  cada foto).

El usuario aprobó la limpieza antes de aplicarla. Resultado: de 87 piezas se pasa a **64**. Se añaden 5 espejos y
se quitan 28 fichas: 25 fusionadas en otras y 3 eliminadas. Quedan 172 fotos distintas, ninguna repetida en dos
fichas y ninguna pieza sin foto.

## Antes de empezar

- Copia de seguridad de las 92 filas de `muebles` (las 87 de antes y los 5 espejos ya creados), tomada justo
  antes de aplicar los cambios. Está fuera del repositorio, en la carpeta temporal de la sesión:
  `copia-muebles-antes.json`. Si hiciera falta deshacer algo, cada fila trae todas sus columnas.
- Ningún pedido apunta a las piezas quitadas, salvo un pedido de prueba cancelado del 4 sep (NAV-BAU-014).
  El pedido guarda el nombre y el precio de la pieza, y la pestaña Pedidos del panel enseña ese nombre, así que
  no cambia nada.
- Ya faltaba **NAV-SIL-013** (Silla Pieza Curva Metal). Estaba en la hoja del 8 oct, pero el 9 ya no estaba
  en la base de datos. Se borró desde el panel, no en este cambio.

## Fusiones: las fotos de la ficha duplicada pasan a la suya

La ficha que se queda conserva su nombre, su precio y su primera foto (la portada). Las fotos de la duplicada se
añaden al final. El precio de la duplicada se pierde con ella; por si el cliente quiere revisarlo, va en la tabla.

| Ficha quitada | Precio que tenía | Pasa a | Precio que se queda |
|---|---|---|---|
| NAV-BAU-002 Baules Militares Apilados | 105 € | NAV-BAU-001 | 110 € |
| NAV-BAU-005 Maletas Apiladas Colores | 140 € | NAV-BAU-001 | 110 € |
| NAV-BAU-006 Baul Cierre Atlanta Detalle | 95 € | NAV-BAU-018 | 85 € |
| NAV-BAU-008 Baul Metal Laton Cerrado | 115 € | NAV-BAU-004 | 80 € |
| NAV-BAU-010 Baul Marron Cerrado Cierre | 105 € | NAV-BAU-004 | 80 € |
| NAV-BAU-012 Maletin Asa Cerradura Detalle | 75 € | NAV-BAU-003 | 125 € |
| NAV-BAU-013 Baul Madera Cierre Laton | 185 € | NAV-BAU-003 | 125 € |
| NAV-BAU-015 Baul Madera Cierre Esquina | 135 € | NAV-BAU-003 | 125 € |
| NAV-BAU-017 Baul Esquina Tela Detalle | 130 € | NAV-BAU-003 | 125 € |
| NAV-BID-010 Caja Metal Verde Abierta | 90 € | NAV-BAU-004 | 80 € |
| NAV-BID-011 Bidon Metal Cierre Asa | 65 € | NAV-BID-021 | 35 € |
| NAV-BID-014 Tapa Metal Oxidada Cuadrada | 50 € | NAV-SIL-008 | 90 € |
| NAV-BID-015 Bidon Metal Abierto Tapa | 40 € | NAV-BID-021 | 35 € |
| NAV-BID-019 Tapacubos Metal Cubo Negro | 70 € | NAV-OBJ-009 | 25 € |
| NAV-BID-023 Tapa Metal Patinada Rectangular | 40 € | NAV-BAU-003 | 125 € |
| NAV-OBJ-001 Bandeja Madera Espejo Oval | 40 € | NAV-BAU-018 | 85 € |
| NAV-OBJ-015 Pomo Porcelana Blanca | 15 € | NAV-OBJ-008 | 40 € |
| NAV-ILU-003 Lampara Globo Blanco Antigua | 120 € | NAV-OBJ-008 | 40 € |
| NAV-PUE-003 Puertas Madera Espejo Apoyadas | 155 € | NAV-PUE-002 | 185 € |
| NAV-PUE-005 Armario Madera Antiguo Espejo | 225 € | NAV-PUE-002 | 185 € |
| NAV-SIL-003 Silla Bistro Madera Azul | 60 € | NAV-SIL-001 | 120 € |
| NAV-SIL-011 Silla Plegable Azul | 40 € | NAV-SIL-001 | 120 € |
| NAV-SIL-014 Silla Plegable Antigua Frontal | 60 € | NAV-SIL-002 | 60 € |

Dos fichas tenían fotos que iban a dos sitios distintos:

- **NAV-BAU-014** Baul Viaje Abierto Verde (110 €): "Foto2 y foto3 van a 004 y foto1 y foto4 van a 018".
  `001-baul-viaje-abierto-verde-2.jpg` y `-3.jpg` pasan a NAV-BAU-004; `001-baul-viaje-abierto-verde-1.jpg` y
  `012-baul-interior-verde-vacio-1.jpg` pasan a NAV-BAU-018.
- **NAV-BAU-019** Maletin Madera Abierto Vacio (60 €): duplicada de NAV-BAU-016, con la nota "las fotos
  correctas son la foto2 y foto3, la foto1 pertenece a otro producto". `025-…` y `026-…` pasan a NAV-BAU-016, y
  la foto 1, `024-maletin-madera-abierto-vacio-1.jpg`, va a NAV-BAU-003. Es la que el cliente señaló en esa
  ficha como foto mal asignada.

## Eliminadas (nota "eliminar" del cliente)

- NAV-BID-028 Patas Metal Oxidadas Detalle (55 €)
- NAV-MES-004 Mesa Metal Cristal Esmerilado (90 €)
- NAV-PUE-001 Panel Madera Borde Dorado (125 €)

Sus 4 fotos siguen en Storage (no se ha borrado ningún archivo), pero ya no las usa ninguna ficha.

## Espejos nuevos (categoría Espejos)

Dados de alta por el mismo camino que el panel: la foto pasa a WebP de 1600 px con su miniatura de 400 px, y la
referencia es automática. Sin precio, como las piezas nuevas del 6 oct. El nombre y las medidas son los que
escribió el cliente en cada foto, y la descripción sale de lo que se ve.

| Referencia | Nombre | Descripción |
|---|---|---|
| NAV-ESP-001 | Espejo de salón | Espejo rectangular con marco fino negro. Medidas: 136 x 103 cm. |
| NAV-ESP-002 | Espejo vintage marco inox | Espejo rectangular con marco fino de acero inoxidable. Medidas: 81 x 61 x 1,5 cm. |
| NAV-ESP-003 | Espejo tipo maqui | Espejo rectangular sin marco, con luz en la parte de arriba. La luz no funciona. Medidas: 100 x 90 x 3 cm. |
| NAV-ESP-004 | Espejo vintage | Espejo con marco de madera oscura tallada y remate curvo en la parte de arriba. Medidas: 100 x 90 cm (alto). |
| NAV-ESP-005 | Espejo alargado | Espejo alargado y estrecho. Medidas: 230 x 25 x 2 cm. |

- El PDF trae dos fotos del espejo de salón: la misma, una con el texto escrito encima y otra limpia. Se ha
  usado solo la limpia.
- Las fotos de los otros cuatro llevan el texto del cliente (nombre y medidas) escrito encima, porque no hay
  otra versión. Si el cliente manda fotos sin texto, se cambian desde el panel.
- "Espejo alargado" es un nombre puesto aquí: en la foto solo pone "Espejo". "Espejo tipo maqui" y "100x90 Alto"
  se han dejado como los escribió el cliente.
