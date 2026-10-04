const express = require('express');
const router = express.Router();
const { obtenerCategoriasConEstadisticas } = require('../controllers/categoriasController');
const { obtenerMueblesAdmin } = require('../controllers/mueblesController');
const { exportarCatalogoCsv } = require('../controllers/catalogoCsvController');
const { verificarAdmin } = require('../middleware/auth');

// Lecturas que solo necesita el panel de administración (H26): lo que no debe salir en las rutas
// públicas. Todas piden sesión de administrador.
router.get('/categorias/con-stats', verificarAdmin, obtenerCategoriasConEstadisticas);
// A5: el inventario del panel, con la referencia de cada mueble.
router.get('/muebles', verificarAdmin, obtenerMueblesAdmin);
// El catálogo entero en CSV, para abrirlo en Excel (precios reales, como el inventario).
router.get('/muebles/export', verificarAdmin, exportarCatalogoCsv);

module.exports = router;
