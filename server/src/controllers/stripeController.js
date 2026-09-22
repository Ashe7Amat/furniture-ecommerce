const stripeUtil = require('../utils/stripe');
const pagos = require('../utils/pagos');

// POST /api/stripe/webhook -- Stripe avisa aquí de lo que pasa con los pagos, sin depender
// de que el comprador vuelva a la web. Solo se atiende checkout.session.completed; el resto
// de eventos se acusan con 200 para que Stripe no los reintente.
//
// Códigos de respuesta (Stripe reintenta cualquier respuesta que no sea 2xx):
//   400 firma ausente o inválida   -> no es de Stripe, no tiene sentido reintentar
//   503 sin STRIPE_WEBHOOK_SECRET  -> fallo de configuración nuestro: se reintentará
//   500 error al procesar el pago  -> fallo transitorio (BD): se reintentará
//   200 todo lo demás
const recibirWebhook = async (req, res) => {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto) {
    console.error(
      'Webhook de Stripe: falta STRIPE_WEBHOOK_SECRET en las variables de entorno del servidor.'
    );
    return res.status(503).json({ error: 'El webhook de Stripe no está configurado.' });
  }

  const firma = req.headers['stripe-signature'];
  if (!firma) {
    return res.status(400).json({ error: 'Falta la firma de Stripe.' });
  }

  // La ruta usa express.raw(), así que el cuerpo debe ser un Buffer. Si ya llegara
  // parseado (algo lo habría consumido antes) la firma no se podría verificar.
  if (!Buffer.isBuffer(req.body)) {
    console.error(
      'Webhook de Stripe: el cuerpo no llegó como Buffer, no se puede verificar la firma.'
    );
    return res.status(400).json({ error: 'Cuerpo de la petición no válido.' });
  }

  let evento;
  try {
    evento = stripeUtil.construirEventoWebhook(req.body, firma, secreto);
  } catch (error) {
    console.warn('Webhook de Stripe: firma no válida:', error.message);
    return res.status(400).json({ error: 'Firma no válida.' });
  }

  if (evento.type !== 'checkout.session.completed') {
    return res.status(200).json({ recibido: true, ignorado: true });
  }

  const session = evento.data.object;
  if (session.payment_status !== 'paid') {
    // Solo se cobra con tarjeta, que llega ya pagada; un pago diferido no se da por bueno aún.
    console.warn(
      `Webhook de Stripe: la sesión ${session.id} se completó sin pago confirmado (${session.payment_status}).`
    );
    return res.status(200).json({ recibido: true, ignorado: true });
  }

  try {
    const resultado = await pagos.procesarSesionPagada(session);
    if (resultado.estado === 'ignorada') {
      console.warn(
        `Webhook de Stripe: la sesión ${session.id} no trae piezas en su metadata, se ignora.`
      );
    }
    return res.status(200).json({ recibido: true, estado: resultado.estado });
  } catch (error) {
    console.error(
      `Webhook de Stripe: error al procesar la sesión ${session.id}:`,
      error.message || error
    );
    return res.status(500).json({ error: 'Error al procesar el evento.' });
  }
};

module.exports = { recibirWebhook };
