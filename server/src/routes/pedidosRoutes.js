const express = require('express');
const router = express.Router();
const { obtenerPedidos, actualizarEstadoPedido } = require('../controllers/pedidosController');
const { verificarAdmin } = require('../middleware/auth');

// Los pedidos contienen datos personales del comprador (nombre, email, teléfono,
// dirección): solo administradores autenticados pueden verlos o gestionarlos.
router.get('/', verificarAdmin, obtenerPedidos);
router.patch('/:id/estado', verificarAdmin, actualizarEstadoPedido);

module.exports = router;
