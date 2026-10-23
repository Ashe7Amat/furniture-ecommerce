const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  crearSesionPagoReserva,
  retomarPagoReserva,
  obtenerMisReservas,
  solicitarCancelacionReserva,
  MENSAJE_ALQUILER_CERRADO
} = require('../controllers/reservasController');
const { reservasActivas } = require('../utils/reservas');
const { verificarToken } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { schemaSesionPagoReserva, schemaSolicitarCancelacion } = require('../schemas/reservas');

// Reservas por fechas que escriben (docs/reservas-diseno.md, bloque R-b). La disponibilidad y el
// presupuesto, que solo leen, están en mueblesRoutes.js.

// Interruptor RESERVAS_ACTIVAS (9.1): apagado, estas rutas no hacen nada, ni siquiera mirar la sesión.
const exigirReservasActivas = (req, res, next) =>
  reservasActivas() ? next() : res.status(403).json({ error: MENSAJE_ALQUILER_CERRADO });

// Cada llamada puede crear una sesión de Checkout en Stripe y ocupa fechas unos 45 minutos. Con
// una sola reserva provisional por cliente y 10 intentos por IP cada 15 minutos (6.3, "Abuso"), nadie
// puede bloquear el calendario de muchas piezas a la vez. Va antes de mirar la sesión, así que
// también cuenta las llamadas sin ella. Como los demás límites, vive en la memoria de cada instancia
// de Vercel (H4).
const limitadorReservaPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      'Demasiados intentos de reserva seguidos. Espera unos minutos antes de volver a intentarlo.'
  }
});

router.post(
  '/sesion-pago',
  exigirReservasActivas,
  limitadorReservaPorIp,
  verificarToken,
  validar(schemaSesionPagoReserva),
  crearSesionPagoReserva
);

// Seguir con el pago de una reserva a medio pagar: no crea nada, pide a Stripe la sesión que ya existe. Pocas
// por IP, como los demás límites de las reservas.
const limitadorRetomarPago = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.'
  }
});

router.post(
  '/:id/retomar-pago',
  exigirReservasActivas,
  limitadorRetomarPago,
  verificarToken,
  retomarPagoReserva
);

// "Mis reservas" en la cuenta del cliente (bloque R-c, commit 13).
router.get('/mias', exigirReservasActivas, verificarToken, obtenerMisReservas);

// La solicitud de cancelación solo envía un email al administrador (8.4: en la primera versión cancela
// siempre él), pero cada una es un correo: pocas por IP.
const limitadorSolicitudes = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes seguidas. Espera unos minutos antes de volver a intentarlo.'
  }
});

router.post(
  '/:id/solicitar-cancelacion',
  exigirReservasActivas,
  limitadorSolicitudes,
  verificarToken,
  validar(schemaSolicitarCancelacion),
  solicitarCancelacionReserva
);

module.exports = router;
