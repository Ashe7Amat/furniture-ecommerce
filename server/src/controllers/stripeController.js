const stripeUtil = require('../utils/stripe');
const pagos = require('../utils/pagos');
const reservas = require('../utils/reservas');

// POST /api/stripe/webhook -- Stripe avisa aquí de lo que pasa con los pagos, sin depender
// de que el comprador vuelva a la web. Se atienden checkout.session.completed (compras y reservas
// por fechas) y checkout.session.expired (solo reservas: libera sus fechas); el resto de eventos
// se acusan con 200 para que Stripe no los reintente.
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

  const objeto = evento.data.object;
  const esReserva = objeto?.metadata?.tipo === 'reserva';

  switch (evento.type) {
    case 'checkout.session.completed': {
      const session = objeto;
      if (session.payment_status !== 'paid') {
        console.warn(
          `Webhook de Stripe: la sesión ${session.id} se completó sin pago confirmado (${session.payment_status}).`
        );
        return res.status(200).json({ recibido: true, ignorado: true });
      }

      try {
        const resultado = esReserva
          ? await reservas.procesarReservaPagada(session)
          : await pagos.procesarSesionPagada(session);
        if (resultado.estado === 'ignorada') {
          console.warn(
            `Webhook de Stripe: la sesión ${session.id} no trae ni piezas ni una reserva que exista, se ignora.`
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
    }

    case 'checkout.session.expired': {
      if (!esReserva) {
        return res.status(200).json({ recibido: true, ignorado: true });
      }
      try {
        const { estado } = await reservas.liberarReservaDeSesionCaducada(objeto);
        return res.status(200).json({ recibido: true, estado });
      } catch (error) {
        console.error(
          `Webhook de Stripe: error al liberar la reserva de la sesión caducada ${objeto.id}:`,
          error.message || error
        );
        return res.status(500).json({ error: 'Error al procesar el evento.' });
      }
    }

    case 'payment_intent.succeeded': {
      // Evento complementario emitido al completarse el pago en Stripe Checkout.
      // El pedido y reserva principales se procesan con la metadata de checkout.session.completed.
      console.log(`Webhook de Stripe: payment_intent.succeeded recibido (${objeto.id}).`);
      return res.status(200).json({ recibido: true, evento: 'payment_intent.succeeded' });
    }

    case 'payment_intent.payment_failed': {
      const errorMsg = objeto.last_payment_error?.message || 'motivo no especificado';
      console.warn(`Webhook de Stripe: pago fallido en PaymentIntent ${objeto.id}: ${errorMsg}`);
      return res
        .status(200)
        .json({ recibido: true, evento: 'payment_intent.payment_failed', detalle: errorMsg });
    }

    case 'charge.refunded': {
      const importeReembolsado = ((objeto.amount_refunded || 0) / 100).toFixed(2);
      console.info(
        `Webhook de Stripe: reembolso registrado para el cargo ${objeto.id} (${importeReembolsado} €).`
      );
      return res
        .status(200)
        .json({ recibido: true, evento: 'charge.refunded', reembolsado: importeReembolsado });
    }

    default:
      return res.status(200).json({ recibido: true, ignorado: true });
  }
};

module.exports = { recibirWebhook };
