const express = require('express');
const router = express.Router();
const { recibirWebhook } = require('../controllers/stripeController');

// La firma de Stripe se calcula sobre los bytes exactos del cuerpo, así que aquí se recibe
// crudo (Buffer). Este router se monta en index.js ANTES de express.json(): si el cuerpo
// se parseara primero, la verificación de la firma fallaría siempre.
router.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), recibirWebhook);

module.exports = router;
