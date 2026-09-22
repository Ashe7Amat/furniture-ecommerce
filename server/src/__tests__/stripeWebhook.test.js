// Tests de POST /api/stripe/webhook a través de toda la pila de Express (incluido el
// express.json() global, que debe quedar DETRÁS del webhook). Las firmas se generan con la
// librería oficial de Stripe, así que se prueba la verificación real. Supabase y los emails
// están sustituidos por dobles.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const {
  SECRETO_WEBHOOK,
  MUEBLES_DE_PRUEBA,
  crearSesion,
  crearEventoCompletado,
  firmarEvento
} = require('./helpers/stripeFixtures');

let fake;
let correos;

const enviarWebhook = (evento, opcionesFirma) => {
  const { payload, cabecera } = firmarEvento(evento, opcionesFirma);
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', cabecera)
    .send(payload);
};

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRETO_WEBHOOK;
  fake = crearFakeSupabase({ muebles: MUEBLES_DE_PRUEBA() });
  mock.method(supabase, 'from', fake.from);
  correos = {
    venta: mock.method(email, 'enviarNotificacionVenta', async () => {}),
    cliente: mock.method(email, 'enviarConfirmacionCliente', async () => {}),
    alerta: mock.method(email, 'enviarAlertaAdmin', async () => {})
  };
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
});

afterEach(() => mock.restoreAll());

describe('POST /api/stripe/webhook — verificación de firma', () => {
  test('responde 503 si el servidor no tiene STRIPE_WEBHOOK_SECRET (Stripe reintentará)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await enviarWebhook(crearEventoCompletado(crearSesion()));

    assert.equal(res.status, 503);
    assert.equal(fake.escrituras.length, 0);
  });

  test('rechaza con 400 una petición sin cabecera Stripe-Signature', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(crearEventoCompletado(crearSesion())));

    assert.equal(res.status, 400);
    assert.match(res.body.error, /firma/i);
    assert.equal(fake.escrituras.length, 0);
  });

  test('rechaza con 400 una firma hecha con otro secreto', async () => {
    const res = await enviarWebhook(crearEventoCompletado(crearSesion()), {
      secreto: 'whsec_de_un_atacante'
    });

    assert.equal(res.status, 400);
    assert.equal(fake.escrituras.length, 0);
    assert.equal(correos.venta.mock.callCount(), 0);
  });

  test('rechaza con 400 un cuerpo alterado después de firmarlo', async () => {
    const original = crearEventoCompletado(crearSesion({ amount_total: 125000 }));
    const { cabecera } = firmarEvento(original);
    const alterado = crearEventoCompletado(crearSesion({ amount_total: 1 }));

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', cabecera)
      .send(JSON.stringify(alterado));

    assert.equal(res.status, 400);
    assert.equal(fake.escrituras.length, 0);
  });

  test('rechaza con 400 una firma correcta pero antigua (reenvío de una petición capturada)', async () => {
    const haceUnaHora = Math.floor(Date.now() / 1000) - 3600;
    const res = await enviarWebhook(crearEventoCompletado(crearSesion()), {
      timestamp: haceUnaHora
    });

    assert.equal(res.status, 400);
    assert.equal(fake.escrituras.length, 0);
  });

  test('rechaza con 400 un cuerpo que no llega como JSON crudo, aunque traiga firma', async () => {
    const { payload, cabecera } = firmarEvento(crearEventoCompletado(crearSesion()));
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'text/plain')
      .set('Stripe-Signature', cabecera)
      .send(payload);

    assert.equal(res.status, 400);
    assert.equal(fake.escrituras.length, 0);
  });
});

describe('POST /api/stripe/webhook — checkout.session.completed', () => {
  test('con firma válida registra el pedido, marca la pieza como vendida y envía los emails', async () => {
    const res = await enviarWebhook(crearEventoCompletado(crearSesion()));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { recibido: true, estado: 'procesada' });
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(fake.tablas.pedidos[0].stripe_session_id, 'cs_test_123');
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado, 'vendido');
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
  });

  test('si Stripe reenvía el mismo evento, responde 200 sin duplicar pedido ni emails', async () => {
    const evento = crearEventoCompletado(crearSesion());
    const primera = await enviarWebhook(evento);
    const segunda = await enviarWebhook(evento);

    assert.equal(primera.body.estado, 'procesada');
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.estado, 'ya_procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
  });

  test('dos entregas simultáneas del mismo evento dejan un solo pedido', async () => {
    const evento = crearEventoCompletado(crearSesion());
    const respuestas = await Promise.all([enviarWebhook(evento), enviarWebhook(evento)]);

    assert.ok(respuestas.every((r) => r.status === 200));
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
  });

  test('si la base de datos falla responde 500 (para que Stripe reintente) y el reintento funciona', async () => {
    const evento = crearEventoCompletado(crearSesion());
    fake.fallos['pedidos.insert'] = { code: '08006', message: 'connection failure' };

    const fallida = await enviarWebhook(evento);
    assert.equal(fallida.status, 500);
    assert.equal(correos.venta.mock.callCount(), 0);

    delete fake.fallos['pedidos.insert'];
    const reintento = await enviarWebhook(evento);

    assert.equal(reintento.status, 200);
    assert.equal(reintento.body.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
  });

  test('una sesión completada pero sin pago confirmado (unpaid) se acusa con 200 y no se procesa', async () => {
    const res = await enviarWebhook(
      crearEventoCompletado(crearSesion({ payment_status: 'unpaid' }))
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.ignorado, true);
    assert.equal(fake.escrituras.length, 0);
    assert.equal(correos.venta.mock.callCount(), 0);
  });

  test('una sesión sin piezas en la metadata se acusa con 200 pero no escribe nada', async () => {
    const res = await enviarWebhook(crearEventoCompletado(crearSesion({ metadata: {} })));

    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'ignorada');
    assert.equal(fake.escrituras.length, 0);
  });
});

describe('POST /api/stripe/webhook — otros eventos', () => {
  test('un evento que no es checkout.session.completed se acusa con 200 y se ignora', async () => {
    const res = await enviarWebhook({
      id: 'evt_otro',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1' } }
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { recibido: true, ignorado: true });
    assert.equal(fake.escrituras.length, 0);
  });
});
