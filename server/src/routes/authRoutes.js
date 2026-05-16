const express = require('express');
const router = express.Router();
const { loginCliente, registrarCliente, actualizarPerfil } = require('../controllers/authController');

router.post('/login', loginCliente);
router.post('/register', registrarCliente); // <-- Añadimos la ruta de registro
router.post('/perfil-update', actualizarPerfil);

module.exports = router;