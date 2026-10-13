const { z } = require('zod');
const { requerido } = require('./comunes');

// POST /api/reservas/sesion-pago (docs/reservas-diseno.md, 6.3). Solo la FORMA: las fechas, las horas
// y el modo de entrega y recogida los valida calcularPrecioReserva (utils/precioReserva.js), con los
// mismos mensajes que el presupuesto, así que aquí pasan tal cual. El email no se pide: es el de la
// cuenta, y el cliente_id sale del token, nunca del cuerpo.
//
// Los límites de longitud son los mismos que los de la compra (utils/metadataStripe.js), porque estos
// datos acaban también en el pedido y en los emails.
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENSAJE_PIEZA = 'Falta la pieza que quieres reservar.';

const textoOpcional = (max, mensajeLargo) =>
  z
    .string({ error: () => 'Revisa tus datos de contacto.' })
    .trim()
    .max(max, `${mensajeLargo} (máximo ${max} caracteres).`)
    .optional();

const schemaSesionPagoReserva = z
  .object({
    mueble_id: z.string({ error: () => MENSAJE_PIEZA }).regex(FORMATO_UUID, MENSAJE_PIEZA),
    fecha_inicio: z.unknown().optional(),
    hora_entrega: z.unknown().optional(),
    fecha_fin: z.unknown().optional(),
    hora_recogida: z.unknown().optional(),
    entrega: z.unknown().optional(),
    recogida: z.unknown().optional(),
    contacto: z.object(
      {
        nombre: requerido('Escribe tu nombre.').max(
          100,
          'El nombre es demasiado largo (máximo 100 caracteres).'
        ),
        telefono: requerido('Escribe un teléfono de contacto.').max(
          30,
          'El teléfono es demasiado largo (máximo 30 caracteres).'
        ),
        direccion: textoOpcional(500, 'La dirección es demasiado larga'),
        notas: textoOpcional(500, 'Las notas son demasiado largas')
      },
      { error: () => 'Faltan tus datos de contacto.' }
    ),
    acepta_condiciones: z.literal(true, {
      error: () => 'Tienes que aceptar las condiciones del alquiler.'
    })
  })
  .refine(
    (datos) =>
      (datos.entrega !== 'domicilio' && datos.recogida !== 'domicilio') ||
      Boolean(datos.contacto.direccion),
    {
      message: 'Escribe la dirección para la entrega o la recogida a domicilio.',
      path: ['contacto', 'direccion']
    }
  );

module.exports = { schemaSesionPagoReserva };
