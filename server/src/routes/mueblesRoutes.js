const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  obtenerMuebles, obtenerMueblePorId, crearMueble, editarMueble, eliminarMueble,
  buscarMuebles, crearSesionPago, confirmarSesion
} = require('../controllers/mueblesController');
const { upload } = require('../utils/upload');
const { verificarAdmin } = require('../middleware/auth');

// Esta ruta es pública y cada llamada consulta a Stripe y a la base de datos. Un comprador
// la usa una vez (o unas pocas si recarga la página de éxito), así que 20 por IP cada 15
// minutos sobra para el uso real y frena a quien la martillee.
const limitadorConfirmacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas comprobaciones seguidas. Espera unos minutos y recarga esta página; si ya has pagado, no repitas el pago.' },
});

// Lectura del catálogo: pública, la ve cualquier visitante
router.get('/', obtenerMuebles);
router.get('/buscar', buscarMuebles);

// Checkout con Stripe: lo usa cualquier cliente comprando, no requiere ser admin
// IMPORTANTE: estas rutas deben ir antes de '/:id', si no Express interpreta
// "confirmar-sesion" o "crear-sesion-pago" como un id y nunca llegan a su controlador.
router.post('/crear-sesion-pago', crearSesionPago);
router.get('/confirmar-sesion', limitadorConfirmacion, confirmarSesion);

router.get('/:id', obtenerMueblePorId);

// Gestión del catálogo: solo administradores autenticados
router.post('/', verificarAdmin, upload.array('imagenes', 5), crearMueble);
router.put('/:id', verificarAdmin, upload.array('imagenes', 5), editarMueble);
router.delete('/:id', verificarAdmin, eliminarMueble);

module.exports = router;
