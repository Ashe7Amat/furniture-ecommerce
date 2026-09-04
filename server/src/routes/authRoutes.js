const express = require('express');
const router = express.Router();
const { loginCliente, registrarCliente, actualizarPerfil, loginConGoogle } = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');

router.post('/login', loginCliente);
router.post('/register', registrarCliente); // <-- Añadimos la ruta de registro
router.post('/google', loginConGoogle);

// Requiere sesión: solo se puede editar la propia cuenta (el email sale del token, no del body)
router.post('/perfil-update', verificarToken, actualizarPerfil);

module.exports = router;
