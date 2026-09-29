const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  obtenerMuebles,
  obtenerMueblePorId,
  crearMueble,
  editarMueble,
  eliminarMueble,
  buscarMuebles,
  crearSesionPago,
  confirmarSesion
} = require('../controllers/mueblesController');
const { upload } = require('../utils/upload');
const { verificarAdmin } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { schemaMuebleCrear, schemaMuebleEditar, schemaCarritoPago } = require('../schemas/muebles');

// Esta ruta es pública y cada llamada consulta a Stripe y a la base de datos. Un comprador
// la usa una vez (o unas pocas si recarga la página de éxito), así que 20 por IP cada 15
// minutos sobra para el uso real y frena a quien la martillee.
const limitadorConfirmacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      'Demasiadas comprobaciones seguidas. Espera unos minutos y recarga esta página; si ya has pagado, no repitas el pago.'
  }
});

// H29: crear-sesion-pago es pública (se compra también como invitado) y cada llamada crea una sesión
// de Checkout en Stripe. Sin límite, alguien podía abrir miles de sesiones, llenar el Dashboard de
// Stripe y gastar el cupo de peticiones de su API, que es el mismo que usan los pagos de verdad. Dos
// límites, y cuentan todas las llamadas (también las que van bien, porque esas son las que crean
// sesiones):
// - por IP: 20 cada 15 minutos. Va antes de validar, así que también cuenta el spam mal formado;
// - por email del comprador, si viene: 10 cada 15 minutos. Va después de validar, y el email se
//   normaliza (sin espacios, en minúsculas) para que cambiar mayúsculas no dé un contador nuevo.
// Un comprador de verdad paga una vez (o pocas, si vuelve atrás desde Stripe). Como los demás
// límites, viven en la memoria de cada instancia de Vercel (H4).
const MENSAJE_LIMITE_PAGO = {
  error: 'Demasiados intentos de pago seguidos. Espera unos minutos antes de volver a intentarlo.'
};
const limitadorPagoPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: MENSAJE_LIMITE_PAGO
});
const emailDelComprador = (req) => {
  const email = req.body?.clienteInfo?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
};
const limitadorPagoPorEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !emailDelComprador(req),
  keyGenerator: (req) => `email:${emailDelComprador(req)}`,
  message: MENSAJE_LIMITE_PAGO
});

// Lectura del catálogo: pública, la ve cualquier visitante
router.get('/', obtenerMuebles);
router.get('/buscar', buscarMuebles);

// Checkout con Stripe: lo usa cualquier cliente comprando, no requiere ser admin
// IMPORTANTE: estas rutas deben ir antes de '/:id', si no Express interpreta
// "confirmar-sesion" o "crear-sesion-pago" como un id y nunca llegan a su controlador.
router.post(
  '/crear-sesion-pago',
  limitadorPagoPorIp,
  validar(schemaCarritoPago),
  limitadorPagoPorEmail,
  crearSesionPago
);
router.get('/confirmar-sesion', limitadorConfirmacion, confirmarSesion);

router.get('/:id', obtenerMueblePorId);

// Gestión del catálogo: solo administradores autenticados
// validar() va DESPUÉS de upload.array(): multer es quien rellena req.body a partir del
// multipart/form-data (las fotos van aparte, en req.files); antes de multer, req.body no
// existiría todavía.
router.post(
  '/',
  verificarAdmin,
  upload.array('imagenes', 5),
  validar(schemaMuebleCrear),
  crearMueble
);
router.put(
  '/:id',
  verificarAdmin,
  upload.array('imagenes', 5),
  validar(schemaMuebleEditar),
  editarMueble
);
router.delete('/:id', verificarAdmin, eliminarMueble);

module.exports = router;
