// POST /api/reservas/:id/retomar-pago (utils/reservas.js retomarPagoDeReserva): la página de pago de una
// reserva provisional que sigue abierta, para la clienta que cerró Stripe sin pagar. Con el doble de
// Supabase y un Stripe de mentira que recuerda el estado de cada sesión.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
// Cada petición desde una IP distinta, para que el límite por IP no se mezcle con lo demás.
process.env.VERCEL = '1';

const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');
const { MENSAJE_ALQUILER_CERRADO } = require('../controllers/reservasController');
const {
  MENSAJE_REINTENTAR_PAGO,
  MENSAJE_PLAZO_DE_PAGO_TERMINADO,
  MENSAJE_PAGO_YA_RECIBIDO
} = require('../utils/reservas');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);

const ANA = '00000000-0000-4000-8000-0000000000a1';
const BEA = '00000000-0000-4000-8000-0000000000b2';
const SIN_VERIFICAR = '00000000-0000-4000-8000-0000000000c3';
const SILLA = '00000000-0000-4000-8000-000000000001';
const R1 = '10000000-0000-4000-8000-000000000001';
const R2 = '10000000-0000-4000-8000-000000000002';

const token = (sub, correo) =>
  jwt.sign({ sub, email: correo, nombre: 'Cliente', rol: 'cliente' }, process.env.JWT_SECRET);
const TOKEN_ANA = token(ANA, 'ana@ejemplo.com');

let ip = 0;
const retomar = (id, { tk = TOKEN_ANA, desde } = {}) => {
  ip += 1;
  const peticion = request(app)
    .post(`/api/reservas/${id}/retomar-pago`)
    .set('X-Forwarded-For', desde || `10.4.${Math.floor(ip / 250)}.${(ip % 250) + 1}`);
  return tk ? peticion.set('Authorization', `Bearer ${tk}`) : peticion;
};

const enMinutos = (n) => new Date(Date.now() + n * 60_000).toISOString();

// Una reserva provisional de Ana, con su sesión de pago.
const provisional = (cambios = {}) => ({
  id: R1,
  mueble_id: SILLA,
  tipo: 'alquiler',
  estado: 'pendiente',
  fecha_inicio: dia(10),
  fecha_fin: dia(13),
  fin_ocupacion: dia(13),
  dias_margen: 2,
  cliente_id: ANA,
  expira_en: enMinutos(20),
  stripe_session_id: 'cs_1',
  ...cambios
});

let fake;
let stripe;
let sesiones;
const instalar = ({ reservas = [provisional()] } = {}) => {
  fake = crearFakeSupabase({
    clientes: [
      { id: ANA, email: 'ana@ejemplo.com', email_verificado: true },
      { id: BEA, email: 'bea@ejemplo.com', email_verificado: true },
      { id: SIN_VERIFICAR, email: 'nadie@ejemplo.com', email_verificado: false }
    ],
    muebles: [{ id: SILLA, nombre: 'Silla Thonet', estado: 'disponible' }],
    reservas
  });
  mock.method(supabase, 'from', fake.from);
};

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  sesiones = new Map([['cs_1', { status: 'open', url: 'https://checkout.stripe.com/c/pay/cs_1' }]]);
  stripe = {
    checkout: {
      sessions: {
        retrieve: mock.fn(async (id) => {
          const sesion = sesiones.get(id);
          if (!sesion) throw new Error('No such checkout.session');
          return { id, ...sesion };
        })
      }
    }
  };
  mock.method(stripeUtil, 'getStripe', () => stripe);
  mock.method(console, 'error', () => {});
  instalar();
});

afterEach(() => {
  mock.restoreAll();
  process.env.MOSTRAR_PRECIOS = 'true';
  delete process.env.RESERVAS_ACTIVAS;
});

describe('acceso', () => {
  test('con RESERVAS_ACTIVAS apagado: 403 sin mirar nada', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const res = await retomar(R1, { tk: null });
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: MENSAJE_ALQUILER_CERRADO });
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 0);
  });

  test('con los precios ocultos tampoco', async () => {
    process.env.MOSTRAR_PRECIOS = 'false';
    const res = await retomar(R1);
    assert.equal(res.status, 403);
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 0);
  });

  test('sin sesión, 401; sin el email verificado, 403 con su código', async () => {
    assert.equal((await retomar(R1, { tk: null })).status, 401);
    const res = await retomar(R1, { tk: token(SIN_VERIFICAR, 'nadie@ejemplo.com') });
    assert.equal(res.status, 403);
    assert.equal(res.body.codigo, 'email_no_verificado');
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 0);
  });

  test('un id que no es un uuid es 404 sin tocar la base de datos', async () => {
    const res = await retomar('no-es-un-uuid');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'No encontramos esa reserva.' });
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 0);
  });

  test('sin Stripe configurado, 503', async () => {
    mock.method(stripeUtil, 'getStripe', () => null);
    assert.equal((await retomar(R1)).status, 503);
  });
});

describe('retomar el pago', () => {
  test('con la sesión abierta devuelve su página de pago, sin escribir nada', async () => {
    const res = await retomar(R1);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { url: 'https://checkout.stripe.com/c/pay/cs_1' });
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 1);
    assert.equal(stripe.checkout.sessions.retrieve.mock.calls[0].arguments[0], 'cs_1');
    assert.equal(fake.escrituras.length, 0);
  });

  test('la de otra clienta es como si no existiera: 404, sin preguntar a Stripe', async () => {
    instalar({ reservas: [provisional({ cliente_id: BEA })] });
    const res = await retomar(R1);
    assert.equal(res.status, 404);
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 0);
  });

  test('una que no existe, o que no es un alquiler, 404', async () => {
    assert.equal((await retomar(R2)).status, 404);
    instalar({ reservas: [provisional({ tipo: 'venta' })] });
    assert.equal((await retomar(R1)).status, 404);
  });

  test('una reserva que ya no está pendiente, o cuyo plazo pasó, o sin sesión: 409 que pide elegir otra vez', async () => {
    for (const cambios of [
      { estado: 'confirmada' },
      { estado: 'expirada' },
      { estado: 'cancelada' },
      { expira_en: enMinutos(-1) },
      { stripe_session_id: null }
    ]) {
      instalar({ reservas: [provisional(cambios)] });
      const res = await retomar(R1);
      assert.equal(res.status, 409, JSON.stringify(cambios));
      assert.deepEqual(res.body, { error: MENSAJE_PLAZO_DE_PAGO_TERMINADO });
    }
    assert.equal(stripe.checkout.sessions.retrieve.mock.callCount(), 0);
  });

  test('si Stripe dice que ya se pagó: 409 que lo explica', async () => {
    sesiones.set('cs_1', { status: 'complete', url: null });
    const res = await retomar(R1);
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_PAGO_YA_RECIBIDO });
  });

  test('si Stripe dice que caducó (o no da su página), 409 que pide elegir otra vez', async () => {
    sesiones.set('cs_1', { status: 'expired', url: null });
    const res = await retomar(R1);
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_PLAZO_DE_PAGO_TERMINADO });

    sesiones.set('cs_1', { status: 'open', url: null });
    assert.equal((await retomar(R1)).status, 409);
  });

  test('si no se puede consultar a Stripe: 503 que pide reintentar, sin dar nada por perdido', async () => {
    sesiones.delete('cs_1');
    const res = await retomar(R1);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: MENSAJE_REINTENTAR_PAGO });
    assert.equal(fake.escrituras.length, 0);
  });

  test('si falla la base de datos: 500 genérico, sin el detalle', async () => {
    fake.fallos['reservas.select'] = { message: 'conexión perdida con db-secreta' };
    const res = await retomar(R1);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(res.body).includes('db-secreta'));
  });

  test('el límite por IP: a la undécima en 15 minutos, 429', async () => {
    const desde = '10.99.0.1';
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await retomar(R1, { desde })).status, 200);
    }
    assert.equal((await retomar(R1, { desde })).status, 429);
  });
});
