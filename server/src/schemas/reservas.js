const { z } = require('zod');
const { requerido } = require('./comunes');

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const fechaString = (campo) =>
  requerido(`El campo ${campo} es obligatorio.`).regex(
    REGEX_FECHA,
    `El campo ${campo} debe tener el formato YYYY-MM-DD.`
  );

const schemaDisponibilidadQuery = z.object({
  desde: z
    .string()
    .trim()
    .regex(REGEX_FECHA, 'El parámetro "desde" debe tener el formato YYYY-MM-DD.')
    .optional(),
  hasta: z
    .string()
    .trim()
    .regex(REGEX_FECHA, 'El parámetro "hasta" debe tener el formato YYYY-MM-DD.')
    .optional()
});

const schemaPresupuestoQuery = z.object({
  fecha_inicio: fechaString('fecha_inicio'),
  fecha_fin: fechaString('fecha_fin'),
  entrega: z.enum(['domicilio', 'tienda']).optional(),
  recogida: z.enum(['domicilio', 'tienda']).optional()
});

module.exports = {
  schemaDisponibilidadQuery,
  schemaPresupuestoQuery,
  REGEX_FECHA
};
