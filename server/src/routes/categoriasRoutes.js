const express = require('express');
const router = express.Router();
const { obtenerCategorias, crearCategoria, editarCategoria, eliminarCategoria } = require('../controllers/categoriasController');
const { upload } = require('../utils/upload');
const { verificarAdmin } = require('../middleware/auth');

// Lectura pública (el catálogo la necesita para pintar los filtros)
router.get('/', obtenerCategorias);

// Gestión: solo administradores autenticados
router.post('/', verificarAdmin, upload.single('imagen'), crearCategoria);
router.put('/:id', verificarAdmin, upload.single('imagen'), editarCategoria);
router.delete('/:id', verificarAdmin, eliminarCategoria);

module.exports = router;
