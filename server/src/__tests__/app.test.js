// Tests con el test runner nativo de Node (node --test) + supertest, sin tocar Supabase
// de verdad: solo se comprueban las validaciones que ocurren ANTES de cualquier llamada a
// la base de datos (así los tests no dependen de tener credenciales reales configuradas),
// más el manejo de rutas desconocidas y errores centralizado en index.js.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../index');

describe('GET /', () => {
  test('responde 200 con el mensaje de comprobación', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /API del Catálogo de Muebles funcionando/);
  });
});

describe('Rutas de /api desconocidas', () => {
  test('devuelve 404 con un JSON de error, no un 500 ni HTML', async () => {
    const res = await request(app).get('/api/esto-no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Ruta no encontrada.');
  });
});

describe('POST /api/auth/register — validación de entrada', () => {
  test('rechaza con 400 si faltan campos', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@a.com' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test('rechaza con 400 un email con formato inválido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Ana', email: 'no-es-un-email', password: '123456' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /email/i);
  });

  test('rechaza con 400 una contraseña demasiado corta', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Ana', email: 'ana@example.com', password: '123' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /contraseña/i);
  });
});

describe('POST /api/auth/login — validación de entrada', () => {
  test('rechaza con 400 si falta el email o la contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@example.com' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });
});

describe('POST /api/auth/google — validación de entrada', () => {
  test('rechaza con 400 si falta el token de credential', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /token/i);
  });
});

describe('CORS', () => {
  test('un origen no permitido no recibe la cabecera de acceso', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'https://sitio-no-autorizado.example.com');
    // El middleware de CORS de Express no corta la petición: simplemente no añade la
    // cabecera Access-Control-Allow-Origin, que es lo que hace que el navegador bloquee
    // la respuesta en el lado del cliente.
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('localhost:5173 (dev del cliente) sí recibe la cabecera de acceso', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  });
});
