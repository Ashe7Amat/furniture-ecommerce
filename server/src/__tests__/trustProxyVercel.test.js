// En Vercel (variable VERCEL definida) la app confía en el proxy: la IP de cada visitante
// sale de X-Forwarded-For y los limitadores cuentan por visitante, no todos juntos.
// El valor de VERCEL se lee al cargar la app, por eso este caso y el de local
// (trustProxyLocal.test.js) están en archivos distintos: cada uno corre en su propio proceso.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.VERCEL = '1';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');
const email = require('../utils/email');

let registroErrores;

// El formulario de contacto limita a 5 peticiones por IP cada 15 minutos. Con el cuerpo
// vacío responde 400 de validación antes de tocar ningún servicio, pero cuenta igualmente.
const enviarVacio = (ip) => request(app).post('/api/contacto').set('X-Forwarded-For', ip).send({});

beforeEach(() => {
  mock.method(email, 'enviarMensajeContacto', async () => true);
  registroErrores = mock.method(console, 'error', () => {});
});

afterEach(() => mock.restoreAll());

describe('trust proxy en Vercel', () => {
  test('cada IP de X-Forwarded-For tiene su propio contador y express-rate-limit no avisa de mala configuración', async () => {
    const primera = await enviarVacio('203.0.113.10');
    assert.equal(primera.status, 400);

    // express-rate-limit valida la configuración una sola vez por limitador, en la primera
    // petición con X-Forwarded-For; por eso esta comprobación va aquí y no en un test aparte.
    const avisos = registroErrores.mock.calls.filter((c) =>
      c.arguments.some((a) => String(a?.code ?? a).includes('ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'))
    );
    assert.equal(
      avisos.length,
      0,
      'sin trust proxy, express-rate-limit avisa de que no ve la IP real'
    );

    for (let i = 1; i < 5; i++) {
      const res = await enviarVacio('203.0.113.10');
      assert.equal(res.status, 400, `la petición ${i + 1} de la IP A aún debe pasar el límite`);
    }

    const bloqueada = await enviarVacio('203.0.113.10');
    assert.equal(bloqueada.status, 429, 'la sexta petición de la misma IP se bloquea');

    const otraIp = await enviarVacio('203.0.113.20');
    assert.equal(otraIp.status, 400, 'otra IP distinta no debe verse afectada');
  });
});
