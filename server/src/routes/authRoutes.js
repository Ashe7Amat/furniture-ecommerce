const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  loginCliente,
  registrarCliente,
  actualizarPerfil,
  loginConGoogle,
  refrescarSesion,
  cerrarSesion
} = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const {
  schemaRegistro,
  schemaLogin,
  schemaGoogle,
  schemaPerfilUpdate,
  schemaRefresh
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

// Límite de intentos de perfil-update (H28): 10 fallidos cada 15 minutos POR CUENTA, no por IP.
// Sin él, alguien con una sesión robada podía probar contraseñas actuales sin fin hasta dar con la
// buena, y entonces cambiar el email y la contraseña y dejar fuera a su dueño. Solo cuentan los
// intentos que fallan (una contraseña incorrecta, un cuerpo no válido...); cambiar el nombre, que
// no pide contraseña, no gasta nada. Al llegar al límite, también se rechaza la contraseña buena
// hasta que pase la ventana. La clave es el id de la cuenta (`sub` del token) o, en los tokens
// firmados antes de que lo llevaran, su email. Como los demás límites, vive en la memoria de cada
// instancia de Vercel (H4).
const limitadorPerfil = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    `cuenta:${req.usuario.sub || String(req.usuario.email || '').toLowerCase()}`,
  handler: (req, res, next, opciones) => {
    console.warn(`perfil-update: límite de intentos alcanzado (${opciones.keyGenerator(req)}).`);
    res.status(opciones.statusCode).json(opciones.message);
  },
  message: {
    error:
      'Demasiados intentos con una contraseña incorrecta. Espera 15 minutos antes de volver a intentarlo.'
  }
});

router.post('/login', limitadorAuth, validar(schemaLogin), loginCliente);
router.post('/register', limitadorAuth, validar(schemaRegistro), registrarCliente);
router.post('/google', limitadorAuth, validar(schemaGoogle), loginConGoogle);

// Requiere sesión: solo se puede editar la propia cuenta (el email sale del token, no del body).
// El límite va después de verificarToken, que es quien dice de qué cuenta es la petición.
router.post(
  '/perfil-update',
  verificarToken,
  limitadorPerfil,
  validar(schemaPerfilUpdate),
  actualizarPerfil
);

// Renovar y cerrar la sesión con el refresh token (docs/tarea3-diseno.md, sección 2). No piden
// access token: el propio refresh token es la prueba, y el access token puede haber caducado ya.
router.post('/refresh', validar(schemaRefresh), refrescarSesion);
router.post('/logout', validar(schemaRefresh), cerrarSesion);

module.exports = router;
