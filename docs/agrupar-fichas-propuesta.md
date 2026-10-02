# Fichas que pueden ser el mismo objeto — propuesta para agrupar

> **Aplicada el 2 oct 2026, con autorización del cliente.** El catálogo pasó de 114 a 77 fichas. Las fotos de
> esta página siguen funcionando: las de las fichas borradas no se tocaron en el almacenamiento, ahora salen
> en la ficha que se quedó. Lo que sigue debajo es la propuesta tal como se revisó.

## Qué se decidió y qué se hizo

- **Grupos 1-10 y 13-17: sí.** La ficha marcada "← se queda" recibió las fotos de las demás del grupo, en el
  orden de la lista, y las demás se borraron. Los coches (grupo 8) quedaron en una sola ficha, "Lote Coches
  Juguete" (NAV-JUG-001, 15 fotos), y los bidones turquesa (grupo 17) en una sola, NAV-BID-004 (14 fotos). El
  grupo 7 pasó a llamarse "Lampara Globo Blanco Antigua" (NAV-ILU-003).
- **Grupo 11 (percheros de latón, NAV-MES-001 y NAV-MES-003): borrados.** La foto es mala y no se quieren
  vender.
- **Grupo 12 (mesa sobre bidones, NAV-MES-002 y NAV-MES-009): borrados.** La mesa y los bidones no se venden
  juntos.
- Se borraron 37 fichas en total (33 juntadas y 4 que no se venden). Sus referencias no se reutilizan, así que
  quedan huecos, como NAV-PUE-004. Ningún pedido apuntaba a una ficha borrada.

Se hizo en tres pasos, porque `apply_migration` se colgaba (más de 60 s, sin llegar a la base) con la
migración entera y con cualquier migración que llevara `DELETE`:

| Paso | Cómo | Versión / nombre |
|---|---|---|
| 1. Copia de las 52 fichas afectadas en `public.respaldo_agrupacion_muebles_20261002` (RLS sin políticas) | `apply_migration` | `20261002193936` `respaldo_agrupacion_muebles` |
| 2. Juntar las fotos en las 15 fichas que se quedan y cambiar 2 nombres | `apply_migration` | `20261002200855` `agrupar_fichas_juntar_fotos` |
| 3. Borrar las otras 37 fichas de la copia | El cliente, en el SQL Editor de Supabase (no consta en `schema_migrations`) | — |

Comprobado después del paso 3: 77 fichas, las 15 principales con las fotos previstas, la copia con sus 52
fichas y ningún pedido apuntando a una ficha que ya no existe.

SQL del paso 3, tal como se ejecutó:

```sql
DELETE FROM public.muebles m
USING public.respaldo_agrupacion_muebles_20261002 r
WHERE m.id = r.id
  AND r.referencia NOT IN ('NAV-PUE-003', 'NAV-ILU-001', 'NAV-OBJ-004', 'NAV-OBJ-003', 'NAV-OBJ-009',
    'NAV-OBJ-011', 'NAV-ILU-003', 'NAV-JUG-001', 'NAV-OBJ-006', 'NAV-OBJ-008', 'NAV-SIL-003',
    'NAV-SIL-008', 'NAV-BAU-014', 'NAV-BAU-019', 'NAV-BID-004');
```

**Para deshacerlo**, en este orden: primero se vuelven a crear las fichas borradas (deshace el paso 3); luego
el `.down.sql` del paso 2 devuelve sus fotos y su nombre a las 15 que se quedaron. El `.down.sql` del paso 1
borra la copia, así que va el último y solo si ya no hace falta.

```sql
-- ADVERTENCIA: vuelve a crear las fichas borradas, con su id y su referencia, desde la copia. Si después se
-- ha dado de alta otra ficha con alguna de esas referencias, fallará por el índice único.
INSERT INTO public.muebles (id, nombre, categoria, descripcion, precio_venta, precio_alquiler_dia, disponible, imagenes, created_at, estado, categoria_id, referencia)
SELECT r.id, r.nombre, r.categoria, r.descripcion, r.precio_venta, r.precio_alquiler_dia, r.disponible, r.imagenes, r.created_at, r.estado, r.categoria_id, r.referencia
FROM public.respaldo_agrupacion_muebles_20261002 r
WHERE NOT EXISTS (SELECT 1 FROM public.muebles m WHERE m.id = r.id);
```

---

Muchas piezas del catálogo están repetidas: se dio de alta una ficha por foto, y una misma pieza fotografiada
desde varios ángulos aparece como productos distintos. Esta lista propone qué fichas juntar en una sola.

- **Confianza alta:** se ve en las capturas que enviaste el 2 oct.
- **Confianza media:** solo lo sugiere el nombre de la ficha. Hay que mirar las fotos.

Hay fotos que no he podido ver (desde mi entorno no se pueden descargar), así que esta propuesta no está
completa: puede haber más grupos. Es el problema inverso al de `docs/duplicados-candidatos.md` (allí, una sola ficha
con fotos de piezas distintas); los dos se resuelven juntos.

**Qué pasaría al juntar un grupo:** se queda la primera ficha de la lista (con su referencia), recibe todas las
fotos de las demás y las demás se borran. Sus referencias desaparecen y no se reutilizan. Se puede cambiar el
nombre de la ficha que queda. Antes de borrar se guarda una copia, para poder deshacerlo.

**Cómo responder:** para cada grupo, "sí", "no" o "sí, pero sin tal ficha" (y, si quieres, el nombre que debe
llevar). Para los coches y los bidones, cuántas piezas hay de verdad.

## 1. Par de puertas de madera con cristal · confianza alta

En tu captura salen la misma escena (la bata blanca y el mueble cajonero detrás) y la misma pareja de puertas desde varios ángulos. Puede ser **una ficha** (el par) o **dos** (la puerta de cuarterones y la de cristal): eso lo decides tú.

**NAV-PUE-003** · Puertas Madera Espejo Apoyadas ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/133-puertas-madera-espejo-apoyadas-1.jpg" width="150" alt="133-puertas-madera-espejo-apoyadas-1">

**NAV-PUE-004** · Puertas Madera Cesta<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/132-puertas-madera-cesta-1.jpg" width="150" alt="132-puertas-madera-cesta-1">

**NAV-PUE-006** · Puerta Madera Espejo Reflejo<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/134-puerta-madera-espejo-reflejo-1.jpg" width="150" alt="134-puerta-madera-espejo-reflejo-1">

**NAV-PUE-007** · Puertas Madera Espejo Par<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/131-puertas-madera-espejo-par-1.jpg" width="150" alt="131-puertas-madera-espejo-par-1">

**NAV-PUE-008** · Puerta Madera Antigua Apoyada<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/130-puerta-madera-antigua-apoyada-1.jpg" width="150" alt="130-puerta-madera-antigua-apoyada-1">

**NAV-PUE-009** · Puerta Madera Bisagra Espejo<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/135-puerta-madera-bisagra-espejo-1.jpg" width="150" alt="135-puerta-madera-bisagra-espejo-1">

## 2. Lámpara industrial metálica · confianza alta

En tu captura, las tres son la misma campana metálica con remate plateado.

**NAV-ILU-001** · Lampara Industrial Plateada ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/076-lampara-industrial-plateada-1.jpg" width="150" alt="076-lampara-industrial-plateada-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/077-lampara-industrial-plateada-1.jpg" width="150" alt="077-lampara-industrial-plateada-1">

**NAV-ILU-002** · Lampara Industrial Repisa<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/079-lampara-industrial-repisa-1.jpg" width="150" alt="079-lampara-industrial-repisa-1">

**NAV-ILU-005** · Lampara Industrial Metal<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/075-lampara-industrial-metal-1.jpg" width="150" alt="075-lampara-industrial-metal-1">

## 3. Adorno de hierro forjado · confianza alta

En tu captura, la misma pieza en forma de cruz, sobre azulejo blanco.

**NAV-OBJ-004** · Adorno Hierro Forjado ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/060-adorno-hierro-forjado-1.jpg" width="150" alt="060-adorno-hierro-forjado-1">

**NAV-OBJ-014** · Adorno Hierro Forjado Cruz<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/067-adorno-hierro-forjado-cruz-1.jpg" width="150" alt="067-adorno-hierro-forjado-cruz-1">

## 4. Escultura de pie · confianza alta

En tu captura, el mismo pie (de frente y de lado).

**NAV-OBJ-003** · Escultura Pie Detalle ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/056-escultura-pie-detalle-1.jpg" width="150" alt="056-escultura-pie-detalle-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/056-escultura-pie-detalle-2.jpg" width="150" alt="056-escultura-pie-detalle-2">

**NAV-OBJ-010** · Escultura Pie Madera<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/066-escultura-pie-madera-1.jpg" width="150" alt="066-escultura-pie-madera-1">

## 5. Barril de madera con tapa metálica · confianza alta

En tu captura: el barril con la tapa, el mismo barril de lado ("acetato sódico") y un primer plano de la tapa.

**NAV-OBJ-009** · Barril Madera Tapa Metalica ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/073-barril-madera-tapa-metalica-1.jpg" width="150" alt="073-barril-madera-tapa-metalica-1">

**NAV-OBJ-012** · Barril Madera Acetato Sodico<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/070-barril-madera-acetato-sodico-1.jpg" width="150" alt="070-barril-madera-acetato-sodico-1">

**NAV-BID-022** · Tapa Metal Recipiente Madera<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/043-tapa-metal-recipiente-madera-1.jpg" width="150" alt="043-tapa-metal-recipiente-madera-1">

## 6. Llavero recuerdo de Barcelona · confianza alta

En tu captura, "Hebilla Candado Metal" es el mismo llavero abierto.

**NAV-OBJ-011** · Llavero Souvenir Barcelona ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/074-llavero-souvenir-barcelona-1.jpg" width="150" alt="074-llavero-souvenir-barcelona-1">

**NAV-OBJ-016** · Hebilla Candado Metal<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/068-hebilla-candado-metal-1.jpg" width="150" alt="068-hebilla-candado-metal-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/072-hebilla-candado-metal-azul-1.jpg" width="150" alt="072-hebilla-candado-metal-azul-1">

## 7. Lámpara de globo de cristal blanco · confianza media

En tu captura parecen el exterior y el interior del mismo globo blanco, pero no es seguro.

**NAV-ILU-003** · Lampara Pantalla Blanca Interior ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/080-lampara-pantalla-blanca-interior-1.jpg" width="150" alt="080-lampara-pantalla-blanca-interior-1">

**NAV-ILU-004** · Lampara Globo Blanco Antigua<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/078-lampara-globo-blanco-antigua-1.jpg" width="150" alt="078-lampara-globo-blanco-antigua-1">

## 8. Coches de juguete · confianza media

En tu captura se ven los mismos coches repetidos entre fichas (el familiar beige, el amarillo, el taxi rojo...). Hay que decidir si se venden **como lote** (una ficha) o **sueltos** (una ficha por coche, repartiendo las fotos).

**NAV-JUG-001** · Coche Juguete Familiar Blanco ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/084-coche-juguete-familiar-blanco-1.jpg" width="150" alt="084-coche-juguete-familiar-blanco-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/085-coches-juguete-tres-1.jpg" width="150" alt="085-coches-juguete-tres-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/089-coches-juguete-mesa-1.jpg" width="150" alt="089-coches-juguete-mesa-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/086-coches-juguete-beige-detalle-1.jpg" width="150" alt="086-coches-juguete-beige-detalle-1">

**NAV-JUG-002** · Coches Juguete Amarillo Rojo<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/090-coches-juguete-amarillo-rojo-1.jpg" width="150" alt="090-coches-juguete-amarillo-rojo-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/093-coches-juguete-amarillo-rojo-pareja-1.jpg" width="150" alt="093-coches-juguete-amarillo-rojo-pareja-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/092-coche-juguete-amarillo-detalle-1.jpg" width="150" alt="092-coche-juguete-amarillo-detalle-1">

**NAV-JUG-003** · Coche Juguete Familiar<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/083-coche-juguete-familiar-1.jpg" width="150" alt="083-coche-juguete-familiar-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/091-coche-juguete-familiar-beige-1.jpg" width="150" alt="091-coche-juguete-familiar-beige-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/095-coche-juguete-familiar-beige-1.jpg" width="150" alt="095-coche-juguete-familiar-beige-1">

**NAV-JUG-004** · Coche Juguete Taxi Metal<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/081-coche-juguete-taxi-metal-1.jpg" width="150" alt="081-coche-juguete-taxi-metal-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/087-coche-juguete-taxi-rojo-1.jpg" width="150" alt="087-coche-juguete-taxi-rojo-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/088-coche-juguete-taxi-rojo-1.jpg" width="150" alt="088-coche-juguete-taxi-rojo-1">

**NAV-JUG-005** · Coches Juguete Miniatura<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/082-coches-juguete-miniatura-1.jpg" width="150" alt="082-coches-juguete-miniatura-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/094-coches-juguete-tres-fila-1.jpg" width="150" alt="094-coches-juguete-tres-fila-1">

## 9. Teléfono antiguo de disco · confianza media

Solo por el nombre: no se ve en tus capturas.

**NAV-OBJ-006** · Telefono Gris Disco Antiguo ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/064-telefono-gris-disco-antiguo-1.jpg" width="150" alt="064-telefono-gris-disco-antiguo-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/065-telefono-gris-disco-1.jpg" width="150" alt="065-telefono-gris-disco-1">

**NAV-OBJ-007** · Telefono Antiguo Disco<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/061-telefono-antiguo-disco-1.jpg" width="150" alt="061-telefono-antiguo-disco-1">

## 10. Jarrón de cerámica blanco · confianza media

Solo por el nombre.

**NAV-OBJ-008** · Jarron Ceramica Blanco Bidones ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/069-jarron-ceramica-blanco-bidones-1.jpg" width="150" alt="069-jarron-ceramica-blanco-bidones-1">

**NAV-OBJ-013** · Jarron Ceramica Blanco Ovalado<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/063-jarron-ceramica-blanco-ovalado-1.jpg" width="150" alt="063-jarron-ceramica-blanco-ovalado-1">

## 11. Percheros de latón · confianza media

Solo por el nombre.

**NAV-MES-001** · Percheros Laton Estante ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/100-percheros-laton-estante-1.jpg" width="150" alt="100-percheros-laton-estante-1">

**NAV-MES-003** · Percheros Laton Antiguos<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/097-percheros-laton-antiguos-1.jpg" width="150" alt="097-percheros-laton-antiguos-1">

## 12. Mesa de madera sobre bidones · confianza media

Solo por el nombre.

**NAV-MES-002** · Mesa Madera Base Bidones ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/099-mesa-madera-base-bidones-1.jpg" width="150" alt="099-mesa-madera-base-bidones-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/105-mesa-madera-bidones-turquesa-1.jpg" width="150" alt="105-mesa-madera-bidones-turquesa-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/115-mesa-madera-bidones-turquesa-1.jpg" width="150" alt="115-mesa-madera-bidones-turquesa-1">

**NAV-MES-009** · Mesa Madera Soporte Bidones<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/106-mesa-madera-soporte-bidones-1.jpg" width="150" alt="106-mesa-madera-soporte-bidones-1">

## 13. Sillas bistró de madera azul · confianza media

Solo por el nombre (una en singular y otra en plural: puede ser una silla y el juego).

**NAV-SIL-003** · Silla Bistro Madera Azul ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/138-silla-bistro-madera-azul-1.jpg" width="150" alt="138-silla-bistro-madera-azul-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/138-silla-bistro-madera-azul-2.jpg" width="150" alt="138-silla-bistro-madera-azul-2">

**NAV-SIL-012** · Sillas Bistro Madera Azul<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/151-sillas-bistro-madera-azul-1.jpg" width="150" alt="151-sillas-bistro-madera-azul-1">

## 14. Taburete metálico · confianza media

Solo por el nombre.

**NAV-SIL-008** · Taburete Metal Industrial ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/148-taburete-metal-industrial-1.jpg" width="150" alt="148-taburete-metal-industrial-1">

**NAV-SIL-015** · Taburete Metalico Alto<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/149-taburete-metalico-alto-1.jpg" width="150" alt="149-taburete-metalico-alto-1">

## 15. Baúl de viaje verde · confianza media

Solo por el nombre: "interior verde vacío" puede ser el mismo baúl abierto.

**NAV-BAU-014** · Baul Viaje Abierto Verde ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/001-baul-viaje-abierto-verde-1.jpg" width="150" alt="001-baul-viaje-abierto-verde-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/001-baul-viaje-abierto-verde-2.jpg" width="150" alt="001-baul-viaje-abierto-verde-2"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/001-baul-viaje-abierto-verde-3.jpg" width="150" alt="001-baul-viaje-abierto-verde-3">

**NAV-BAU-009** · Baul Interior Verde Vacio<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/012-baul-interior-verde-vacio-1.jpg" width="150" alt="012-baul-interior-verde-vacio-1">

## 16. Maletín de madera · confianza media

Solo por el nombre: abierto, abierto vacío y asa con cierre.

**NAV-BAU-019** · Maletin Madera Abierto Vacio ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/024-maletin-madera-abierto-vacio-1.jpg" width="150" alt="024-maletin-madera-abierto-vacio-1">

**NAV-BAU-020** · Maletin Madera Asa Cierre<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/025-maletin-madera-asa-cierre-1.jpg" width="150" alt="025-maletin-madera-asa-cierre-1">

**NAV-BAU-021** · Maletin Madera Abierto<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/026-maletin-madera-abierto-1.jpg" width="150" alt="026-maletin-madera-abierto-1">

## 17. Bidones turquesa · confianza media

Solo por el nombre. Diez fichas de bidones turquesa (pareja, lado, apilados, tapas, detalles...). Probablemente son dos o tres bidones fotografiados muchas veces: aquí hace falta mirar las fotos y decir cuántos hay.

**NAV-BID-004** · Bidones Turquesa Pareja ← se queda<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/031-bidones-turquesa-pareja-1.jpg" width="150" alt="031-bidones-turquesa-pareja-1">

**NAV-BID-002** · Bidon Turquesa Asa Detalle<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/028-bidon-turquesa-asa-detalle-1.jpg" width="150" alt="028-bidon-turquesa-asa-detalle-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/028-bidon-turquesa-asa-detalle-2.jpg" width="150" alt="028-bidon-turquesa-asa-detalle-2">

**NAV-BID-006** · Bidon Turquesa Cierre<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/027-bidon-turquesa-cierre-1.jpg" width="150" alt="027-bidon-turquesa-cierre-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/027-bidon-turquesa-cierre-2.jpg" width="150" alt="027-bidon-turquesa-cierre-2"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/027-bidon-turquesa-cierre-3.jpg" width="150" alt="027-bidon-turquesa-cierre-3">

**NAV-BID-007** · Bidones Turquesa Lado<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/029-bidones-turquesa-lado-1.jpg" width="150" alt="029-bidones-turquesa-lado-1"> <img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/029-bidones-turquesa-lado-2.jpg" width="150" alt="029-bidones-turquesa-lado-2">

**NAV-BID-012** · Bidon Metal Turquesa<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/030-bidon-metal-turquesa-1.jpg" width="150" alt="030-bidon-metal-turquesa-1">

**NAV-BID-016** · Bidon Turquesa Individual<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/045-bidon-turquesa-individual-1.jpg" width="150" alt="045-bidon-turquesa-individual-1">

**NAV-BID-018** · Bidones Turquesa Apilados Interior<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/049-bidones-turquesa-apilados-interior-1.jpg" width="150" alt="049-bidones-turquesa-apilados-interior-1">

**NAV-BID-024** · Bidones Turquesa Tapas Superior<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/041-bidones-turquesa-tapas-superior-1.jpg" width="150" alt="041-bidones-turquesa-tapas-superior-1">

**NAV-BID-001** · Tapa Metal Turquesa Detalle<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/032-tapa-metal-turquesa-detalle-1.jpg" width="150" alt="032-tapa-metal-turquesa-detalle-1">

**NAV-BID-026** · Tapa Metal Turquesa Borrosa<br><img src="https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles/052-tapa-metal-turquesa-borrosa-1.jpg" width="150" alt="052-tapa-metal-turquesa-borrosa-1">

## Consulta para ver el catálogo entero (solo lectura)

```sql
SELECT referencia, nombre, imagenes FROM public.muebles ORDER BY referencia;
```
