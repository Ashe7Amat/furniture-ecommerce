// Errores de quien llama al leer el cuerpo de la petición (cuerpo demasiado grande, JSON mal
// formado): deben responder 413/400 con un JSON limpio y NO volcar el stack al log, porque
// cualquiera puede provocarlos sin autenticarse y así inundaría los logs de Vercel.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');

let registroErrores;

beforeEach(() => {
  registroErrores = mock.method(console, 'error', () => {});
});

afterEach(() => mock.restoreAll());

const erroresNoControlados = () =>
  registroErrores.mock.calls.filter((c) => String(c.arguments[0]).includes('Error no controlado'));

describe('errores al leer el cuerpo de la petición', () => {
  test('un webhook de más de 1 MB responde 413 sin volcar el stack al log', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=abc')
      .send('{"relleno":"' + 'x'.repeat(1024 * 1024 + 10) + '"}');

    assert.equal(res.status, 413);
    assert.match(res.body.error, /demasiado grande/i);
    assert.equal(erroresNoControlados().length, 0);
  });

  test('un JSON mal formado en una ruta normal responde 400, no 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "ana@example.com", "password": ');

    assert.equal(res.status, 400);
    assert.match(res.body.error, /JSON/);
    assert.equal(erroresNoControlados().length, 0);
  });
});
