const express = require('express');
const router = express.Router();
const { obtenerAjustesHome } = require('../controllers/ajustesController');

// GET /api/ajustes/home (público)
router.get('/home', obtenerAjustesHome);

module.exports = router;
