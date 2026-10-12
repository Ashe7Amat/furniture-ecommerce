// H18: verificación del email de las cuentas (docs/verificacion-email-diseno.md, partes 6 y 8). Todo
// pasa por la app Express real (supertest) y el código real de utils/verificacionEmail.js, contra el
// doble en memoria de Supabase. Los correos se sustituyen por espías, para leer el enlace que llevan.
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
process.env.RESEND_API_KEY = '';
process.env.CLIENT_URL = 'https://tienda.example.com/';

const supabase = require('../data/supabase');
const app = require('../index');
const email = require('../utils/email');
const verificacionEmail = require('../utils/verificacionEmail');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PASSWORD = 'contraseña-de-prueba';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const ENLACE_NO_VALIDO = { error: 'El enlace no es válido o ha caducado.' };

const cuenta = (id, correo, extra = {}) => ({
  id,
  email: correo,
  nombre: correo.split('@')[0],
  rol: 'cliente',
  password: HASH,
  email_verificado: false,
  email_pendiente: null,
  ...extra
});
const pedido = (id, correo, extra = {}) => ({
  id,
  cliente_id: null,
  cliente_info: { email: correo },
  estado: 'procesando',
  created_at: '2026-10-01',
  ...extra
});
const tokenDe = ({ id, email: correo }, { sinSub = false } = {}) =>
  jwt.sign(
    { ...(!sinSub && { sub: id }), email: correo, nombre: 'x', rol: 'cliente' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
const hmac = (token) =>
  crypto.createHmac('sha256', process.env.EMAIL_TOKEN_HASH_SECRET).update(token).digest('hex');
const tokenDeUrl = (url) => new URL(url).searchParams.get('token');
const verificar = (token) => request(app).post('/api/auth/verificar-email').send({ token });
const reenviar = (jwtSesion) =>
  request(app).post('/api/auth/reenviar-verificacion').set('Authorization', `Bearer ${jwtSesion}`);

let fake;
let espias;
let errores;
const instalar = (tablas = {}) => {
  fake = crearFakeSupabase(tablas);
  mock.method(supabase, 'from', fake.from);
  return fake;
};
beforeEach(() => {
  instalar();
  espias = {
    registro: mock.method(email, 'enviarConfirmarRegistro', () => {}),
    activada: mock.method(email, 'enviarCuentaActivada', () => {}),
    cambio: mock.method(email, 'enviarConfirmarCambioEmail', () => {}),
    aviso: mock.method(email, 'enviarAvisoCambioEmail', () => {}),
    protegida: mock.method(email, 'enviarCuentaProtegida', () => {}),
    bienvenida: mock.method(email, 'enviarEmailBienvenida', () => {})
  };
  errores = mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  mock.method(console, 'log', () => {});
});
afterEach(() => mock.restoreAll());

// Crea un enlace válido para la cuenta y devuelve el token en claro.
const enlaceDe = (cliente, motivo = 'registro', destino = cliente.email) =>
  verificacionEmail.crear({ clienteId: cliente.id, email: destino, motivo });

describe('registro', () => {
  const registrar = (correo = 'carla@example.com') =>
    request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Carla', email: correo, password: PASSWORD });

  test('la cuenta nace sin verificar, con sesión, y recibe el correo de confirmar en vez del de bienvenida', async () => {
    const res = await registrar();

    assert.equal(res.status, 201);
    assert.ok(res.body.token && res.body.refreshToken, 'la sesión se devuelve como siempre');
    assert.deepEqual(res.body.user, {
      nombre: 'Carla',
      email: 'carla@example.com',
      rol: 'cliente',
      email_verificado: false,
      email_pendiente: null
    });
    assert.equal(espias.bienvenida.mock.callCount(), 0, 'no se mandan dos correos');
    assert.equal(espias.registro.mock.callCount(), 1);
    const { email: para, nombre, url } = espias.registro.mock.calls[0].arguments[0];
    assert.equal(para, 'carla@example.com');
    assert.equal(nombre, 'Carla');
    assert.match(url, /^https:\/\/tienda\.example\.com\/verificar-email\?token=[A-Za-z0-9_-]{43}$/);
  });

  test('espera a que salga el correo antes de responder (en Vercel, uno pendiente podría perderse)', async () => {
    let enviado = false;
    espias.registro.mock.mockImplementation(async () => {
      await new Promise((resolver) => setImmediate(resolver));
      enviado = true;
    });

    const res = await registrar();

    assert.equal(res.status, 201);
    assert.equal(enviado, true);
  });

  test('el enlace se guarda solo como HMAC, para el email de la cuenta, y caduca a las 24 horas', async () => {
    await registrar();
    const token = tokenDeUrl(espias.registro.mock.calls[0].arguments[0].url);
    const [fila] = fake.tablas.verificaciones_email;

    assert.equal(fila.token_hash, hmac(token));
    assert.ok(
      !Object.values(fila).some((v) => String(v).includes(token)),
      'el token en claro no se guarda'
    );
    assert.equal(fila.email, 'carla@example.com');
    assert.equal(fila.motivo, 'registro');
    assert.equal(fila.cliente_id, fake.tablas.clientes[0].id);
    const horas = (new Date(fila.expira_en) - Date.now()) / 3600000;
    assert.ok(horas > 23.99 && horas <= 24, `caduca a las 24 horas (${horas})`);
  });

  test('sin EMAIL_TOKEN_HASH_SECRET la cuenta se crea igual (sin verificar) y queda en el log', async () => {
    const secreto = process.env.EMAIL_TOKEN_HASH_SECRET;
    delete process.env.EMAIL_TOKEN_HASH_SECRET;
    try {
      const res = await registrar();
      assert.equal(res.status, 201);
      assert.equal(espias.registro.mock.callCount(), 0);
      assert.ok(
        errores.mock.calls.some((c) => String(c.arguments[1]).includes('EMAIL_TOKEN_HASH_SECRET'))
      );
    } finally {
      process.env.EMAIL_TOKEN_HASH_SECRET = secreto;
    }
  });

  test('sin CLIENT_URL válida, el enlace apunta a la web pública', async () => {
    const antes = process.env.CLIENT_URL;
    process.env.CLIENT_URL = '';
    try {
      await registrar();
      assert.match(
        espias.registro.mock.calls[0].arguments[0].url,
        /^https:\/\/nave5barcelona\.com\/verificar-email\?token=/
      );
    } finally {
      process.env.CLIENT_URL = antes;
    }
  });
});

describe('POST /api/auth/verificar-email', () => {
  const ANA = cuenta('cli-ana', 'ana@example.com', { nombre: 'Ana' });

  test('confirma la cuenta, manda el correo de cuenta activada y devuelve el usuario actualizado', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const token = await enlaceDe(ANA);

    const res = await verificar(token);

    assert.equal(res.status, 200);
    assert.equal(res.body.motivo, 'registro');
    assert.equal(res.body.sesionCerrada, false);
    assert.equal(res.body.user.email_verificado, true);
    const guardada = fake.tablas.clientes[0];
    assert.equal(guardada.email_verificado, true);
    assert.ok(guardada.email_verificado_en);
    assert.equal(espias.activada.mock.callCount(), 1);
    assert.deepEqual(espias.activada.mock.calls[0].arguments[0], {
      email: 'ana@example.com',
      nombre: 'Ana'
    });
    assert.ok(fake.tablas.verificaciones_email[0].usado_en, 'el enlace queda gastado');
  });

  test('asocia los pedidos de invitado de ese email al verificar, y no antes', async () => {
    instalar({
      clientes: [{ ...ANA }],
      pedidos: [
        pedido('invitado-1', 'ana@example.com'),
        pedido('invitado-2', 'ANA@Example.com'),
        pedido('de-otra-cuenta', 'ana@example.com', { cliente_id: 'cli-otra' }),
        pedido('otro-email', 'bea@example.com'),
        pedido('comodin', 'anb@example.com')
      ]
    });
    const token = await enlaceDe(ANA);
    assert.ok(
      fake.tablas.pedidos.every((p) => p.cliente_id !== 'cli-ana'),
      'antes, ninguno'
    );

    await verificar(token);

    const deAna = fake.tablas.pedidos.filter((p) => p.cliente_id === 'cli-ana').map((p) => p.id);
    assert.deepEqual(deAna.sort(), ['invitado-1', 'invitado-2']);
    assert.equal(fake.tablas.pedidos.find((p) => p.id === 'de-otra-cuenta').cliente_id, 'cli-otra');
  });

  test('un "_" en el email no hace de comodín al asociar pedidos (H17)', async () => {
    const juan = cuenta('cli-juan', 'juan_perez@example.com');
    instalar({
      clientes: [{ ...juan }],
      pedidos: [
        pedido('ajeno', 'juan.perez@example.com'),
        pedido('propio', 'juan_perez@example.com')
      ]
    });

    await verificar(await enlaceDe(juan));

    assert.equal(fake.tablas.pedidos.find((p) => p.id === 'ajeno').cliente_id, null);
    assert.equal(fake.tablas.pedidos.find((p) => p.id === 'propio').cliente_id, 'cli-juan');
  });

  test('si falla asociar los pedidos, la cuenta queda verificada igual y se registra', async () => {
    instalar({ clientes: [{ ...ANA }], fallos: { 'pedidos.update': { message: 'caída' } } });

    const res = await verificar(await enlaceDe(ANA));

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.clientes[0].email_verificado, true);
    assert.ok(
      errores.mock.calls.some((c) => String(c.arguments[0]).includes('pedidos de invitado'))
    );
  });

  test('un enlace inventado, uno ya usado y uno caducado dan exactamente la misma respuesta', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const usado = await enlaceDe(ANA);
    assert.equal((await verificar(usado)).status, 200);

    const caducado = 'token-caducado-de-prueba';
    fake.tablas.verificaciones_email.push({
      id: 'v-caducado',
      cliente_id: 'cli-ana',
      email: 'ana@example.com',
      motivo: 'registro',
      token_hash: hmac(caducado),
      expira_en: new Date(Date.now() - 1000).toISOString(),
      usado_en: null
    });

    const respuestas = await Promise.all([
      verificar('token-inventado'),
      verificar(usado),
      verificar(caducado)
    ]);

    for (const res of respuestas) {
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, ENLACE_NO_VALIDO);
    }
    assert.equal(espias.activada.mock.callCount(), 1, 'solo la primera confirmación');
  });

  test('dos confirmaciones a la vez: solo una gana y no se repite nada', async () => {
    instalar({ clientes: [{ ...ANA }], pedidos: [pedido('invitado', 'ana@example.com')] });
    const token = await enlaceDe(ANA);

    const [a, b] = await Promise.all([verificar(token), verificar(token)]);

    assert.deepEqual([a.status, b.status].sort(), [200, 400]);
    assert.deepEqual((a.status === 400 ? a : b).body, ENLACE_NO_VALIDO);
    assert.equal(espias.activada.mock.callCount(), 1);
    const actualizaciones = fake.escrituras.filter(
      (e) => e.tabla === 'clientes' && e.accion === 'update'
    );
    assert.equal(actualizaciones.length, 1, 'la cuenta se actualiza una sola vez');
  });

  test('un enlace de registro deja de valer si el email de la cuenta ha cambiado desde entonces', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const token = await enlaceDe(ANA);
    fake.tablas.clientes[0].email = 'ana.otra@example.com';

    const res = await verificar(token);

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, ENLACE_NO_VALIDO);
    assert.notEqual(fake.tablas.clientes[0].email_verificado, true);
  });

  test('un enlace de una cuenta que ya no existe: la misma respuesta genérica', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const token = await enlaceDe(ANA);
    fake.tablas.clientes.length = 0;

    const res = await verificar(token);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, ENLACE_NO_VALIDO);
  });

  test('sin token en el cuerpo, 400 de validación', async () => {
    const res = await request(app).post('/api/auth/verificar-email').send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Falta el enlace de verificación.');
  });

  test('sin EMAIL_TOKEN_HASH_SECRET, 503 sin detalles', async () => {
    const secreto = process.env.EMAIL_TOKEN_HASH_SECRET;
    delete process.env.EMAIL_TOKEN_HASH_SECRET;
    try {
      const res = await verificar('cualquiera');
      assert.equal(res.status, 503);
      assert.equal(
        res.body.error,
        'No se puede confirmar el email ahora mismo. Inténtalo de nuevo en unos minutos.'
      );
    } finally {
      process.env.EMAIL_TOKEN_HASH_SECRET = secreto;
    }
  });

  test('si falla la base de datos, 500 genérico', async () => {
    instalar({ fallos: { 'verificaciones_email.select': { message: 'caída' } } });
    const res = await verificar('cualquiera');
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /caída/);
  });
});

describe('POST /api/auth/reenviar-verificacion', () => {
  test('sin sesión, 401', async () => {
    const res = await request(app).post('/api/auth/reenviar-verificacion');
    assert.equal(res.status, 401);
  });

  test('manda otro enlace y el anterior deja de valer', async () => {
    const bea = cuenta('cli-bea', 'bea@example.com');
    instalar({ clientes: [{ ...bea }] });
    const viejo = await enlaceDe(bea);

    const res = await reenviar(tokenDe(bea));

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Te hemos enviado otro correo.');
    const nuevo = tokenDeUrl(espias.registro.mock.calls[0].arguments[0].url);
    assert.equal((await verificar(viejo)).status, 400);
    assert.equal((await verificar(nuevo)).status, 200);
  });

  test('con un token sin `sub` (de antes de H28), busca la cuenta por el email', async () => {
    const bea = cuenta('cli-bea2', 'bea2@example.com');
    instalar({ clientes: [{ ...bea }] });

    const res = await reenviar(tokenDe(bea, { sinSub: true }));
    assert.equal(res.status, 200);
  });

  test('con un cambio de email a medias, manda otro enlace al email pendiente', async () => {
    const cris = cuenta('cli-cris', 'cris@example.com', {
      email_verificado: true,
      email_pendiente: 'cris.nueva@example.com'
    });
    instalar({ clientes: [{ ...cris }] });

    const res = await reenviar(tokenDe(cris));

    assert.equal(res.status, 200);
    assert.equal(espias.cambio.mock.calls[0].arguments[0].email, 'cris.nueva@example.com');
    assert.equal(fake.tablas.verificaciones_email[0].motivo, 'cambio_email');
  });

  test('sin verificar y con un cambio de email a medias, pedir otro enlace de registro no anula el del cambio', async () => {
    const dani = cuenta('cli-dani', 'dani@example.com');
    instalar({ clientes: [{ ...dani }] });
    await request(app)
      .post('/api/auth/perfil-update')
      .set('Authorization', `Bearer ${tokenDe(dani)}`)
      .send({ passwordActual: PASSWORD, nuevoEmail: 'dani.nueva@example.com' });
    const delCambio = tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url);

    const res = await reenviar(tokenDe(dani));

    assert.equal(res.status, 200);
    assert.equal(espias.registro.mock.calls[0].arguments[0].email, 'dani@example.com');
    const confirmado = await verificar(delCambio);
    assert.equal(confirmado.status, 200);
    assert.equal(fake.tablas.clientes[0].email, 'dani.nueva@example.com');
  });

  test('una cuenta ya verificada y sin cambios pendientes: 400', async () => {
    const dani = cuenta('cli-dani', 'dani@example.com', { email_verificado: true });
    instalar({ clientes: [{ ...dani }] });

    const res = await reenviar(tokenDe(dani));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Tu email ya está confirmado.');
  });

  test('una cuenta que ya no existe: 404', async () => {
    const res = await reenviar(tokenDe({ id: 'cli-borrada', email: 'borrada@example.com' }));
    assert.equal(res.status, 404);
  });

  test('si no se puede crear el enlace, 503', async () => {
    const eva = cuenta('cli-eva', 'eva@example.com');
    instalar({
      clientes: [{ ...eva }],
      fallos: { 'verificaciones_email.insert': { message: 'x' } }
    });

    const res = await reenviar(tokenDe(eva));
    assert.equal(res.status, 503);
  });

  test('si falla leer la cuenta, 500 genérico', async () => {
    instalar({ fallos: { 'clientes.select': { message: 'caída' } } });
    const res = await reenviar(tokenDe({ id: 'cli-fran', email: 'fran@example.com' }));
    assert.equal(res.status, 500);
  });

  test('como mucho 3 cada hora por cuenta: el cuarto da 429', async () => {
    const gala = cuenta('cli-gala', 'gala@example.com');
    instalar({ clientes: [{ ...gala }] });
    const sesion = tokenDe(gala);

    for (let i = 1; i <= 3; i++) assert.equal((await reenviar(sesion)).status, 200);
    const cuarto = await reenviar(sesion);

    assert.equal(cuarto.status, 429);
    assert.equal(
      cuarto.body.error,
      'Ya te hemos enviado varios correos. Espera un rato antes de pedir otro.'
    );
    assert.equal(espias.registro.mock.callCount(), 3);
  });
});

describe('Mis pedidos de punta a punta', () => {
  test('sin verificar, 403; tras confirmar, ve sus compras de invitado', async () => {
    const ana = cuenta('cli-ana', 'ana@example.com');
    instalar({ clientes: [{ ...ana }], pedidos: [pedido('invitado', 'ana@example.com')] });
    const sesion = tokenDe(ana);

    const antes = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${sesion}`);
    assert.equal(antes.status, 403);

    await verificar(await enlaceDe(ana));

    const despues = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${sesion}`);
    assert.equal(despues.status, 200);
    assert.deepEqual(
      despues.body.map((p) => p.id),
      ['invitado']
    );
  });
});

describe('login y refresh devuelven si el email está verificado', () => {
  test('login', async () => {
    instalar({ clientes: [cuenta('cli-ana', 'ana@example.com', { email_verificado: true })] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: PASSWORD });
    assert.equal(res.body.user.email_verificado, true);
    assert.equal(res.body.user.email_pendiente, null);
    assert.equal('password' in res.body.user, false);
  });

  test('refresh: trae el usuario tal como está ahora (p. ej. verificado desde otro dispositivo)', async () => {
    const ana = cuenta('cli-ana', 'ana@example.com');
    instalar({ clientes: [{ ...ana }] });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: PASSWORD });
    assert.equal(login.body.user.email_verificado, false);

    await verificar(await enlaceDe(ana));
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email_verificado, true);
  });
});

describe('Google', () => {
  const entrarConGoogle = (correo, nombre = 'Persona') => {
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({
      getPayload: () => ({ email: correo, email_verified: true, name: nombre })
    }));
    return request(app).post('/api/auth/google').send({ credential: 'credencial' });
  };

  test('una cuenta nueva nace verificada', async () => {
    const res = await entrarConGoogle('nueva@example.com');

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email_verificado, true);
    const creada = fake.tablas.clientes[0];
    assert.equal(creada.email_verificado, true);
    assert.ok(creada.email_verificado_en);
    assert.equal(espias.protegida.mock.callCount(), 0);
  });

  test('una cuenta sin verificar con ese email se protege: verificada, contraseña anulada, sesiones cerradas y aviso', async () => {
    const ajena = cuenta('cli-ajena', 'victima@example.com', { nombre: 'Víctima' });
    instalar({ clientes: [{ ...ajena }], pedidos: [pedido('invitado', 'victima@example.com')] });
    const deQuienLaCreo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'victima@example.com', password: PASSWORD });
    assert.equal(deQuienLaCreo.status, 200);

    const res = await entrarConGoogle('victima@example.com');

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email_verificado, true);
    const guardada = fake.tablas.clientes[0];
    assert.equal(guardada.email_verificado, true);
    assert.equal(await bcrypt.compare(PASSWORD, guardada.password), false, 'contraseña anulada');
    const activas = fake.tablas.refresh_tokens.filter(
      (f) => f.user_id === 'cli-ajena' && f.revoked_at == null
    );
    assert.equal(activas.length, 1, 'solo queda la sesión nueva de Google');
    const refrescar = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: deQuienLaCreo.body.refreshToken });
    assert.equal(refrescar.status, 401, 'quien la creó se queda fuera');
    const sinLaVieja = await request(app)
      .post('/api/auth/login')
      .send({ email: 'victima@example.com', password: PASSWORD });
    assert.equal(sinLaVieja.status, 401, 'la contraseña de antes ya no sirve');
    assert.deepEqual(espias.protegida.mock.calls[0].arguments[0], {
      email: 'victima@example.com',
      nombre: 'Víctima'
    });
    assert.equal(fake.tablas.pedidos[0].cliente_id, 'cli-ajena');
  });

  test('una cuenta ya verificada entra sin más: ni se toca la contraseña ni se cierran sesiones', async () => {
    const hugo = cuenta('cli-hugo', 'hugo@example.com', { email_verificado: true });
    instalar({ clientes: [{ ...hugo }] });

    const res = await entrarConGoogle('hugo@example.com');

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.clientes[0].password, HASH);
    assert.equal(espias.protegida.mock.callCount(), 0);
  });
});

describe('cambio de email (opción C)', () => {
  const ANA = cuenta('cli-ana', 'ana@example.com', { nombre: 'Ana', email_verificado: true });
  const cambiar = (cuerpo, sesion = tokenDe(ANA)) =>
    request(app)
      .post('/api/auth/perfil-update')
      .set('Authorization', `Bearer ${sesion}`)
      .send(cuerpo);

  test('no se aplica al pedirlo: queda pendiente, enlace al nuevo y aviso al antiguo', async () => {
    instalar({ clientes: [{ ...ANA }] });

    const res = await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });

    assert.equal(res.status, 200);
    assert.equal(
      res.body.message,
      'Te hemos enviado un enlace a ana.nueva@example.com. Hasta que lo confirmes, tu cuenta sigue con ana@example.com.'
    );
    assert.equal(res.body.user.email, 'ana@example.com');
    assert.equal(res.body.user.email_pendiente, 'ana.nueva@example.com');
    assert.equal(jwt.decode(res.body.token).email, 'ana@example.com');
    assert.equal(fake.tablas.clientes[0].email, 'ana@example.com');
    assert.equal(fake.tablas.clientes[0].email_pendiente, 'ana.nueva@example.com');

    const enlace = espias.cambio.mock.calls[0].arguments[0];
    assert.equal(enlace.email, 'ana.nueva@example.com');
    assert.equal(fake.tablas.verificaciones_email[0].motivo, 'cambio_email');
    assert.deepEqual(espias.aviso.mock.calls[0].arguments[0], {
      email: 'ana@example.com',
      nombre: 'Ana',
      emailNuevo: 'ana.nueva@example.com'
    });
  });

  test('al confirmar el enlace, el email cambia, se vacía el pendiente y los pedidos del nuevo se asocian', async () => {
    instalar({
      clientes: [{ ...ANA }],
      pedidos: [pedido('invitado-nuevo', 'ana.nueva@example.com')]
    });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
    const token = tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url);

    const res = await verificar(token);

    assert.equal(res.status, 200);
    assert.equal(res.body.motivo, 'cambio_email');
    assert.equal(res.body.user.email, 'ana.nueva@example.com');
    assert.equal(res.body.user.email_pendiente, null);
    assert.equal(fake.tablas.clientes[0].email, 'ana.nueva@example.com');
    assert.equal(fake.tablas.pedidos[0].cliente_id, 'cli-ana');
    assert.equal(espias.activada.mock.callCount(), 0, 'el de cuenta activada es solo del registro');
  });

  test('confirmar el nuevo email también verifica una cuenta que no lo estaba', async () => {
    const sinVerificar = { ...ANA, email_verificado: false };
    instalar({ clientes: [sinVerificar] });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });

    await verificar(tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url));
    assert.equal(fake.tablas.clientes[0].email_verificado, true);
  });

  test('un email ya registrado por otra cuenta se rechaza al pedirlo', async () => {
    instalar({ clientes: [{ ...ANA }, cuenta('cli-bea', 'bea@example.com')] });

    const res = await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'bea@example.com' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El nuevo correo electrónico ya está en uso.');
    assert.equal(fake.tablas.verificaciones_email.length, 0);
  });

  test('si otra cuenta registra el email mientras tanto, la confirmación se rechaza (409)', async () => {
    instalar({ clientes: [{ ...ANA }] });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
    fake.tablas.clientes.push(cuenta('cli-intrusa', 'ana.nueva@example.com'));

    const res = await verificar(tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url));

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'Ese correo electrónico ya está en uso.');
    assert.equal(fake.tablas.clientes[0].email, 'ana@example.com');
    // El cambio se anula: "Enviar otro" ya no manda enlaces a la dirección de la otra cuenta.
    assert.equal(fake.tablas.clientes[0].email_pendiente, null);
    const otro = await request(app)
      .post('/api/auth/reenviar-verificacion')
      .set('Authorization', `Bearer ${tokenDe(ANA)}`);
    assert.equal(otro.status, 400);
    assert.equal(espias.cambio.mock.callCount(), 1);
  });

  test('si falla anular el cambio tras el 409, responde igual y queda en el log', async () => {
    const fallos = {};
    instalar({ clientes: [{ ...ANA }], fallos });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
    fake.tablas.clientes.push(cuenta('cli-intrusa', 'ana.nueva@example.com'));
    fallos['clientes.update'] = { message: 'caída' };

    const res = await verificar(tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url));

    assert.equal(res.status, 409);
    assert.ok(errores.mock.calls.some((c) => String(c.arguments[0]).includes('no se pudo anular')));
  });

  test('con un token de antes de confirmar un cambio, edita su cuenta (por el id), no la que ahora tiene ese email', async () => {
    // Ana ya cambió a ana.nueva@; Bea se registró después con el email viejo de Ana. El token de
    // Ana (vale 1 hora) aún lleva el email viejo.
    const anaYaCambiada = { ...ANA, email: 'ana.nueva@example.com' };
    const bea = cuenta('cli-bea', 'ana@example.com', { nombre: 'Bea' });
    instalar({ clientes: [anaYaCambiada, { ...bea }] });

    const res = await cambiar({ nuevoNombre: 'Ana B' }, tokenDe(ANA));

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'ana.nueva@example.com');
    assert.equal(jwt.decode(res.body.token).sub, 'cli-ana');
    assert.equal(fake.tablas.clientes[0].nombre, 'Ana B');
    assert.equal(fake.tablas.clientes[1].nombre, 'Bea', 'la cuenta de Bea no se toca');
  });

  test('si la cuenta de la sesión ya no existe, 404', async () => {
    instalar({ clientes: [] });

    // Otro id: los fallos de perfil-update cuentan para el límite de intentos de cada cuenta (H28).
    const res = await cambiar(
      { nuevoNombre: 'Nadie' },
      tokenDe({ id: 'cli-borrada', email: 'borrada@example.com' })
    );

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'El usuario no existe.');
  });

  test('si después se pide otro cambio, el enlace del primero ya no vale', async () => {
    instalar({ clientes: [{ ...ANA }] });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'primera@example.com' });
    const primero = tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url);
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'segunda@example.com' });

    const res = await verificar(primero);

    assert.equal(res.status, 400);
    assert.equal(fake.tablas.clientes[0].email, 'ana@example.com');
  });

  test('un enlace de cambio cuyo pendiente ya no coincide (p. ej. se guardó otro) no vale', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const token = await enlaceDe(ANA, 'cambio_email', 'otra@example.com');

    const res = await verificar(token);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, ENLACE_NO_VALIDO);
  });

  test('sin EMAIL_TOKEN_HASH_SECRET, 503 y no se guarda nada pendiente', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const secreto = process.env.EMAIL_TOKEN_HASH_SECRET;
    delete process.env.EMAIL_TOKEN_HASH_SECRET;
    try {
      const res = await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
      assert.equal(res.status, 503);
      assert.equal(
        res.body.error,
        'No se puede cambiar el email ahora mismo. Inténtalo de nuevo más tarde.'
      );
      assert.equal(fake.tablas.clientes[0].email_pendiente, null);
    } finally {
      process.env.EMAIL_TOKEN_HASH_SECRET = secreto;
    }
  });

  test('si falla crear el enlace, 500 y no se guarda nada pendiente', async () => {
    instalar({
      clientes: [{ ...ANA }],
      fallos: { 'verificaciones_email.insert': { message: 'x' } }
    });

    const res = await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });

    assert.equal(res.status, 500);
    assert.equal(fake.tablas.clientes[0].email_pendiente, null);
  });

  test('cambiar el email y la contraseña a la vez: la contraseña se aplica ya (con sesión nueva), el email queda pendiente', async () => {
    instalar({ clientes: [{ ...ANA }] });

    const res = await cambiar({
      passwordActual: PASSWORD,
      nuevoEmail: 'ana.nueva@example.com',
      nuevaPassword: 'otra-contraseña'
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.refreshToken);
    assert.equal(fake.tablas.clientes[0].email, 'ana@example.com');
    assert.equal(await bcrypt.compare('otra-contraseña', fake.tablas.clientes[0].password), true);
  });
});

describe('utils/verificacionEmail', () => {
  test('crear rechaza un motivo desconocido', async () => {
    await assert.rejects(
      verificacionEmail.crear({ clienteId: 'c', email: 'a@b.c', motivo: 'otro' }),
      /Motivo de verificación desconocido/
    );
  });

  test('si falla borrar los enlaces anteriores, crear lanza', async () => {
    instalar({ fallos: { 'verificaciones_email.delete': { message: 'caída' } } });
    await assert.rejects(
      verificacionEmail.crear({ clienteId: 'c', email: 'a@b.c', motivo: 'registro' })
    );
  });

  test('si falla gastar el enlace, consumir lanza', async () => {
    const token = await verificacionEmail.crear({
      clienteId: 'c',
      email: 'a@b.c',
      motivo: 'registro'
    });
    fake.fallos['verificaciones_email.update'] = { message: 'caída' };
    await assert.rejects(verificacionEmail.consumir(token));
  });
});
