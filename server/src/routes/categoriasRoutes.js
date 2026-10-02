const express = require('express');
const router = express.Router();
const {
  obtenerCategorias,
  crearCategoria,
  editarCategoria,
  eliminarCategoria
} = require('../controllers/categoriasController');
const { upload } = require('../utils/upload');
const { verificarAdmin } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { schemaCategoria } = require('../schemas/categorias');

// Lectura pública (el catálogo la necesita para pintar los filtros)
router.get('/', obtenerCategorias);

// Gestión: solo administradores autenticados. validar() va después de multer, que es quien rellena
// req.body desde el multipart/form-data (ver mueblesRoutes.js).
router.post('/', verificarAdmin, upload.single('imagen'), validar(schemaCategoria), crearCategoria);
router.put(
  '/:id',
  verificarAdmin,
  upload.single('imagen'),
  validar(schemaCategoria),
  editarCategoria
);
router.delete('/:id', verificarAdmin, eliminarCategoria);

module.exports = router;
