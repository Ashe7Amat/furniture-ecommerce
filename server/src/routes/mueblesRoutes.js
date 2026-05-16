const express = require('express');
const router = express.Router();
const { obtenerMuebles, obtenerMueblePorId, crearMueble, eliminarMueble, buscarMuebles } = require('../controllers/mueblesController');

router.get('/', obtenerMuebles);
router.get('/:id', obtenerMueblePorId);
router.post('/', crearMueble);
router.delete('/:id', eliminarMueble); // <-- Conectamos el método HTTP DELETE

module.exports = router;