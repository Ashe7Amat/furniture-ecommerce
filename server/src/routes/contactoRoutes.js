const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { enviarContacto } = require('../controllers/contactoController');

// Límite anti-spam: máximo 5 mensajes por IP cada 15 minutos.
const limitadorContacto = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has enviado demasiados mensajes. Espera unos minutos antes de volver a intentarlo.' },
});

router.post('/', limitadorContacto, enviarContacto);

module.exports = router;
