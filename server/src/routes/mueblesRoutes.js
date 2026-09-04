const express = require('express');
const router = express.Router();
const {
  obtenerMuebles, obtenerMueblePorId, crearMueble, editarMueble, eliminarMueble,
  buscarMuebles, crearSesionPago, confirmarSesion
} = require('../controllers/mueblesController');
const { upload } = require('../utils/upload');
const { verificarAdmin } = require('../middleware/auth');

// Lectura del catálogo: pública, la ve cualquier visitante
router.get('/', obtenerMuebles);
router.get('/buscar', buscarMuebles);

// Checkout con Stripe: lo usa cualquier cliente comprando, no requiere ser admin
// IMPORTANTE: estas rutas deben ir antes de '/:id', si no Express interpreta
// "confirmar-sesion" o "crear-sesion-pago" como un id y nunca llegan a su controlador.
router.post('/crear-sesion-pago', crearSesionPago);
router.get('/confirmar-sesion', confirmarSesion);

router.get('/:id', obtenerMueblePorId);

// Gestión del catálogo: solo administradores autenticados
router.post('/', verificarAdmin, upload.array('imagenes', 5), crearMueble);
router.put('/:id', verificarAdmin, upload.array('imagenes', 5), editarMueble);
router.delete('/:id', verificarAdmin, eliminarMueble);

module.exports = router;
