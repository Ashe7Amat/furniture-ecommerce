-- Imágenes de las demás secciones de la portada (además del hero):
--   imagenes_seccion_inspiracion: 2 o 3 URLs para "Espacios que inspiran".
--   imagen_seccion_sostenibilidad: 1 URL para la sección final (NULL = foto de siempre).
ALTER TABLE public.ajustes_home
  ADD COLUMN IF NOT EXISTS imagenes_seccion_inspiracion jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS imagen_seccion_sostenibilidad text;
