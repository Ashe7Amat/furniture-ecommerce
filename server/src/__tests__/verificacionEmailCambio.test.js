// H18: el cambio de email (opción C; docs/verificacion-email-diseno.md, parte 6, punto 5) y lo que
// lo protege. Mismo método que verificacionEmail.test.js: la app Express real (supertest) contra el
// doble en memoria de Supabase, con los correos sustituidos por espías. Va en su propio archivo
// para que el límite de intentos por IP empiece de cero (helpers/verificacionEmailComun.js).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
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
const {
  PASSWORD,
  ENLACE_NO_VALIDO,
  cuenta,
  pedido,
  tokenDe,
  tokenDeUrl,
  correoLento
} = require('./helpers/verificacionEmailComun');

const verificar = (token) => request(app).post('/api/auth/verificar-email').send({ token });

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
    assert.equal(res.body.error, 'Ese correo electrónico ya está en uso.');
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

  test('espera a que salgan los dos correos (enlace al nuevo y aviso al antiguo) antes de responder', async () => {
    instalar({ clientes: [{ ...ANA }] });
    const correos = {};
    espias.cambio.mock.mockImplementation(correoLento(correos));
    espias.aviso.mock.mockImplementation(correoLento(correos));

    const res = await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });

    assert.equal(res.status, 200);
    assert.equal(correos.enviados, 2);
  });

  test('el 409 solo anula el pendiente de esa cuenta, no el de otra que pidió la misma dirección', async () => {
    const otra = cuenta('cli-otra', 'otra@example.com', {
      email_verificado: true,
      email_pendiente: 'ana.nueva@example.com'
    });
    instalar({ clientes: [{ ...ANA }, otra] });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
    fake.tablas.clientes.push(cuenta('cli-intrusa', 'ana.nueva@example.com'));

    const res = await verificar(tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url));

    assert.equal(res.status, 409);
    assert.equal(fake.tablas.clientes[0].email_pendiente, null);
    assert.equal(fake.tablas.clientes[1].email_pendiente, 'ana.nueva@example.com');
  });

  test('el 409 no anula un cambio más nuevo pedido mientras tanto', async () => {
    const fallos = {};
    instalar({ clientes: [{ ...ANA }], fallos });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
    fake.tablas.clientes.push(cuenta('cli-intrusa', 'ana.nueva@example.com'));
    // Ana pide otro cambio justo después de que se lea su cuenta y antes de anular el pendiente:
    // la segunda lectura de clientes es la de "¿está ocupado ese correo?".
    let lecturas = 0;
    fallos['clientes.select'] = () => {
      lecturas += 1;
      if (lecturas === 2) fake.tablas.clientes[0].email_pendiente = 'ana.otra@example.com';
      return null;
    };

    const res = await verificar(tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url));

    assert.equal(res.status, 409);
    assert.equal(lecturas, 2);
    assert.equal(fake.tablas.clientes[0].email_pendiente, 'ana.otra@example.com');
  });

  test('con un token de antes de confirmar un cambio, el aviso de otro cambio va a su email actual', async () => {
    // Ana ya es ana.nueva@ y Bea se registró después con ana@. El token de Ana aún lleva ana@.
    const anaYaCambiada = { ...ANA, email: 'ana.nueva@example.com' };
    const bea = cuenta('cli-bea', 'ana@example.com', { nombre: 'Bea' });
    instalar({ clientes: [anaYaCambiada, bea] });

    const res = await cambiar(
      { passwordActual: PASSWORD, nuevoEmail: 'ana.tercera@example.com' },
      tokenDe(ANA)
    );

    assert.equal(res.status, 200);
    assert.equal(espias.aviso.mock.calls[0].arguments[0].email, 'ana.nueva@example.com');
    assert.match(res.body.message, /tu cuenta sigue con ana\.nueva@example\.com\.$/);
    assert.equal(fake.tablas.clientes[0].email_pendiente, 'ana.tercera@example.com');
    assert.equal(fake.tablas.clientes[1].email_pendiente, null, 'la cuenta de Bea no se toca');
  });

  test('con un token sin `sub` (de antes de H28), busca la cuenta por el email', async () => {
    instalar({ clientes: [{ ...ANA }] });

    const res = await cambiar({ nuevoNombre: 'Ana B' }, tokenDe(ANA, { sinSub: true }));

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.clientes[0].nombre, 'Ana B');
  });

  test('si falla leer la cuenta, 500 genérico', async () => {
    instalar({ clientes: [{ ...ANA }], fallos: { 'clientes.select': { message: 'caída' } } });

    const res = await cambiar({ nuevoNombre: 'Ana B' });

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'No se pudo actualizar la información de la cuenta.');
  });

  test('pedir un cambio de email no anula el enlace de registro de una cuenta sin verificar', async () => {
    const sinVerificar = { ...ANA, email_verificado: false };
    instalar({ clientes: [sinVerificar] });
    const deRegistro = await enlaceDe(sinVerificar);

    const res = await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'ana.nueva@example.com' });
    assert.equal(res.status, 200);

    assert.equal((await verificar(deRegistro)).status, 200);
    assert.equal(fake.tablas.clientes[0].email_verificado, true);
    assert.equal(fake.tablas.clientes[0].email, 'ana@example.com');
  });

  test('cambiar solo la contraseña anula el cambio de email pendiente (lo que dice el aviso al antiguo)', async () => {
    instalar({ clientes: [{ ...ANA }] });
    await cambiar({ passwordActual: PASSWORD, nuevoEmail: 'intruso@example.com' });
    const delIntruso = tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url);

    const res = await cambiar({ passwordActual: PASSWORD, nuevaPassword: 'otra-contraseña' });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email_pendiente, null);
    assert.equal(fake.tablas.clientes[0].email_pendiente, null);
    assert.deepEqual((await verificar(delIntruso)).body, ENLACE_NO_VALIDO);
    assert.equal(fake.tablas.clientes[0].email, 'ana@example.com');
  });
});

describe('Google protege una cuenta con un cambio de email pedido por quien la creó', () => {
  test('el cambio pendiente se anula: su enlace ya no vale y no puede pedir otro', async () => {
    // Alguien registra con contraseña el email de la víctima y pide cambiarlo a una dirección suya.
    const ajena = cuenta('cli-ajena', 'victima@example.com');
    instalar({ clientes: [ajena], pedidos: [pedido('invitado', 'victima@example.com')] });
    const deQuienLaCreo = tokenDe(ajena);
    const cambio = await request(app)
      .post('/api/auth/perfil-update')
      .set('Authorization', `Bearer ${deQuienLaCreo}`)
      .send({ passwordActual: PASSWORD, nuevoEmail: 'atacante@example.com' });
    assert.equal(cambio.status, 200);
    const delAtacante = tokenDeUrl(espias.cambio.mock.calls[0].arguments[0].url);

    // La víctima entra con Google: la cuenta queda protegida y recibe sus pedidos de invitado.
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({
      getPayload: () => ({ email: 'victima@example.com', email_verified: true, name: 'Víctima' })
    }));
    const google = await request(app).post('/api/auth/google').send({ credential: 'credencial' });
    assert.equal(google.status, 200);
    assert.equal(google.body.user.email_pendiente, null);
    assert.equal(fake.tablas.clientes[0].email_pendiente, null);
    assert.equal(fake.tablas.pedidos[0].cliente_id, 'cli-ajena');

    assert.deepEqual((await verificar(delAtacante)).body, ENLACE_NO_VALIDO);
    const otro = await request(app)
      .post('/api/auth/reenviar-verificacion')
      .set('Authorization', `Bearer ${deQuienLaCreo}`);
    assert.equal(otro.status, 400);
    assert.equal(espias.cambio.mock.callCount(), 1);
    assert.equal(fake.tablas.clientes[0].email, 'victima@example.com');
  });
});
