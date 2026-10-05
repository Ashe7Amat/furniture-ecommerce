// Tests de authController.js (tarea 5 de la sesión del 5 oct 2026, cobertura): los caminos de error
// que no tenían test. Registro con un email ya usado o con la base de datos caída; login cuando
// falla algo inesperado; perfil sin la contraseña actual, de una cuenta que ya no existe o cuando
// falla el guardado; Google sin token o sin configurar; y renovar o cerrar la sesión cuando la
// cuenta ya no existe o falta el secreto de los refresh tokens.
// Pocas peticiones fallidas de login/registro por archivo: el límite es de 15 por IP (authRoutes.js).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
delete process.env.GOOGLE_CLIENT_ID; // sin cliente de Google configurado

const supabase = require('../data/supabase');
const app = require('../index');
const refreshTokens = require('../utils/refreshTokens');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PASSWORD = 'contraseña-de-ana';
const ANA = {
  id: 'cli-ana',
  email: 'ana@example.com',
  nombre: 'Ana',
  rol: 'cliente',
  password: bcrypt.hashSync(PASSWORD, 4)
};
const tokenDe = (usuario) =>
  jwt.sign(
    { sub: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET
  );

let fake;
const instalar = (opciones = {}) => {
  fake = crearFakeSupabase({ clientes: [{ ...ANA }], ...opciones });
  mock.method(supabase, 'from', fake.from);
};
beforeEach(() => {
  instalar();
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
});
afterEach(() => mock.restoreAll());

describe('registro', () => {
  test('con un email ya registrado, 400 y no crea otra cuenta', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Otra Ana', email: ANA.email, password: 'una-contraseña-larga' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El correo electrónico ya está registrado.');
    assert.equal(fake.tablas.clientes.length, 1);
  });

  test('si falla la base de datos al crear la cuenta, 500 genérico', async () => {
    instalar({ fallos: { 'clientes.insert': { message: 'caída' } } });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Bea', email: 'bea@example.com', password: 'una-contraseña-larga' });

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error interno del servidor al crear la cuenta.');
  });
});

describe('login', () => {
  test('con la contraseña mal, 401 con el mensaje de credenciales', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: 'no-es-esta' });
    assert.equal(res.status, 401);
  });

  test('si algo falla de forma inesperada, 500 genérico', async () => {
    mock.method(supabase, 'from', () => {
      throw new Error('sin conexión');
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: PASSWORD });

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error interno del servidor al iniciar sesión.');
  });
});

describe('perfil (POST /api/auth/perfil-update)', () => {
  const actualizar = (cuerpo, usuario = ANA) =>
    request(app)
      .post('/api/auth/perfil-update')
      .set('Authorization', `Bearer ${tokenDe(usuario)}`)
      .send(cuerpo);

  test('cambiar el email sin la contraseña actual: 400', async () => {
    const res = await actualizar({ nuevoEmail: 'ana.nueva@example.com' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /contraseña actual/);
  });

  test('una cuenta que ya no existe: 404', async () => {
    instalar({ clientes: [] });
    const res = await actualizar({
      nuevaPassword: 'otra-contraseña-larga',
      passwordActual: PASSWORD
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'El usuario no existe.');
  });

  test('si falla el guardado, 500 genérico', async () => {
    instalar({ fallos: { 'clientes.update': { message: 'caída' } } });
    const res = await actualizar({ nuevoNombre: 'Ana María' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'No se pudo actualizar la información de la cuenta.');
  });
});

describe('Google', () => {
  test('sin GOOGLE_CLIENT_ID en el servidor, 500 con un mensaje claro', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: 'token-de-google' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'El inicio de sesión con Google no está disponible ahora mismo.');
  });
});

describe('renovar y cerrar la sesión', () => {
  const iniciarSesion = async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: PASSWORD });
    assert.equal(res.status, 200);
    return res.body.refreshToken;
  };

  test('si la cuenta se ha borrado, renovar da 401 y revoca la sesión entera', async () => {
    const refreshToken = await iniciarSesion();
    fake.tablas.clientes.splice(0, 1);

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Sesión no válida, vuelve a iniciar sesión.');
    assert.ok(
      fake.tablas.refresh_tokens.every((t) => t.revoked_at),
      'todos los tokens de la familia quedan revocados'
    );
  });

  test('sin el secreto de los refresh tokens: 503 al renovar y al cerrar', async () => {
    const sinSecreto = () => {
      throw new refreshTokens.SecretoNoConfigurado();
    };
    mock.method(refreshTokens, 'rotar', sinSecreto);
    mock.method(refreshTokens, 'revocarFamiliaDeToken', sinSecreto);
    const token = 'a'.repeat(43);

    const renovar = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    assert.equal(renovar.status, 503);

    const cerrar = await request(app).post('/api/auth/logout').send({ refreshToken: token });
    assert.equal(cerrar.status, 503);
  });

  test('cualquier otro fallo: 500 al renovar y al cerrar', async () => {
    const roto = () => {
      throw new Error('caída');
    };
    mock.method(refreshTokens, 'rotar', roto);
    mock.method(refreshTokens, 'revocarFamiliaDeToken', roto);
    const token = 'a'.repeat(43);

    const renovar = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    assert.equal(renovar.status, 500);

    const cerrar = await request(app).post('/api/auth/logout').send({ refreshToken: token });
    assert.equal(cerrar.status, 500);
    assert.equal(cerrar.body.error, 'No se pudo cerrar la sesión en el servidor.');
  });
});
