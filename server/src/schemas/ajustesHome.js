const { z } = require('zod');

const schemaActualizarAjustesHome = z.object({
  hero_imagenes: z
    .array(z.string().trim().min(1, 'La URL de la imagen no puede estar vacía.'))
    .optional(),
  productos_destacados: z
    .array(z.string().trim().min(1, 'El ID de producto no puede estar vacío.'))
    .optional()
});

module.exports = { schemaActualizarAjustesHome };
