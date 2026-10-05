const { z } = require('zod');

const ESTADOS_VALIDOS = ['procesando', 'enviado', 'entregado', 'cancelado'];

// PATCH /api/pedidos/:id/estado -- mismo mensaje que antes del cambio a Zod.
const schemaEstadoPedido = z.object({
  estado: z.enum(ESTADOS_VALIDOS, {
    message: `Estado no válido. Usa uno de: ${ESTADOS_VALIDOS.join(', ')}.`
  })
});

// GET /api/pedidos?page=1&limit=20&estado=procesando (H37): el panel pide los pedidos por páginas
// en vez de toda la historia de golpe. Sin parámetros, la primera página de 20. El estado vacío
// ("Todos los estados" en el panel) cuenta como sin filtro.
const POR_PAGINA_PEDIDOS = 20;
const MAX_POR_PAGINA_PEDIDOS = 100;
const MENSAJE_PAGINA = 'La página tiene que ser un número entero mayor que 0.';
const MENSAJE_LIMITE = `El límite tiene que ser un número entero entre 1 y ${MAX_POR_PAGINA_PEDIDOS}.`;
const schemaListadoPedidos = z.object({
  page: z.coerce
    .number({ error: MENSAJE_PAGINA })
    .int(MENSAJE_PAGINA)
    .min(1, MENSAJE_PAGINA)
    .default(1),
  limit: z.coerce
    .number({ error: MENSAJE_LIMITE })
    .int(MENSAJE_LIMITE)
    .min(1, MENSAJE_LIMITE)
    .max(MAX_POR_PAGINA_PEDIDOS, MENSAJE_LIMITE)
    .default(POR_PAGINA_PEDIDOS),
  estado: z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    z
      .enum(ESTADOS_VALIDOS, {
        message: `Estado no válido. Usa uno de: ${ESTADOS_VALIDOS.join(', ')}.`
      })
      .optional()
  )
});

module.exports = {
  schemaEstadoPedido,
  schemaListadoPedidos,
  ESTADOS_VALIDOS,
  POR_PAGINA_PEDIDOS,
  MAX_POR_PAGINA_PEDIDOS
};
