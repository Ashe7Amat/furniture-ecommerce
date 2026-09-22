// Tests de GET /api/muebles/confirmar-sesion (el respaldo del webhook) y de su interacción
// con él, más un smoke test de crear-sesion-pago, que comparte el cliente de Stripe.
// Stripe se sustituye por un doble (sin red); Supabase y los emails también.
//
// Ojo: esta ruta tiene un límite de 20 peticiones por IP cada 15 minutos y todos los tests
// de este archivo comparten proceso, así que hay que mantener el total de llamadas por
// debajo de 20 (ahora son 13). El límite en sí se prueba en confirmarSesionLimite.test.js.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad
process.env.CLIENT_URL = 'https://tienda.example.com';

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const stripeUtil = require('../utils/stripe');
const { leerItemsDeMetadata } = require('../utils/metadataStripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const {
  SECRETO_WEBHOOK, MUEBLES_DE_PRUEBA, crearSesion, crearEventoCompletado, firmarEvento
} = require('./helpers/stripeFixtures');

let fake;
let correos;
let sesionesDeStripe;
let retrieve;
let crearSesionDeStripe;
let registroErrores;

// confirmar-sesion se traga los errores de guardado para no asustar al comprador (responde
// 200 igualmente), así que un test que solo mire el 200 no notaría que el procesado ha
// fallado. Los tests de camino feliz llaman a esto para comprobar que no hubo fallo.
const sinFalloDeRegistro = () => {
  const fallos = registroErrores.mock.calls.filter(c => String(c.arguments[0]).includes('No se pudo registrar'));
  assert.equal(fallos.length, 0, 'el procesado de la sesión no debe haber fallado en silencio');
};

const confirmar = (sessionId = 'cs_test_123') =>
  request(app).get('/api/muebles/confirmar-sesion').query({ session_id: sessionId });

const enviarWebhook = (evento) => {
  const { payload, cabecera } = firmarEvento(evento);
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

  sesionesDeStripe = { cs_test_123: crearSesion() };
  retrieve = mock.fn(async (id) => {
    if (!sesionesDeStripe[id]) throw new Error(`No such checkout.session: ${id}`);
    return sesionesDeStripe[id];
  });
  crearSesionDeStripe = mock.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_nueva' }));
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { retrieve, create: crearSesionDeStripe } }
  }));

  registroErrores = mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
});

afterEach(() => mock.restoreAll());

describe('GET /api/muebles/confirmar-sesion — validación', () => {
  test('responde 503 si Stripe no está configurado en el servidor', async () => {
    mock.method(stripeUtil, 'getStripe', () => null);
    const res = await confirmar();

    assert.equal(res.status, 503);
    assert.equal(retrieve.mock.callCount(), 0);
  });

  test('responde 400 si falta session_id', async () => {
    const res = await request(app).get('/api/muebles/confirmar-sesion');

    assert.equal(res.status, 400);
    assert.equal(retrieve.mock.callCount(), 0);
  });

  test('responde 400 si session_id viene repetido (no es un texto)', async () => {
    const res = await request(app).get('/api/muebles/confirmar-sesion?session_id=cs_a&session_id=cs_b');

    assert.equal(res.status, 400);
    assert.equal(retrieve.mock.callCount(), 0);
  });

  test('responde 400 y no escribe nada si el pago no está completado', async () => {
    sesionesDeStripe.cs_test_123 = crearSesion({ payment_status: 'unpaid' });
    const res = await confirmar();

    assert.equal(res.status, 400);
    assert.match(res.body.error, /pago/i);
    assert.equal(fake.escrituras.length, 0);
  });

  test('responde 500 si Stripe no encuentra la sesión', async () => {
    const res = await confirmar('cs_no_existe');

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'No se pudo confirmar el pago.');
    assert.equal(fake.escrituras.length, 0);
  });
});

describe('GET /api/muebles/confirmar-sesion — como respaldo idempotente', () => {
  test('con el pago hecho registra el pedido y devuelve el total cobrado por Stripe', async () => {
    const res = await confirmar();

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.total, 1250);
    assert.equal(retrieve.mock.calls[0].arguments[0], 'cs_test_123');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(fake.tablas.muebles.find(m => m.id === 'mueble-1').estado, 'vendido');
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    sinFalloDeRegistro();
  });

  test('recargar la página de éxito no duplica pedido ni emails y sigue respondiendo éxito', async () => {
    const primera = await confirmar();
    const segunda = await confirmar();

    assert.equal(primera.status, 200);
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.total, 1250);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    sinFalloDeRegistro();
  });

  test('si el webhook ya registró la venta, confirmar-sesion no la repite pero responde éxito', async () => {
    const webhook = await enviarWebhook(crearEventoCompletado(crearSesion()));
    const respaldo = await confirmar();

    assert.equal(webhook.body.estado, 'procesada');
    assert.equal(respaldo.status, 200);
    assert.equal(respaldo.body.success, true);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    sinFalloDeRegistro();
  });

  test('si confirmar-sesion llega antes que el webhook, el webhook después no repite nada', async () => {
    const respaldo = await confirmar();
    const webhook = await enviarWebhook(crearEventoCompletado(crearSesion()));

    assert.equal(respaldo.status, 200);
    assert.equal(webhook.status, 200);
    assert.equal(webhook.body.estado, 'ya_procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    sinFalloDeRegistro();
  });

  test('webhook y confirmar-sesion a la vez (lo habitual tras un pago) dejan un solo pedido', async () => {
    // Que las dos peticiones se solapen de verdad depende del orden en que Express las
    // atienda; la carrera exacta (con unicidadRechazada) se prueba en pagos.test.js. Aquí se
    // comprueba el resultado observable, sea cual sea el orden.
    const [webhook, respaldo] = await Promise.all([
      enviarWebhook(crearEventoCompletado(crearSesion())),
      confirmar()
    ]);

    assert.equal(webhook.status, 200);
    assert.equal(respaldo.status, 200);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(correos.alerta.mock.callCount(), 0, 'el gemelo no debe generar una falsa alerta de doble venta');
    sinFalloDeRegistro();
  });

  test('si la base de datos falla y hay webhook, el comprador ve el pago confirmado y no se alerta (Stripe reintentará)', async () => {
    fake.fallos['pedidos.insert'] = { code: '08006', message: 'connection failure' };
    const res = await confirmar();

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(fake.tablas.pedidos.length, 0);
    assert.equal(correos.venta.mock.callCount(), 0);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('si la base de datos falla y NO hay webhook que reintente, avisa por email al admin con los datos del pago', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    fake.fallos['pedidos.insert'] = { code: '08006', message: 'connection failure' };
    const res = await confirmar();

    assert.equal(res.status, 200, 'al comprador no se le dice que su pago ha fallado');
    assert.equal(res.body.success, true);
    assert.equal(fake.tablas.pedidos.length, 0);
    assert.equal(correos.alerta.mock.callCount(), 1);
    const { asunto, detalles } = correos.alerta.mock.calls[0].arguments[0];
    assert.match(asunto, /no se ha podido registrar/i);
    assert.ok(detalles.join('\n').includes('cs_test_123'));
    assert.ok(detalles.join('\n').includes('ana@example.com'));
  });
});

describe('POST /api/muebles/crear-sesion-pago', () => {
  const pedirPago = (cuerpo) => request(app).post('/api/muebles/crear-sesion-pago').send(cuerpo);
  const clienteInfo = { nombre: 'Ana Prueba', email: 'ana@example.com', telefono: '600000000', direccion: 'Calle Falsa 123', notas: '' };

  test('responde 503 si Stripe no está configurado', async () => {
    mock.method(stripeUtil, 'getStripe', () => null);
    const res = await pedirPago({ items: [{ productId: 'mueble-1', modalidad: 'compra' }], clienteInfo });

    assert.equal(res.status, 503);
  });

  test('responde 400 con el carrito vacío', async () => {
    const res = await pedirPago({ items: [], clienteInfo });

    assert.equal(res.status, 400);
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  test('crea la sesión con el precio real del catálogo y la metadata que luego lee el webhook', async () => {
    const res = await pedirPago({
      items: [{ productId: 'mueble-1', modalidad: 'compra', precio: 1 }], // el precio del navegador se ignora
      clienteInfo
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.url, 'https://checkout.stripe.com/c/pay/cs_test_nueva');

    const parametros = crearSesionDeStripe.mock.calls[0].arguments[0];
    assert.equal(parametros.mode, 'payment');
    assert.equal(parametros.line_items[0].price_data.currency, 'eur');
    assert.equal(parametros.line_items[0].price_data.unit_amount, 125000);
    assert.equal(parametros.customer_email, 'ana@example.com');
    assert.match(parametros.success_url, /^https:\/\/tienda\.example\.com\/checkout\/exito\?session_id=\{CHECKOUT_SESSION_ID\}$/);
    assert.deepEqual(leerItemsDeMetadata(parametros.metadata), [{ productId: 'mueble-1', modalidad: 'compra' }]);
    assert.equal(parametros.metadata.clienteEmail, 'ana@example.com');
  });

  test('rechaza con 400 una pieza que ya está vendida, sin llegar a crear la sesión', async () => {
    fake.tablas.muebles.find(m => m.id === 'mueble-1').estado = 'vendido';
    const res = await pedirPago({ items: [{ productId: 'mueble-1', modalidad: 'compra' }], clienteInfo });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /vendida/);
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });
});
