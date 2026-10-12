# Propuesta: "antes y después" de la restauración (12 oct 2026)

Pedido por el usuario en el hilo de mejoras visuales. En la ficha de una pieza, un deslizador que compara la
foto de cómo llegó con la foto principal de ahora. Solo sale si la pieza tiene foto de antes.

## Migración (pendiente de autorización explícita)

`server/migrations/20261012170000_add_imagen_antes_muebles.sql`. La versión es una previsión: se renombra con
la real después de aplicarla, como dice `server/migrations/README.md`.

```sql
ALTER TABLE public.muebles ADD COLUMN imagen_antes text;
```

- Columna nueva, que admite null, sin valor por defecto: en Postgres es un cambio de metadatos, sin
  reescribir la tabla. No toca RLS: la tabla ya tiene sus políticas, y la columna las sigue.
- Reversión en el `.down.sql`, con su advertencia.
- **Orden:** la migración va ANTES del merge. El código nuevo pide `imagen_antes` en todas las lecturas
  públicas; sin la columna, PostgREST responde error y el catálogo no carga.

Comprobaciones:

- Antes: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name =
  'muebles' AND column_name = 'imagen_antes';` → ninguna fila.
- Después: la misma consulta → una fila (`text`, `is_nullable = YES`), y `SELECT count(*) FROM muebles WHERE
  imagen_antes IS NOT NULL;` → 0.

## Código

- Servidor: `imagen_antes` en `COLUMNAS_PUBLICAS_MUEBLE` (y con ello en las del panel). El `PUT
  /api/muebles/:id` acepta un segundo campo de archivo, `imagen_antes` (como mucho uno, sin miniatura), y
  `quitar_imagen_antes=true` para quitarla. Crear un mueble no cambia: la foto de antes se pone al editar.
- Panel: en "Editar Producto", un hueco "Foto de antes de restaurar (opcional)", con la foto actual y un botón
  para quitarla.
- Ficha: el componente `AntesDespues`, debajo de la galería.

Fuera de esta propuesta: la exportación e importación del catálogo en CSV no llevan la foto de antes.
