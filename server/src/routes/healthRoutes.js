const express = require('express');
const router = express.Router();
const { obtenerEstadoSalud } = require('../controllers/healthController');

// GET /api/health -- Endpoint público de salud (sin auth)
router.get('/', obtenerEstadoSalud);

module.exports = router;
