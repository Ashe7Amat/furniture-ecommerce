const express = require('express');
const router = express.Router();
const { obtenerCategoriasConEstadisticas } = require('../controllers/categoriasController');
const { verificarAdmin } = require('../middleware/auth');

// Lecturas que solo necesita el panel de administración (H26): lo que no debe salir en las rutas
// públicas. Todas piden sesión de administrador.
router.get('/categorias/con-stats', verificarAdmin, obtenerCategoriasConEstadisticas);

module.exports = router;
