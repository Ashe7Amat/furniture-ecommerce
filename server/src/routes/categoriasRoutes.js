const express = require('express');
const router = express.Router();
const { obtenerCategorias, crearCategoria, eliminarCategoria } = require('../controllers/categoriasController');

router.get('/', obtenerCategorias);
router.post('/', crearCategoria);
router.delete('/:id', eliminarCategoria);

module.exports = router;