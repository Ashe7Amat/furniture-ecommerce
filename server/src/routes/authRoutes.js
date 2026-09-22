const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  loginCliente,
  registrarCliente,
  actualizarPerfil,
  loginConGoogle
} = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const {
  schemaRegistro,
  schemaLogin,
  schemaGoogle,
  schemaPerfilUpdate
} = require('../schemas/auth');

// Límite anti fuerza-bruta: máximo 15 intentos de login/registro por IP cada 15 minutos.
// Solo cuenta los intentos fallidos, para no bloquear a alguien que ya inició sesión bien.
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' }
});

router.post('/login', limitadorAuth, validar(schemaLogin), loginCliente);
router.post('/register', limitadorAuth, validar(schemaRegistro), registrarCliente);
router.post('/google', limitadorAuth, validar(schemaGoogle), loginConGoogle);

// Requiere sesión: solo se puede editar la propia cuenta (el email sale del token, no del body)
router.post('/perfil-update', verificarToken, validar(schemaPerfilUpdate), actualizarPerfil);

module.exports = router;
