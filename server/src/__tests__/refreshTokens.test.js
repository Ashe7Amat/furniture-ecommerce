// JWT de 1 hora + refresh tokens con rotación, detección de reuso y margen de gracia
// (docs/tarea3-diseno.md, sección 2; bloque 3b, commit C2). Todo pasa por la app Express real
// (supertest) y el código real de utils/refreshTokens.js, contra el doble en memoria de Supabase.
// Del doble solo se usa su atomicidad: cada update() filtra y modifica en un único paso, como el
// UPDATE ... WHERE revoked_at IS NULL de Postgres (hay un test del propio doble al final). La
// lógica de gracia, reuso y firma es la de producción, no del doble.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-jwt-de-prueba-para-este-archivo';
process.env.GOOGLE_CLIENT_ID = 'cliente-google-de-prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const supabase = require('../data/supabase');
const app = require('../index');
const refreshTokens = require('../utils/refreshTokens');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PASSWORD = 'contraseña-de-ana';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const SESION_NO_VALIDA = { error: 'Sesión no válida, vuelve a iniciar sesión.' };

const cuenta = (id, email, extra = {}) => ({
  id,
  email,
  nombre: email.split('@')[0],
  rol: 'cliente',
  password: HASH,
  ...extra
});

let fake;
let avisos;
let errores;
beforeEach(() => {
  fake = crearFakeSupabase({
    clientes: [
      cuenta('cli-ana', 'ana@example.com', { nombre: 'Ana' }),
      cuenta('cli-bea', 'bea@example.com', { nombre: 'Bea' })
    ]
  });
  mock.method(supabase, 'from', fake.from);
  avisos = mock.method(console, 'warn', () => {});
  errores = mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

const iniciarSesion = async (email = 'ana@example.com') => {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200);
  return res.body;
};
const refrescar = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });
const cerrar = (refreshToken) => request(app).post('/api/auth/logout').send({ refreshToken });
const hmac = (token) =>
  crypto.createHmac('sha256', process.env.REFRESH_TOKEN_HASH_SECRET).update(token).digest('hex');
const fila = (token) => fake.tablas.refresh_tokens.find((f) => f.token_hash === hmac(token));
const deFamilia = (familia) => fake.tablas.refresh_tokens.filter((f) => f.family_id === familia);
const activas = (familia) => deFamilia(familia).filter((f) => f.revoked_at == null);
const haceSegundos = (s) => new Date(Date.now() - s * 1000).toISOString();

describe('inicio de sesión: access token de 1 hora + refresh token', () => {
  test('el login devuelve un access token de 1 hora y un refresh token guardado solo como HMAC', async () => {
    const { token, refreshToken } = await iniciarSesion();

    const { exp, iat, email } = jwt.decode(token);
    assert.equal(exp - iat, 3600);
    assert.equal(email, 'ana@example.com');

    assert.match(refreshToken, /^[A-Za-z0-9_-]{43}$/, '32 bytes aleatorios en base64url');
    const guardada = fila(refreshToken);
    assert.ok(guardada, 'se guarda el HMAC-SHA256 con REFRESH_TOKEN_HASH_SECRET');
    assert.equal(guardada.user_id, 'cli-ana');
    assert.ok(guardada.family_id);
    assert.equal(guardada.revoked_at ?? null, null);
    assert.ok(
      !Object.values(guardada).some((v) => String(v).includes(refreshToken)),
      'el token en claro no se guarda en ninguna columna'
    );
    const dias = (new Date(guardada.expires_at) - Date.now()) / 86400000;
    assert.ok(dias > 6.99 && dias <= 7, `caduca a los 7 días (${dias})`);
  });

  test('cada inicio de sesión es una familia nueva', async () => {
    const a = await iniciarSesion();
    const b = await iniciarSesion();
    assert.notEqual(fila(a.refreshToken).family_id, fila(b.refreshToken).family_id);
  });

  test('el registro también emite el par', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Carla', email: 'carla@example.com', password: 'secreta-1' });

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(fila(res.body.refreshToken).user_id, fake.tablas.clientes[2].id);
  });

  test('el login con Google también emite el par, también para una cuenta nueva', async () => {
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({
      getPayload: () => ({ email: 'dani@example.com', email_verified: true, name: 'Dani' })
    }));

    const res = await request(app).post('/api/auth/google').send({ credential: 'credencial' });

    assert.equal(res.status, 200);
    const nueva = fake.tablas.clientes.find((c) => c.email === 'dani@example.com');
    assert.equal(fila(res.body.refreshToken).user_id, nueva.id);
  });

  test('sin REFRESH_TOKEN_HASH_SECRET se inicia sesión sin refresh token, y queda registrado', async () => {
    const secreto = process.env.REFRESH_TOKEN_HASH_SECRET;
    delete process.env.REFRESH_TOKEN_HASH_SECRET;
    try {
      const { token, refreshToken } = await iniciarSesion();
      assert.ok(token);
      assert.equal(refreshToken, null);
      assert.equal(fake.tablas.refresh_tokens.length, 0);
      assert.ok(
        errores.mock.calls.some((c) => String(c.arguments[0]).includes('REFRESH_TOKEN_HASH_SECRET'))
      );
    } finally {
      process.env.REFRESH_TOKEN_HASH_SECRET = secreto;
    }
  });
});

describe('POST /api/auth/refresh — rotación', () => {
  test('rota: par nuevo, el viejo queda revocado apuntando al nuevo, en la misma familia', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const familia = fila(r1).family_id;

    const res = await refrescar(r1);

    assert.equal(res.status, 200);
    const { accessToken, refreshToken: r2 } = res.body;
    assert.equal(jwt.decode(accessToken).email, 'ana@example.com');
    assert.notEqual(r2, r1);
    assert.ok(fila(r1).revoked_at);
    assert.equal(fila(r1).replaced_by, fila(r2).id);
    assert.equal(fila(r2).family_id, familia);
    assert.deepEqual(
      activas(familia).map((f) => f.id),
      [fila(r2).id]
    );
  });

  test('el access token nuevo lee la cuenta de nuevo: refleja un cambio de nombre o de rol', async () => {
    const { refreshToken } = await iniciarSesion();
    Object.assign(fake.tablas.clientes[0], { nombre: 'Ana María', rol: 'admin' });

    const res = await refrescar(refreshToken);

    const { nombre, rol } = jwt.decode(res.body.accessToken);
    assert.deepEqual({ nombre, rol }, { nombre: 'Ana María', rol: 'admin' });
  });

  test('el mismo 401 genérico en los tres casos: token inexistente, reuso y caducado', async () => {
    const inexistente = await refrescar('un-token-que-nunca-se-ha-emitido');

    const { refreshToken: r1 } = await iniciarSesion();
    await refrescar(r1);
    fila(r1).revoked_at = haceSegundos(120); // fuera del margen de gracia
    const reuso = await refrescar(r1);

    const { refreshToken: rc } = await iniciarSesion();
    fila(rc).expires_at = haceSegundos(1);
    const caducado = await refrescar(rc);

    for (const res of [inexistente, reuso, caducado]) {
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, SESION_NO_VALIDA);
    }
    // El motivo va al log (para investigar), pero nunca el token.
    const log = avisos.mock.calls.map((c) => String(c.arguments[0])).join('\n');
    assert.match(log, /inexistente/);
    assert.match(log, /reuso/);
    assert.match(log, /caducado/);
    for (const token of [r1, rc]) assert.ok(!log.includes(token));
  });

  test('un token caducado queda además revocado', async () => {
    const { refreshToken } = await iniciarSesion();
    fila(refreshToken).expires_at = haceSegundos(1);

    await refrescar(refreshToken);

    assert.ok(fila(refreshToken).revoked_at);
  });

  test('reuso fuera del margen de 60 s: revoca la familia entera, incluida la sucesora activa', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const { refreshToken: otraSesion } = await iniciarSesion();
    const r2 = (await refrescar(r1)).body.refreshToken;
    const familia = fila(r1).family_id;
    fila(r1).revoked_at = haceSegundos(61);

    assert.equal((await refrescar(r1)).status, 401);

    assert.equal(activas(familia).length, 0);
    assert.equal((await refrescar(r2)).status, 401, 'la sucesora también ha caído');
    assert.equal((await refrescar(otraSesion)).status, 200, 'las demás sesiones no se tocan');
  });
});

describe('POST /api/auth/refresh — margen de gracia (dos pestañas con el mismo token)', () => {
  test('el token recién rotado, con su sucesora activa, recibe otra rotación a partir de ella', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const r2 = (await refrescar(r1)).body.refreshToken; // la pestaña A rota
    const familia = fila(r1).family_id;

    const res = await refrescar(r1); // la pestaña B aún tenía el viejo

    assert.equal(res.status, 200);
    const r3 = res.body.refreshToken;
    assert.equal(fila(r2).replaced_by, fila(r3).id, 'se rota desde la sucesora');
    assert.deepEqual(
      activas(familia).map((f) => f.id),
      [fila(r3).id]
    );
  });

  test('un solo salto por petición: si la sucesora también está revocada, es un reuso', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const r2 = (await refrescar(r1)).body.refreshToken;
    await refrescar(r2); // r2 también rotado: r1 queda a dos saltos del token activo
    const familia = fila(r1).family_id;

    assert.equal((await refrescar(r1)).status, 401);
    assert.equal(activas(familia).length, 0);
  });

  test('el salto es por petición, no global: tres pestañas encadenan rotaciones dentro de su margen', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const r2 = (await refrescar(r1)).body.refreshToken; // pestaña A: r1 → r2
    const r3 = (await refrescar(r1)).body.refreshToken; // pestaña B, con r1: gracia → r3
    const res = await refrescar(r2); // pestaña C, con r2 (revocado hace nada por B): gracia → r4

    assert.equal(res.status, 200);
    assert.equal(fila(r3).replaced_by, fila(res.body.refreshToken).id);
    assert.equal(activas(fila(r1).family_id).length, 1);
  });

  test('concurrencia real: dos peticiones a la vez con el mismo token reciben par válido y solo queda una fila activa', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const familia = fila(r1).family_id;

    const [a, b] = await Promise.all([refrescar(r1), refrescar(r1)]);

    // (a) ninguna recibe un 401: una rota normal y la otra entra por el margen de gracia
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.notEqual(a.body.refreshToken, b.body.refreshToken);
    // (b) nunca quedan dos filas activas a la vez en la familia
    assert.equal(activas(familia).length, 1);
    // la cadena queda entera: cada fila revocada apunta a su sucesora
    for (const f of deFamilia(familia).filter((f) => f.revoked_at)) assert.ok(f.replaced_by);
  });

  test('concurrencia en el módulo: la petición que pierde la carrera borra su sucesor y entra por el margen', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const familia = fila(r1).family_id;

    const resultados = await Promise.all([refreshTokens.rotar(r1), refreshTokens.rotar(r1)]);

    assert.ok(resultados.every((r) => r.ok));
    const borrados = fake.escrituras.filter(
      (e) => e.tabla === 'refresh_tokens' && e.accion === 'delete'
    );
    assert.equal(borrados.length, 1, 'el sucesor huérfano de la que perdió se borra');
    assert.equal(activas(familia).length, 1);
  });

  test('(c) fuera del margen, la segunda petición recibe el 401 genérico y la familia queda revocada', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    await refrescar(r1);
    fila(r1).revoked_at = haceSegundos(61); // la revocación fue hace más de 60 s

    const res = await refrescar(r1);

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, SESION_NO_VALIDA);
    assert.equal(activas(fila(r1).family_id).length, 0);
  });
});

describe('POST /api/auth/logout', () => {
  test('revoca toda la familia (todas las rotaciones de la sesión) y no toca las demás sesiones', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const { refreshToken: otraSesion } = await iniciarSesion();
    const r2 = (await refrescar(r1)).body.refreshToken;

    const res = await cerrar(r2);

    assert.equal(res.status, 200);
    assert.equal(activas(fila(r1).family_id).length, 0);
    assert.equal((await refrescar(r2)).status, 401);
    assert.equal((await refrescar(otraSesion)).status, 200);
  });

  test('cerrar sesión con un token ya rotado (una pestaña que se quedó atrás) cierra la sesión entera', async () => {
    const { refreshToken: r1 } = await iniciarSesion();
    const r2 = (await refrescar(r1)).body.refreshToken; // otra pestaña rotó: r1 ya está revocado

    assert.equal((await cerrar(r1)).status, 200);

    assert.equal(activas(fila(r1).family_id).length, 0, 'también cae la sucesora activa');
    assert.equal((await refrescar(r2)).status, 401);
  });

  test('responde 200 aunque el token no exista o ya esté revocado', async () => {
    const { refreshToken } = await iniciarSesion();

    assert.equal((await cerrar('un-token-que-nunca-se-ha-emitido')).status, 200);
    assert.equal((await cerrar(refreshToken)).status, 200);
    assert.equal((await cerrar(refreshToken)).status, 200);
  });

  test('sin refresh token en el cuerpo, las dos rutas responden 400', async () => {
    for (const ruta of ['/api/auth/refresh', '/api/auth/logout']) {
      const res = await request(app).post(ruta).send({});
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Falta el refresh token.');
    }
  });

  test('sin REFRESH_TOKEN_HASH_SECRET, refresh y logout responden 503 (no un 401 que cerraría la sesión)', async () => {
    const { refreshToken } = await iniciarSesion();
    const secreto = process.env.REFRESH_TOKEN_HASH_SECRET;
    delete process.env.REFRESH_TOKEN_HASH_SECRET;
    try {
      assert.equal((await refrescar(refreshToken)).status, 503);
      assert.equal((await cerrar(refreshToken)).status, 503);
    } finally {
      process.env.REFRESH_TOKEN_HASH_SECRET = secreto;
    }
  });
});

describe('H21: cambiar la contraseña o el email cierra todas las sesiones', () => {
  const actualizar = (token, cuerpo) =>
    request(app)
      .post('/api/auth/perfil-update')
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo);

  test('cambiar la contraseña revoca todos los refresh del usuario y da uno nuevo a esta sesión', async () => {
    const sesion = await iniciarSesion();
    const { refreshToken: otroDispositivo } = await iniciarSesion();
    const { refreshToken: deBea } = await iniciarSesion('bea@example.com');

    const res = await actualizar(sesion.token, {
      passwordActual: PASSWORD,
      nuevaPassword: 'otra-contraseña'
    });

    assert.equal(res.status, 200);
    const deAna = fake.tablas.refresh_tokens.filter((f) => f.user_id === 'cli-ana');
    assert.deepEqual(
      deAna.filter((f) => f.revoked_at == null).map((f) => f.id),
      [fila(res.body.refreshToken).id],
      'solo queda activa la sesión nueva de quien hizo el cambio'
    );
    assert.equal((await refrescar(sesion.refreshToken)).status, 401);
    assert.equal((await refrescar(otroDispositivo)).status, 401);
    assert.equal((await refrescar(res.body.refreshToken)).status, 200);
    assert.equal((await refrescar(deBea)).status, 200, 'las sesiones de otras cuentas no se tocan');
  });

  test('cambiar el email también', async () => {
    const sesion = await iniciarSesion();

    const res = await actualizar(sesion.token, {
      passwordActual: PASSWORD,
      nuevoEmail: 'ana.nueva@example.com'
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.refreshToken);
    assert.equal((await refrescar(sesion.refreshToken)).status, 401);
    const refrescado = await refrescar(res.body.refreshToken);
    assert.equal(jwt.decode(refrescado.body.accessToken).email, 'ana.nueva@example.com');
  });

  test('cambiar solo el nombre no revoca nada y la respuesta no trae refreshToken', async () => {
    const sesion = await iniciarSesion();

    const res = await actualizar(sesion.token, { nuevoNombre: 'Ana María' });

    assert.equal(res.status, 200);
    assert.equal('refreshToken' in res.body, false);
    assert.equal(jwt.decode(res.body.token).exp - jwt.decode(res.body.token).iat, 3600);
    assert.equal((await refrescar(sesion.refreshToken)).status, 200);
  });

  test('con la contraseña actual incorrecta no se revoca nada', async () => {
    const sesion = await iniciarSesion();

    const res = await actualizar(sesion.token, {
      passwordActual: 'no-es-la-contraseña',
      nuevaPassword: 'otra-contraseña'
    });

    assert.equal(res.status, 401);
    assert.equal((await refrescar(sesion.refreshToken)).status, 200);
  });
});

describe('mantenimiento y el doble', () => {
  test('limpiarExpirados borra solo los que caducaron hace más de 30 días', async () => {
    const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();
    fake = crearFakeSupabase({
      refresh_tokens: [
        { id: 'viejo', expires_at: dias(-31) },
        { id: 'reciente', expires_at: dias(-29) },
        { id: 'activo', expires_at: dias(6) }
      ]
    });
    mock.method(supabase, 'from', fake.from);

    assert.equal(await refreshTokens.limpiarExpirados(), 1);
    assert.deepEqual(
      fake.tablas.refresh_tokens.map((f) => f.id),
      ['reciente', 'activo']
    );
  });

  test('el doble es atómico: dos UPDATE condicionales a la vez, solo uno se queda la fila', async () => {
    fake = crearFakeSupabase({ refresh_tokens: [{ id: 't1', revoked_at: null }] });
    const reclamar = () =>
      fake
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', 't1')
        .is('revoked_at', null)
        .select('id');

    const [a, b] = await Promise.all([reclamar(), reclamar()]);

    assert.deepEqual([a.data.length, b.data.length].sort(), [0, 1]);
  });
});
