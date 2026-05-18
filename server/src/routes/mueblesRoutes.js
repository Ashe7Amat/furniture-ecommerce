const express = require('express');
const router = express.Router();
const { obtenerMuebles, obtenerMueblePorId, crearMueble, editarMueble, eliminarMueble, buscarMuebles } = require('../controllers/mueblesController');
const { upload } = require('../utils/upload');

router.get('/', obtenerMuebles);
router.get('/buscar', buscarMuebles);
router.get('/:id', obtenerMueblePorId);
router.post('/', upload.array('imagenes', 5), crearMueble);
router.put('/:id', upload.array('imagenes', 5), editarMueble);
router.delete('/:id', eliminarMueble);

module.exports = router;