// CSP mínima del servidor (task 2, punto 1): esta API solo devuelve JSON, así que
// "default-src 'none'" es la política más restrictiva posible y no debería llevar ninguna otra
// directiva colgando de los valores por defecto de helmet. HSTS no se toca explícitamente porque
// ya lo activa helmet() por defecto (comprobado aquí, no solo asumido).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const app = require('../index');

describe('cabeceras de seguridad del servidor', () => {
  test('Content-Security-Policy es exactamente "default-src \'none\'", sin otras directivas', async () => {
    const res = await request(app).get('/');
    assert.equal(res.headers['content-security-policy'], "default-src 'none'");
  });

  test('la CSP mínima también se aplica a las respuestas de la API (no solo a la ruta raíz)', async () => {
    const res = await request(app).get('/api/no-existe');
    assert.equal(res.headers['content-security-policy'], "default-src 'none'");
  });

  test('HSTS sigue activo (lo activa helmet() por defecto; no se ha desactivado sin querer)', async () => {
    const res = await request(app).get('/');
    assert.match(res.headers['strict-transport-security'], /max-age=\d+/);
  });

  test('X-Content-Type-Options y demás cabeceras de helmet por defecto siguen presentes', async () => {
    const res = await request(app).get('/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
  });
});
