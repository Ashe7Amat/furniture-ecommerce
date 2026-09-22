const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { enviarContacto } = require('../controllers/contactoController');
const { validar } = require('../middleware/validar');
const { schemaContacto } = require('../schemas/contacto');

// Límite anti-spam: máximo 5 mensajes por IP cada 15 minutos.
const limitadorContacto = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Has enviado demasiados mensajes. Espera unos minutos antes de volver a intentarlo.'
  }
});

// "web" es un honeypot: un campo oculto para humanos (vía CSS) pero visible para bots simples
// que rellenan todos los inputs de un formulario. Se comprueba ANTES que la validación de Zod y
// antes que cualquier otra cosa: si llega con contenido, respondemos 200 sin enviar nada y sin
// mirar el resto del payload, para no darle a un bot ninguna pista de que se le ha detectado (un
// 400 de "falta el nombre", por ejemplo, sí sería una pista distinguible).
const comprobarHoneypot = (req, res, next) => {
  if (req.body?.web) {
    return res.status(200).json({ success: true });
  }
  next();
};

router.post('/', limitadorContacto, comprobarHoneypot, validar(schemaContacto), enviarContacto);

module.exports = router;
