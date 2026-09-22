// CORS (task 2, punto 3): CLIENT_URL + ALLOWED_ORIGINS (lista separada por comas), sin ningún
// comodín. ALLOWED_ORIGINS se lee al cargar la app (una sola vez), así que este archivo fija su
// propio valor ANTES de requerir '../index' y corre en su propio proceso, sin compartirlo con
// otros tests de CORS.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.CLIENT_URL = 'https://nave5-demo.vercel.app';
process.env.ALLOWED_ORIGINS =
  'https://nave5-demo-git-mi-rama-mi-equipo.vercel.app, https://otro-dominio.com';

const app = require('../index');

const conOrigen = (origen) => request(app).get('/').set('Origin', origen);
const tieneCabeceraCors = (res) => res.headers['access-control-allow-origin'] !== undefined;

describe('CORS con ALLOWED_ORIGINS', () => {
  test('CLIENT_URL recibe la cabecera de acceso', async () => {
    const res = await conOrigen('https://nave5-demo.vercel.app');
    assert.equal(res.headers['access-control-allow-origin'], 'https://nave5-demo.vercel.app');
  });

  test('cada origen exacto de ALLOWED_ORIGINS recibe la cabecera de acceso (espacios incluidos, se recortan)', async () => {
    const res1 = await conOrigen('https://nave5-demo-git-mi-rama-mi-equipo.vercel.app');
    assert.equal(
      res1.headers['access-control-allow-origin'],
      'https://nave5-demo-git-mi-rama-mi-equipo.vercel.app'
    );

    const res2 = await conOrigen('https://otro-dominio.com');
    assert.equal(res2.headers['access-control-allow-origin'], 'https://otro-dominio.com');
  });

  test('un origen .vercel.app que NO está en ALLOWED_ORIGINS ya NO recibe la cabecera (sin comodín)', async () => {
    const res = await conOrigen('https://un-despliegue-de-vista-previa-cualquiera.vercel.app');
    assert.equal(res.status, 403);
    assert.ok(!tieneCabeceraCors(res));
    assert.equal(res.body.error, 'Origen no autorizado.');
  });

  test('un origen cualquiera no listado recibe 403, sin la cabecera de acceso', async () => {
    const res = await conOrigen('https://sitio-no-autorizado.example.com');
    assert.equal(res.status, 403);
    assert.ok(!tieneCabeceraCors(res));
  });

  test('localhost:5173 (dev del cliente) sigue funcionando aunque no esté en ALLOWED_ORIGINS', async () => {
    const res = await conOrigen('http://localhost:5173');
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  });

  test('sin cabecera Origin (curl, health checks) se permite sin la cabecera de acceso', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
  });
});
