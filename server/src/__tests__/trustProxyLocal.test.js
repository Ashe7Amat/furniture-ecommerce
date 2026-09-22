// Fuera de Vercel (VERCEL sin definir: desarrollo local, otro hosting) la app NO confía en
// X-Forwarded-For, porque cualquiera podría falsear su IP con esa cabecera y saltarse los
// limitadores. Ver trustProxyVercel.test.js para el caso contrario.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

delete process.env.VERCEL;
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');
const email = require('../utils/email');

const enviarVacio = (ip) => request(app).post('/api/contacto').set('X-Forwarded-For', ip).send({});

beforeEach(() => {
  mock.method(email, 'enviarMensajeContacto', async () => true);
  mock.method(console, 'error', () => {}); // express-rate-limit avisa por consola de esta configuración
});

afterEach(() => mock.restoreAll());

describe('sin trust proxy (fuera de Vercel)', () => {
  test('cambiar la cabecera X-Forwarded-For no sirve para esquivar el limitador', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await enviarVacio(`198.51.100.${i + 1}`);
      assert.equal(res.status, 400);
    }

    const conOtraIp = await enviarVacio('198.51.100.99');
    assert.equal(conOtraIp.status, 429, 'la IP declarada en la cabecera se ignora: cuenta la del socket');
  });
});
