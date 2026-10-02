# Fase C: ocultar precios al público (informe de cierre, 2 oct 2026)

Decisión del cliente: mientras termina de definir los precios, los visitantes ven el catálogo **sin
precios** y **no pueden comprar**; en su lugar, "Preguntar por esta pieza" les lleva a contacto. El panel
de administración ve y edita siempre los precios reales. Lo controla `MOSTRAR_PRECIOS` en el servidor.

## Commits

```
9d97017 fix(client): no sumar precios nulos al total del carrito (C4)
b736e8b feat(client): sustituir el carrito por "Preguntar por esta pieza" con precios ocultos (C3)
2c0fa80 feat(client): unificar el texto "Consultar precio" en el catálogo (C2)
296b741 feat(server): ocultar precios al público con MOSTRAR_PRECIOS (C1)
65e1ffe feat(client): avisar al cambiar el código de una categoría con muebles (bloque A)
d24db0b docs: corregir nombre de la migración de backfill
3c1a877 feat(db): rellenar referencias de los 114 muebles existentes
56d74d0 docs: propuesta de relleno de referencias, H32, caso de H12 y fin del freeze
(+ este commit: docs: cierre de la fase C)
```

| Commit | Qué |
|--------|-----|
| `296b741` | **C1** · servidor: `MOSTRAR_PRECIOS`, precios a null en las lecturas públicas, pago bloqueado. |
| `2c0fa80` | **C2** · cliente: "Consultar precio" unificado en todo el catálogo. |
| `b736e8b` | **C3** · cliente: "Preguntar por esta pieza" en vez de la cesta, con el mensaje de contacto precargado. |
| `9d97017` | **C4** · cliente: la cesta no suma líneas sin precio y no deja pagar con ellas. |

## Cómo activar o desactivar `MOSTRAR_PRECIOS`

| Valor (en el servidor) | Catálogo público | Compra | Panel |
|---|---|---|---|
| `true` (exacto, en minúsculas) | Con precios, como siempre | Sí | Precios reales |
| `false`, otro valor o **sin poner** (por defecto) | Sin precios: "Consultar precio" y "Preguntar por esta pieza" | No (403) | Precios reales |

- **Local:** en `server/.env`, `MOSTRAR_PRECIOS=false` o `MOSTRAR_PRECIOS=true`, y reiniciar el servidor.
- **Vercel (producción):** Settings > Environment Variables > `MOSTRAR_PRECIOS`, y **redesplegar**. La CDN
  guarda el catálogo unos minutos (`s-maxage=120` más `stale-while-revalidate=300`), así que el cambio
  puede tardar en verse.
- **Ojo al mergear:** sin la variable puesta, los precios quedan **ocultos**. Si se despliega este código en
  producción sin ponerla, la web deja de enseñar precios y de vender en ese momento. Antes del merge hay que
  decidir el valor con el cliente (según lo acordado, `false`) y ponerlo en Vercel.
- Documentado en `server/.env.example`, `docs/env-vars.md` y la tabla del `README`.

## Qué se ha hecho

### C1 · servidor (`296b741`)
- `server/src/utils/precios.js`: `preciosVisibles()` lee `MOSTRAR_PRECIOS` en cada petición (solo `"true"`
  enseña), y `paraElPublico()` pone `precio_venta` y `precio_alquiler_dia` a `null`.
- `GET /api/muebles` (también con `?limit`), `/api/muebles/buscar` y `/api/muebles/:id` pasan por
  `paraElPublico`. **Solo cambia la respuesta: la base de datos no se toca.**
- `GET /api/admin/muebles` (panel): siempre precios reales.
- **Añadido sobre el encargo: `POST /api/muebles/crear-sesion-pago` responde 403** con los precios ocultos
  ("La compra online no está disponible en este momento. Pregúntanos por la pieza en la página de
  contacto."), sin leer la base ni llamar a Stripe. Motivo: la decisión es que con precios ocultos **no se
  puede comprar**, y quitar el botón no basta. Una cesta guardada de antes, o una llamada directa a la ruta,
  cobraría el precio real, y la página de pago de Stripe lo enseñaría.
- Tests: `testEnv.js` fija `MOSTRAR_PRECIOS=true` para los tests de siempre (y así un `server/.env` local no
  cambia el resultado). `preciosOcultos.test.js` (27 tests) prueba los valores de la variable, las cuatro
  lecturas con y sin precios, que la base no se toca, el panel con los tres valores y el pago bloqueado.

### C2 · "Consultar precio" (`2c0fa80`)
- `utils/format.js`: `textoPrecio(mueble)` (venta; si no, alquiler por día; si no, "Consultar precio") y
  `tienePrecio(mueble)`. Un precio 0 cuenta como "sin precio", igual que antes en todo el catálogo.
- Sitios: `ProductCard`, `ProductsTable` (tarjeta móvil; en escritorio, la columna de venta), `QuickViewModal`,
  `ProductDetail` y, además de los del encargo, **la portada (`Home`) y los favoritos del perfil
  (`Profile`)**, que también decían "Consultar". `Header` no cambia (sigue vacío sin precio).
- `ProductDetail`: sin precio de venta decía "Consultar precio" aunque tuviera de alquiler. Ahora enseña el
  de alquiler, como el resto.
- `ProductCard`, pieza vendida sin ningún precio: antes salía "null €/día" tachado. Ahora no sale precio
  (pedir precio de algo vendido no tiene sentido).

### C3 · "Preguntar por esta pieza" (`b736e8b`)
- Una pieza **disponible y sin ningún precio** (los oculta el servidor o no tiene) no se compra: se
  pregunta. El cliente no lee `MOSTRAR_PRECIOS`: le basta con que los precios lleguen a null.
- `QuickViewModal`: "Añadir a la cesta" pasa a ser el enlace "Preguntar por esta pieza" (cierra la vista
  rápida). `ProductDetail`: lo mismo con "Añadir a mi cesta", y además se ocultan "Cantidad" y "Modalidad"
  (sin precios, el alquiler saldría "No disponible" aunque lo esté). `ProductCard` no tiene botón de cesta.
- Vendida o alquilada: siguen "Agotado" / "Alquilado", desactivados.
- **Precarga:** `Contact.jsx` no aceptaba nada, así que se añade un parámetro simple en la URL, sin
  dependencias: `/contacto?pieza=Nombre&ref=NAV-…`. Contact lo lee con `useSearchParams` (como `Profile`) y
  el mensaje empieza con: `Hola, me interesa la pieza "Aparador de roble" (ref. NAV-MES-004). ¿Me podéis dar
  más información?`. Se puede cambiar antes de enviar. Lo que llega por la URL se recorta (200 caracteres
  de nombre, 30 de referencia).
- Con algún precio (`MOSTRAR_PRECIOS=true`), todo como antes.

### C4 · la cesta (`9d97017`)
- **Hecho sin forzar nada**; no ha hecho falta parar.
- `validateCart` (al abrir la cesta y antes de pagar) deja cada línea con el precio que da hoy el catálogo.
  Con los precios ocultos llega null, y la línea pasa a "Consultar precio"; antes, una cesta guardada seguía
  con el precio viejo. Si el precio ha cambiado, enseña el de hoy, que es el que cobraría el servidor.
- `cartTotal` no suma las líneas sin precio. El contexto expone `hayLineasSinPrecio`.
- `CartDrawer`: la línea dice "Consultar precio", y "Confirmar Pedido" se desactiva con la explicación "Hay
  piezas sin precio en tu cesta. Quítalas para pagar, o pregúntanos por ellas en la página de contacto."
  `CheckoutModal` también lo comprueba antes de pagar, y el servidor responde 403 de todos modos.
- `addToCart` no añade una pieza sin precio para esa modalidad, y avisa.
- **Bug de antes, arreglado:** `QuickViewModal` añadía siempre en modalidad "compra", también una pieza que
  solo se alquila, que llegaba a la cesta sin precio. Ahora, sin precio de venta, la añade para alquilar.

## Gate

Cada parte en su propio comando, con la salida completa guardada. Ningún commit con el gate en rojo.

| Commit | Cliente: lint · tests · build | Servidor: lint · formato · tests |
|--------|-------------------------------|----------------------------------|
| Partida (`65e1ffe`) | ✅ · 599/599 · ✅ | ✅ · ✅ · 415/415 |
| C1 (`296b741`) | sin cambios | ✅ · ✅ · 442/442 |
| C2 (`2c0fa80`) | ✅ · 605/605 · ✅ | sin cambios |
| C3 (`b736e8b`) | ✅ · 621/621 · ✅ | sin cambios |
| C4 (`9d97017`) | ✅ · 632/632 · ✅ | sin cambios |

## Cobertura antes y después

| | Líneas | Ramas | Funciones |
|---|---|---|---|
| **Cliente** · umbral | 81 | 93 | 86 |
| Partida | 85,48 | 94,79 | 88,29 |
| C2 | 85,54 | 94,93 | 88,32 |
| C3 | 85,64 | 95,00 | 88,40 |
| C4 (final) | **85,71** | **95,07** | **88,47** |
| **Servidor** · umbral | 94 | 83 | 98 |
| Partida | 95,99 | 86,67 | 98,73 |
| C1 (final) | **96,02** | **86,88** | **98,76** |

## Tests cambiados a propósito

Marcados con `CAMBIADO A PROPÓSITO (fase C, 2 oct 2026)`:
- `ProductCard.test.jsx` y `Profile.test.jsx`: "Consultar" pasa a "Consultar precio".
- `ProductDetail.test.jsx`: sin precio de venta, enseña el de alquiler.
- `Contact.test.jsx`: la página se monta dentro de un router (ahora lee la URL).
- `CheckoutModal.test.jsx`: la línea de prueba lleva precio, como cualquier línea real.

Ningún `Admin.*.test.jsx` se ha tocado en esta fase.

## Mutación del panel

`node scripts/mutantes-panel.js` sobre el estado final (`9d97017`): **127 mutantes, 126 detectados + 1
superviviente esperado** (el caso B de `crear`), con el mutante de control detectado. La fase C no toca
ningún archivo del panel.

## Puntos de parada

- **Ninguno en el código.** Las cuatro partes, C4 incluida, se han hecho enteras.
- **Antes del merge (decisión del cliente, no técnica):** el valor de `MOSTRAR_PRECIOS` en Vercel. Sin
  ponerla, producción oculta precios y deja de vender en cuanto se despliegue.
- **Comprobación en el navegador** (no hecha aquí): las dos listas de "Lo que verificarás después" del
  encargo.

## Hallazgos

1. **El pago no estaba cerrado solo con quitar el botón** (resuelto en C1 con el 403): una cesta guardada o una
   llamada directa a `crear-sesion-pago` habría cobrado el precio real con los precios "ocultos".
2. **`QuickViewModal` añadía siempre en modalidad "compra"**, también piezas que solo se alquilan, y la línea
   llegaba a la cesta sin precio. Arreglado en C4.
3. **La cesta guardada no actualizaba nunca sus precios:** `validateCart` solo quitaba las vendidas. Con un
   cambio de precio, la cesta enseñaba el viejo y Stripe cobraba el nuevo. Arreglado en C4.
4. **`ProductCard` enseñaba "null €/día" tachado** en una pieza vendida sin precio. Arreglado en C2.
5. **`ProductDetail` decía "Consultar precio" con precio de alquiler.** Arreglado en C2.
6. **"Ordenar por precio" del catálogo no hacía nada con los precios ocultos** (`Catalog.jsx`): todas las piezas
   llegan con `null` y el orden no cambiaba. **Resuelto después del cierre** (`45502c4`, con el OK del
   usuario): si ninguna pieza del catálogo cargado tiene precio, el selector no sale. `Catalog.jsx` no tenía
   tests; ahora tiene 4. Cliente: 636/636, cobertura 88,57 / 94,04 / 88,07 (sube en líneas y baja un punto
   en ramas, al empezar a contar `Catalog.jsx`; todo por encima de los umbrales).
7. **El panel ve los precios en el panel, no en el catálogo público:** un administrador que navegue por la web
   pública la ve como cualquier visitante, sin precios. Es a propósito: las lecturas públicas se guardan en la
   CDN (`Cache-Control: public`) y no pueden depender de quién las pide.
8. **9 archivos de test del servidor no cargan `testEnv.js`** y corren con `MOSTRAR_PRECIOS` sin poner (precios
   ocultos). Hoy ninguno depende de los precios públicos; si alguno lo necesitara, tendría que cargarlo.
