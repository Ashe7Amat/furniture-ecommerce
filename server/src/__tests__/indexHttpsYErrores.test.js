// Tests de index.js: la redirección a HTTPS en producción y el manejador de errores para lo que no
// captura ningún controlador (un error de multer, por ejemplo).
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
const app = require('../index');

const entornoOriginal = process.env.NODE_ENV;
afterEach(() => {
  if (entornoOriginal === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = entornoOriginal;
});

describe('redirección a HTTPS', () => {
  test('en producción, una petición que llegó por HTTP (x-forwarded-proto) se redirige con 301 a HTTPS', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(app)
      .get('/api/muebles?limit=4')
      .set('Host', 'api.nave5.test')
      .set('X-Forwarded-Proto', 'http');

    assert.equal(res.status, 301);
    assert.equal(res.headers.location, 'https://api.nave5.test/api/muebles?limit=4');
  });

  test('en producción, una que ya llegó por HTTPS no se toca', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(app).get('/').set('X-Forwarded-Proto', 'https');

    assert.equal(res.status, 200);
  });

  test('fuera de producción no redirige aunque llegue por HTTP (en local no hay HTTPS)', async () => {
    process.env.NODE_ENV = 'development';

    const res = await request(app).get('/').set('X-Forwarded-Proto', 'http');

    assert.equal(res.status, 200);
  });
});

describe('manejador de errores no capturados', () => {
  test('un error de multer (foto de más de 5 MB) sale como 500 genérico, sin detalles internos (ver H3 y H24)', async (t) => {
    t.mock.method(console, 'error', () => {});
    const tokenAdmin = jwt.sign(
      { email: 'admin@nave5.test', rol: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/muebles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .attach('imagenes', Buffer.alloc(5 * 1024 * 1024 + 1), 'enorme.jpg');

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno del servidor.' });
    assert.doesNotMatch(JSON.stringify(res.body), /File too large|LIMIT_FILE_SIZE/);
    assert.equal(console.error.mock.callCount(), 1, 'el detalle queda solo en el log');
  });
});
