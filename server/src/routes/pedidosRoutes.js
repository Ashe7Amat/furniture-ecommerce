const express = require('express');
const router = express.Router();
const { obtenerMisPedidos, obtenerPedidos, actualizarEstadoPedido } = require('../controllers/pedidosController');
const { verificarToken, verificarAdmin } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { schemaEstadoPedido } = require('../schemas/pedidos');

// IMPORTANTE: "/mios" va antes que cualquier ruta con parámetro (p. ej. "/:id/algo")
// para que Express no la confunda con un id de pedido.
router.get('/mios', verificarToken, obtenerMisPedidos);

// Los pedidos contienen datos personales del comprador (nombre, email, teléfono,
// dirección): solo administradores autenticados pueden ver o gestionar el listado completo.
router.get('/', verificarAdmin, obtenerPedidos);
router.patch('/:id/estado', verificarAdmin, validar(schemaEstadoPedido), actualizarEstadoPedido);

module.exports = router;
