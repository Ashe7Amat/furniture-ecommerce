const express = require('express');
const router = express.Router();
const { obtenerCategorias, crearCategoria, editarCategoria, eliminarCategoria } = require('../controllers/categoriasController');
const { upload } = require('../utils/upload');

router.get('/', obtenerCategorias);
router.post('/', upload.single('imagen'), crearCategoria);
router.put('/:id', upload.single('imagen'), editarCategoria);
router.delete('/:id', eliminarCategoria);

module.exports = router;