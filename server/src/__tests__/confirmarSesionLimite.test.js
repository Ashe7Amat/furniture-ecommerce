// Límite de peticiones de GET /api/muebles/confirmar-sesion: 20 por IP cada 15 minutos.
// Va en su propio archivo porque el contador vive en memoria durante todo el proceso, y los
// demás tests de la ruta (confirmarSesion.test.js) no deben acabar consumiendo el límite.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.VERCEL = '1'; // para que cuente por la IP de X-Forwarded-For
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');
const stripeUtil = require('../utils/stripe');

const LIMITE = 20;
const consultar = (ip) => request(app).get('/api/muebles/confirmar-sesion').set('X-Forwarded-For', ip);

beforeEach(() => {
  // Con Stripe "configurado" y sin session_id la ruta responde 400 al instante, sin red.
  mock.method(stripeUtil, 'getStripe', () => ({ checkout: { sessions: { retrieve: async () => ({}) } } }));
});

afterEach(() => mock.restoreAll());

describe('límite de GET /api/muebles/confirmar-sesion', () => {
  test('permite 20 peticiones por IP y a la siguiente responde 429 con un mensaje claro', async () => {
    for (let i = 0; i < LIMITE; i++) {
      const res = await consultar('203.0.113.50');
      assert.equal(res.status, 400, `la petición ${i + 1} debe llegar al controlador`);
    }

    const bloqueada = await consultar('203.0.113.50');
    assert.equal(bloqueada.status, 429);
    assert.match(bloqueada.body.error, /Demasiadas comprobaciones/);
    assert.match(bloqueada.body.error, /no repitas el pago/, 'debe tranquilizar a quien ya ha pagado');
    assert.ok(bloqueada.headers['retry-after'], 'indica cuándo se puede reintentar');
  });

  test('el límite es por IP: otra IP sigue pudiendo consultar', async () => {
    const res = await consultar('203.0.113.60');
    assert.equal(res.status, 400);
  });
});
