// Validación con Zod de /api/auth (task 2, punto 6). Solo se prueban los payloads que se
// rechazan ANTES de tocar la base de datos (igual que hacía app.test.js con los chequeos
// manuales de antes): así los tests no dependen de tener Supabase real configurado.
//
// El limitador de auth (15 intentos fallidos por IP cada 15 min) es un contador en memoria
// compartido por todo este archivo -- se cuenta con cuidado para no superar 15 peticiones en
// total entre todos los tests.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const supabase = require('../data/supabase');
const app = require('../index');

// El resto de tests de este archivo se quedan en la validación, sin llegar a tocar Supabase.
// Solo el test de "login no valida el email" sigue hasta el controlador -- se necesita este
// doble mínimo (tabla "clientes", sin filas) para que la búsqueda resuelva al momento, en vez
// de intentar una petición de red real contra la URL de prueba de testEnv.js (que no existe) y
// tardar varios segundos en fallar.
beforeEach(() => {
  mock.method(supabase, 'from', () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116' } }) }) }),
  }));
});
afterEach(() => mock.restoreAll());

describe('POST /api/auth/register — validación con Zod', () => {
  test('rechaza con 400 si falta el nombre', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'ana@example.com', password: '123456' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El nombre es obligatorio.');
  });

  test('rechaza con 400 un email con formato inválido', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Ana', email: 'no-es-un-email', password: '123456' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Introduce un email válido.');
  });

  test('rechaza con 400 una contraseña demasiado corta', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Ana', email: 'ana@example.com', password: '123' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /contraseña/i);
    assert.match(res.body.error, /6/);
  });

  test('con TODOS los campos ausentes, rechaza con el mensaje del primero (nombre)', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El nombre es obligatorio.');
  });

  test('un nombre que no es texto (un número) da el mismo mensaje que si faltara', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 123, email: 'ana@example.com', password: '123456' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El nombre es obligatorio.');
  });
});

describe('POST /api/auth/login — validación con Zod', () => {
  test('rechaza con 400 si falta el email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'lo-que-sea' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Email y contraseña requeridos.');
  });

  test('rechaza con 400 si falta la contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@example.com' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Email y contraseña requeridos.');
  });

  test('NO valida el formato del email (nunca lo hizo): pasa la validación y sigue al controlador', async () => {
    // Sin Supabase real detrás, sigue adelante hasta el error interno de la búsqueda -- lo
    // importante aquí es que NO se quede en la validación con "email inválido".
    const res = await request(app).post('/api/auth/login').send({ email: 'esto-no-es-un-email', password: 'lo-que-sea' });
    assert.notEqual(res.body.error, 'Introduce un email válido.');
  });
});

describe('POST /api/auth/google — validación con Zod', () => {
  test('rechaza con 400 si falta el token de credential', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Falta el token de Google.');
  });
});

describe('POST /api/auth/perfil-update — validación con Zod', () => {
  // No requiere estar logueado para llegar a la validación: verificarToken corre antes que
  // validar() en la ruta, así que sin token se corta en 401 antes de que Zod entre en juego.
  test('sin token, corta en 401 antes de llegar a la validación', async () => {
    const res = await request(app).post('/api/auth/perfil-update').send({ nuevoNombre: '' });
    assert.equal(res.status, 401);
  });
});
