const { z } = require('zod');

const ESTADOS_VALIDOS = ['procesando', 'enviado', 'entregado', 'cancelado'];

// PATCH /api/pedidos/:id/estado -- mismo mensaje que antes del cambio a Zod.
const schemaEstadoPedido = z.object({
  estado: z.enum(ESTADOS_VALIDOS, {
    message: `Estado no válido. Usa uno de: ${ESTADOS_VALIDOS.join(', ')}.`
  })
});

module.exports = { schemaEstadoPedido, ESTADOS_VALIDOS };
