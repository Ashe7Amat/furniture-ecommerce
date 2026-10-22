const { z } = require('zod');

const url = z.string().trim().min(1, 'La URL de la imagen no puede estar vacía.');

const schemaActualizarAjustesHome = z.object({
  hero_imagenes: z.array(url).optional(),
  productos_destacados: z
    .array(z.string().trim().min(1, 'El ID de producto no puede estar vacío.'))
    .optional(),
  // "Espacios que inspiran": 2 o 3 fotos; vacío = las fotos de siempre.
  imagenes_seccion_inspiracion: z
    .array(url)
    .max(3, 'La sección de inspiración admite como máximo 3 fotos.')
    .optional(),
  // Sección final: una sola URL, o null para volver a la foto de siempre.
  imagen_seccion_sostenibilidad: url.nullable().optional()
});

module.exports = { schemaActualizarAjustesHome };
