const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-password-reset';

const supabase = require('../data/supabase');
const app = require('../index');
const correos = require('../utils/email');
const refreshTokens = require('../utils/refreshTokens');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PASSWORD_ORIGINAL = 'contraseña-original-valida';
const ANA = {
  id: 'cli-ana',
  email: 'ana@example.com',
  nombre: 'Ana',
  rol: 'cliente',
  password: bcrypt.hashSync(PASSWORD_ORIGINAL, 10)
};

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

describe('POST /api/auth/forgot-password', () => {
  test('forgot-password responde 200 siempre: si el email existe genera token y envía email', async () => {
    let emailEnviado = null;
    let urlEnviada = null;
    mock.method(correos, 'enviarEmailRecuperacion', async (destinatario, url) => {
      emailEnviado = destinatario;
      urlEnviada = url;
    });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ana@example.com' });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Si el correo está registrado, recibirás un enlace.');
    assert.equal(fake.tablas.password_resets.length, 1);

    const fila = fake.tablas.password_resets[0];
    assert.equal(fila.email, 'ana@example.com');
    assert.ok(fila.token_hash);
    assert.ok(new Date(fila.expires_at).getTime() > Date.now());
    assert.equal(fila.used_at, null);

    assert.equal(emailEnviado, 'ana@example.com');
    assert.ok(urlEnviada && urlEnviada.includes('/reset-password?token='));
  });

  test('forgot-password responde 200 siempre: si el email no existe responde 200 sin revelar nada', async () => {
    let emailLlamado = false;
    mock.method(correos, 'enviarEmailRecuperacion', async () => {
      emailLlamado = true;
    });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'desconocido@example.com' });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Si el correo está registrado, recibirás un enlace.');
    assert.equal(fake.tablas.password_resets.length, 0);
    assert.equal(emailLlamado, false);
  });

  test('forgot-password responde 200 siempre: con cuerpo vacío o sin email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Si el correo está registrado, recibirás un enlace.');
  });

  test('forgot-password responde 200 si falla la búsqueda en la BD', async () => {
    instalar({ fallos: { 'clientes.select': { message: 'error bd' } } });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ana@example.com' });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Si el correo está registrado, recibirás un enlace.');
  });

  test('forgot-password responde 200 si falla el insert en password_resets', async () => {
    instalar({ fallos: { 'password_resets.insert': { message: 'error insert' } } });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ana@example.com' });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Si el correo está registrado, recibirás un enlace.');
  });
});

describe('POST /api/auth/reset-password', () => {
  const tokenValido = 'token-secreto-hex-1234567890abcdef1234567890abcdef';
  const tokenHashValido = crypto.createHash('sha256').update(tokenValido).digest('hex');

  test('reset-password con token válido cambia la contraseña, marca el token usado y revoca refresh tokens', async () => {
    let revocadoUsuarioId = null;
    mock.method(refreshTokens, 'revocarTodasDelUsuario', async (userId) => {
      revocadoUsuarioId = userId;
    });

    instalar({
      password_resets: [
        {
          id: 'pr-1',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: null
        }
      ]
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Contraseña restablecida con éxito.');

    // Comprobar que clientes.password ha cambiado y valida con bcrypt
    const clienteActualizado = fake.tablas.clientes.find((c) => c.email === 'ana@example.com');
    assert.ok(clienteActualizado.password !== ANA.password);
    assert.ok(bcrypt.compareSync('nueva-super-password-123', clienteActualizado.password));

    // Comprobar que el token se marcó como usado
    const resetFila = fake.tablas.password_resets.find((r) => r.id === 'pr-1');
    assert.ok(resetFila.used_at);

    // Comprobar que se revocaron las sesiones de refresh token
    assert.equal(revocadoUsuarioId, 'cli-ana');
  });

  test('reset-password con token expirado falla con 400', async () => {
    instalar({
      password_resets: [
        {
          id: 'pr-exp',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() - 1000).toISOString(),
          used_at: null
        }
      ]
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /caducado/i);
  });

  test('reset-password con token usado falla con 400', async () => {
    instalar({
      password_resets: [
        {
          id: 'pr-used',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: new Date(Date.now() - 5000).toISOString()
        }
      ]
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /utilizado|usado/i);
  });

  test('Contraseña corta falla con 400', async () => {
    instalar({
      password_resets: [
        {
          id: 'pr-1',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: null
        }
      ]
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'corta'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /al menos 8 caracteres/i);
  });

  test('reset-password con token inexistente falla con 400', async () => {
    instalar({ password_resets: [] });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'token-inventado-que-no-existe',
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /no es válido o ha caducado/i);
  });

  test('reset-password si falla la lectura en la BD responde 500', async () => {
    instalar({ fallos: { 'password_resets.select': { message: 'error bd' } } });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 500);
  });

  test('reset-password si falla la actualización de contraseña responde 500', async () => {
    instalar({
      password_resets: [
        {
          id: 'pr-1',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: null
        }
      ],
      fallos: { 'clientes.update': { message: 'error update' } }
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 500);
  });

  test('reset-password si falla marcar usado responde 200 igualmente', async () => {
    instalar({
      password_resets: [
        {
          id: 'pr-1',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: null
        }
      ],
      fallos: { 'password_resets.update': { message: 'error update reset' } }
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 200);
  });

  test('reset-password si falla revocar refresh tokens responde 200 igualmente', async () => {
    mock.method(refreshTokens, 'revocarTodasDelUsuario', async () => {
      throw new Error('error al revocar');
    });

    instalar({
      password_resets: [
        {
          id: 'pr-1',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: null
        }
      ]
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 200);
  });

  test('solicitarRecuperacion maneja excepciones inesperadas devolviendo 200 genérico', async () => {
    const { solicitarRecuperacion } = require('../controllers/authController');
    mock.method(crypto, 'randomBytes', () => {
      throw new Error('error simulado de crypto');
    });

    let respuestaJson = null;
    let codigoEstado = null;
    const req = { body: { email: 'ana@example.com' } };
    const res = {
      status(c) {
        codigoEstado = c;
        return this;
      },
      json(b) {
        respuestaJson = b;
        return this;
      }
    };

    await solicitarRecuperacion(req, res);
    assert.equal(codigoEstado, 200);
    assert.equal(respuestaJson.message, 'Si el correo está registrado, recibirás un enlace.');
  });

  test('restablecerPassword valida token y longitud mínima al ser invocado directamente', async () => {
    const { restablecerPassword } = require('../controllers/authController');

    let codigoEstado = null;
    let respuestaJson = null;
    const res = {
      status(c) {
        codigoEstado = c;
        return this;
      },
      json(b) {
        respuestaJson = b;
        return this;
      }
    };

    await restablecerPassword({ body: {} }, res);
    assert.equal(codigoEstado, 400);
    assert.equal(respuestaJson.error, 'El token es obligatorio.');

    await restablecerPassword({ body: { token: 'tok', newPassword: 'corta' } }, res);
    assert.equal(codigoEstado, 400);
    assert.equal(respuestaJson.error, 'La contraseña debe tener al menos 8 caracteres.');
  });

  test('restablecerPassword maneja excepciones inesperadas devolviendo 500', async () => {
    const { restablecerPassword } = require('../controllers/authController');
    mock.method(crypto, 'createHash', () => {
      throw new Error('error simulado');
    });

    let codigoEstado = null;
    let respuestaJson = null;
    const res = {
      status(c) {
        codigoEstado = c;
        return this;
      },
      json(b) {
        respuestaJson = b;
        return this;
      }
    };

    await restablecerPassword({ body: { token: 'token-test', newPassword: 'password123' } }, res);
    assert.equal(codigoEstado, 500);
    assert.equal(respuestaJson.error, 'Error al restablecer la contraseña.');
  });

  test('restablecerPassword maneja error de base de datos al actualizar la contraseña', async () => {
    instalar({
      password_resets: [
        {
          id: 'pr-1',
          email: 'ana@example.com',
          token_hash: tokenHashValido,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          used_at: null
        }
      ],
      fallos: { 'clientes.update': { message: 'error bd update cliente' } }
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: tokenValido,
      newPassword: 'nueva-super-password-123'
    });

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al actualizar la contraseña.');
  });
});
