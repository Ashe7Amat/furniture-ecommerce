// H28: límite de intentos de POST /api/auth/perfil-update. Con una sesión robada ya no se puede
// probar contraseñas actuales sin fin: 10 intentos fallidos cada 15 minutos por cuenta. Este archivo
// corre en su propio proceso, así que el contador del limitador empieza de cero; cada test usa
// cuentas distintas para no pisarse.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-jwt-de-prueba-para-este-archivo';
process.env.RESEND_API_KEY = '';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PASSWORD = 'la-contraseña-buena';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const LIMITE = 10;
const MENSAJE_LIMITE =
  'Demasiados intentos con una contraseña incorrecta. Espera 15 minutos antes de volver a intentarlo.';

const cuenta = (id, email) => ({ id, email, nombre: id, rol: 'cliente', password: HASH });
// Un access token como los de hoy (con `sub`) o, con sinSub, como los firmados antes de H28.
const tokenDe = ({ id, email }, { sinSub = false } = {}) =>
  jwt.sign(
    sinSub ? { email, nombre: id, rol: 'cliente' } : { sub: id, email, nombre: id, rol: 'cliente' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
const cambiarPassword = (token, passwordActual) =>
  request(app)
    .post('/api/auth/perfil-update')
    .set('Authorization', `Bearer ${token}`)
    .send({ passwordActual, nuevaPassword: 'una-contraseña-nueva' });
const cambiarNombre = (token, nuevoNombre) =>
  request(app)
    .post('/api/auth/perfil-update')
    .set('Authorization', `Bearer ${token}`)
    .send({ nuevoNombre });

const CUENTAS = {
  ana: cuenta('cli-ana', 'ana@example.com'),
  bea: cuenta('cli-bea', 'bea@example.com'),
  carla: cuenta('cli-carla', 'carla@example.com'),
  dani: cuenta('cli-dani', 'dani@example.com'),
  eva: cuenta('cli-eva', 'eva@example.com')
};

let avisos;
beforeEach(() => {
  const fake = crearFakeSupabase({ clientes: Object.values(CUENTAS).map((c) => ({ ...c })) });
  mock.method(supabase, 'from', fake.from);
  avisos = mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
  mock.method(console, 'log', () => {});
});
afterEach(() => mock.restoreAll());

describe('H28 — límite de intentos de perfil-update', () => {
  test('10 intentos con la contraseña mal dan 401; el 11 da 429 con un mensaje claro, y el 12, con la buena, también', async () => {
    const token = tokenDe(CUENTAS.ana);

    for (let i = 1; i <= LIMITE; i++) {
      const res = await cambiarPassword(token, `intento-${i}`);
      assert.equal(res.status, 401, `el intento ${i} todavía se comprueba`);
      assert.equal(res.body.error, 'La contraseña actual es incorrecta.');
    }

    const undecimo = await cambiarPassword(token, 'intento-11');
    assert.equal(undecimo.status, 429);
    assert.deepEqual(undecimo.body, { error: MENSAJE_LIMITE });

    const conLaBuena = await cambiarPassword(token, PASSWORD);
    assert.equal(conLaBuena.status, 429, 'hasta que pase la ventana, ni con la contraseña buena');
  });

  test('el límite es por cuenta, no por IP: desde la misma IP, otra cuenta sigue pudiendo', async () => {
    const deBea = tokenDe(CUENTAS.bea);
    for (let i = 1; i <= LIMITE + 1; i++) await cambiarPassword(deBea, `mal-${i}`);
    assert.equal((await cambiarPassword(deBea, PASSWORD)).status, 429);

    const res = await cambiarPassword(tokenDe(CUENTAS.carla), PASSWORD);

    assert.equal(res.status, 200);
  });

  test('cambiar el nombre (va bien y no pide contraseña) no gasta intentos', async () => {
    const token = tokenDe(CUENTAS.dani);
    for (let i = 1; i <= 5; i++) {
      assert.equal((await cambiarNombre(token, `Dani ${i}`)).status, 200);
    }

    for (let i = 1; i <= LIMITE; i++) {
      assert.equal(
        (await cambiarPassword(token, `mal-${i}`)).status,
        401,
        `el intento ${i} no llega al límite`
      );
    }
    assert.equal((await cambiarPassword(token, 'mal-11')).status, 429);
  });

  test('con un token de antes de H28 (sin `sub`), la cuenta se reconoce por su email', async () => {
    const antiguo = tokenDe(CUENTAS.eva, { sinSub: true });
    for (let i = 1; i <= LIMITE; i++) await cambiarPassword(antiguo, `mal-${i}`);

    assert.equal((await cambiarPassword(antiguo, 'mal-11')).status, 429);
  });

  test('los intentos fallidos y el límite quedan en el log con el id de la cuenta, nunca con la contraseña', async () => {
    const gema = cuenta('cli-gema', 'gema@example.com');
    mock.method(supabase, 'from', crearFakeSupabase({ clientes: [gema] }).from);
    const token = tokenDe(gema);

    for (let i = 1; i <= LIMITE + 1; i++) await cambiarPassword(token, `secreto-probado-${i}`);

    const mensajes = avisos.mock.calls.map((c) => c.arguments.join(' '));
    assert.equal(
      mensajes.filter((m) => m === 'perfil-update: contraseña actual incorrecta (cuenta cli-gema).')
        .length,
      LIMITE
    );
    assert.ok(mensajes.includes('perfil-update: límite de intentos alcanzado (cuenta:cli-gema).'));
    assert.doesNotMatch(mensajes.join('\n'), /secreto-probado|la-contraseña-buena/);
  });

  test('el access token de un inicio de sesión lleva el id de la cuenta en `sub`, que es la clave del límite', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(jwt.decode(res.body.token).sub, 'cli-ana');
  });

  test('cada contraseña incorrecta deja un aviso con el id de la cuenta', async () => {
    const token = tokenDe({ id: 'cli-fran', email: 'fran@example.com' });
    const fake = crearFakeSupabase({ clientes: [cuenta('cli-fran', 'fran@example.com')] });
    mock.method(supabase, 'from', fake.from);

    await cambiarPassword(token, 'no-es-esta');

    const mensajes = avisos.mock.calls.map((c) => c.arguments.join(' '));
    assert.ok(mensajes.includes('perfil-update: contraseña actual incorrecta (cuenta cli-fran).'));
    assert.doesNotMatch(mensajes.join('\n'), /no-es-esta/);
  });
});
