const express = require('express');
const router = express.Router();
const { tareaDiariaReservas } = require('../controllers/cronController');

// Tareas programadas de Vercel Cron (server/vercel.json). Cada una comprueba CRON_SECRET.
router.get('/reservas', tareaDiariaReservas);

module.exports = router;
