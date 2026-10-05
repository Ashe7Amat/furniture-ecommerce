// Extremo a extremo (sin red): un carrito grande y una nota de entrega larga se pueden pagar.
// crear-sesion-pago genera la metadata, un doble de Stripe la captura, y esa misma metadata se
// entrega al webhook firmado, que debe registrar el pedido completo. Antes, un carrito de 7 o
// más piezas o una nota de más de 500 caracteres hacía fallar la sesión en Stripe y el comprador
// no podía pagar. Stripe, Supabase y los emails están sustituidos por dobles.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad
process.env.CLIENT_URL = 'https://tienda.example.com';

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const stripeUtil = require('../utils/stripe');
const { MAX_CLAVES, MAX_VALOR } = require('../utils/metadataStripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { crearEventoCompletado, firmarEvento } = require('./helpers/stripeFixtures');

const uuid = (n) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-${String(n).padStart(12, '0')}`;
const PRECIO = 100;

let fake;
let correos;
let crearSesionDeStripe;

const catalogo = (piezas) =>
  Array.from({ length: piezas }, (_, i) => ({
    id: uuid(i),
    nombre: `Pieza ${i}`,
    precio_venta: PRECIO,
    precio_alquiler_dia: null,
    estado: 'disponible',
    disponible: true
  }));

const carrito = (piezas) =>
  Array.from({ length: piezas }, (_, i) => ({ productId: uuid(i), modalidad: 'compra' }));

const comprador = (cambios = {}) => ({
  nombre: 'Ana Martínez',
  email: 'ana@ejemplo.com',
  telefono: '600123456',
  direccion: 'Calle Mayor 15, 2º B, 08001 Barcelona (Barcelona)',
  notas: 'Llamar al timbre.',
  ...cambios
});

const pedirPago = (cuerpo) => request(app).post('/api/muebles/crear-sesion-pago').send(cuerpo);
const metadataEnviadaAStripe = () => crearSesionDeStripe.mock.calls[0].arguments[0].metadata;

const enviarWebhook = (evento) => {
  const { payload, cabecera } = firmarEvento(evento);
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', cabecera)
    .send(payload);
};

const prepararTienda = (piezas) => {
  fake = crearFakeSupabase({ muebles: catalogo(piezas) });
  mock.method(supabase, 'from', fake.from);
};

beforeEach(() => {
  correos = {
    venta: mock.method(email, 'enviarNotificacionVenta', async () => {}),
    cliente: mock.method(email, 'enviarConfirmacionCliente', async () => {}),
    alerta: mock.method(email, 'enviarAlertaAdmin', async () => {})
  };
  crearSesionDeStripe = mock.fn(async () => ({
    url: 'https://checkout.stripe.com/c/pay/cs_test_grande'
  }));
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { create: crearSesionDeStripe } }
  }));
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
});

afterEach(() => mock.restoreAll());

describe('crear-sesion-pago con carritos grandes y notas largas', () => {
  test('12 piezas y una nota de 200 caracteres (el máximo del formulario): se puede pagar y el pedido sale completo', async () => {
    prepararTienda(12);
    const nota = 'Ascensor pequeño, entrega por la mañana. '.repeat(5).slice(0, 200);

    const res = await pedirPago({ items: carrito(12), clienteInfo: comprador({ notas: nota }) });

    assert.equal(res.status, 200);
    assert.equal(crearSesionDeStripe.mock.callCount(), 1);

    // Lo que recibe Stripe respeta sus límites (esto es lo que antes fallaba con 7 o más piezas)
    const metadata = metadataEnviadaAStripe();
    assert.ok(Object.keys(metadata).length <= MAX_CLAVES);
    for (const [clave, valor] of Object.entries(metadata)) {
      assert.ok(valor.length <= MAX_VALOR, `"${clave}" tiene ${valor.length} caracteres`);
    }

    // Esa misma metadata, tal cual, llega en el evento del webhook y el pedido se registra entero
    const sesionPagada = {
      id: 'cs_test_grande',
      object: 'checkout.session',
      payment_status: 'paid',
      amount_total: 12 * PRECIO * 100,
      metadata
    };
    const webhook = await enviarWebhook(crearEventoCompletado(sesionPagada));

    assert.equal(webhook.status, 200);
    assert.equal(webhook.body.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(fake.tablas.pedidos[0].items.length, 12);
    assert.equal(fake.tablas.pedidos[0].total, 12 * PRECIO);
    assert.equal(fake.tablas.pedidos[0].cliente_info.notas, nota);
    assert.ok(
      fake.tablas.muebles.every((m) => m.estado === 'vendido'),
      'las 12 piezas quedan vendidas'
    );
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
  });

  // CAMBIADO A PROPÓSITO (5 oct 2026, H35): el carrito admite como máximo 20 piezas (antes, 30
  // pasaban). El caso límite es ahora el de 20.
  test('20 piezas (el máximo por pedido) con notas de 500 caracteres (el máximo que admite el servidor) también se pagan', async () => {
    prepararTienda(20);

    const res = await pedirPago({
      items: carrito(20),
      clienteInfo: comprador({ notas: 'n'.repeat(500) })
    });

    assert.equal(res.status, 200);
    const metadata = metadataEnviadaAStripe();
    assert.ok(Object.keys(metadata).length <= MAX_CLAVES);
    assert.ok(Object.values(metadata).every((v) => v.length <= MAX_VALOR));

    const webhook = await enviarWebhook(
      crearEventoCompletado({
        id: 'cs_test_20',
        payment_status: 'paid',
        amount_total: 20 * PRECIO * 100,
        metadata
      })
    );
    assert.equal(webhook.body.estado, 'procesada');
    assert.equal(fake.tablas.pedidos[0].items.length, 20);
  });

  test('una sola pieza con una nota larga (el caso más sencillo que fallaba) se paga', async () => {
    prepararTienda(1);
    const res = await pedirPago({
      items: carrito(1),
      clienteInfo: comprador({ notas: 'x'.repeat(450) })
    });

    assert.equal(res.status, 200);
    assert.equal(metadataEnviadaAStripe().clienteNotas.length, 450);
  });

  test('una sesión abierta con el formato antiguo (un solo valor "items") aún se procesa al pagarse', async () => {
    prepararTienda(1);
    const antigua = {
      id: 'cs_test_antigua',
      payment_status: 'paid',
      amount_total: PRECIO * 100,
      metadata: {
        items: JSON.stringify(carrito(1)),
        clienteNombre: 'Ana',
        clienteEmail: 'ana@ejemplo.com'
      }
    };

    const webhook = await enviarWebhook(crearEventoCompletado(antigua));

    assert.equal(webhook.body.estado, 'procesada');
    assert.equal(fake.tablas.pedidos[0].items.length, 1);
  });
});

describe('crear-sesion-pago: rechazos con un mensaje claro y sin llegar a Stripe', () => {
  test('unas notas de 501 caracteres se rechazan en castellano, sin llamar a Stripe', async () => {
    prepararTienda(2);
    const res = await pedirPago({
      items: carrito(2),
      clienteInfo: comprador({ notas: 'n'.repeat(501) })
    });

    assert.equal(res.status, 400);
    assert.equal(
      res.body.error,
      'Las notas de entrega son demasiado largas (máximo 500 caracteres).'
    );
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  test('una dirección de más de 500 caracteres se rechaza en castellano', async () => {
    prepararTienda(1);
    const res = await pedirPago({
      items: carrito(1),
      clienteInfo: comprador({ direccion: 'x'.repeat(501) })
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /^La dirección es demasiado larga/);
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  // CAMBIADO A PROPÓSITO (5 oct 2026, H35): con el tope de 20 piezas, un carrito de 400 ya no llega a
  // construir la metadata (antes respondía "demasiado grande... Divide el pedido"): lo rechaza la
  // validación, antes de consultar nada. El mensaje de la metadata sigue probado en
  // metadataStripe.test.js.
  test('un carrito de más de 20 piezas se rechaza con un mensaje claro, sin consultar el catálogo', async () => {
    prepararTienda(1);
    let consultas = 0;
    const original = fake.from;
    mock.method(supabase, 'from', (tabla) => {
      consultas++;
      return original(tabla);
    });

    for (const piezas of [21, 400]) {
      const res = await pedirPago({ items: carrito(piezas), clienteInfo: comprador() });
      assert.equal(res.status, 400);
      assert.equal(
        res.body.error,
        'Como máximo 20 piezas por pedido. Si necesitas más, divide el pedido en varios o escríbenos.'
      );
    }
    assert.equal(consultas, 0);
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  test('H35: las piezas del carrito se leen en una sola consulta, aunque haya varias', async () => {
    prepararTienda(5);
    let consultasMuebles = 0;
    const original = fake.from;
    mock.method(supabase, 'from', (tabla) => {
      if (tabla === 'muebles') consultasMuebles++;
      return original(tabla);
    });

    const res = await pedirPago({ items: carrito(5), clienteInfo: comprador() });

    assert.equal(res.status, 200);
    assert.equal(consultasMuebles, 1);
    const lineas = crearSesionDeStripe.mock.calls[0].arguments[0].line_items;
    assert.deepEqual(
      lineas.map((l) => l.price_data.product_data.name),
      ['Pieza 0', 'Pieza 1', 'Pieza 2', 'Pieza 3', 'Pieza 4'],
      'en el orden del carrito'
    );
  });

  test('H35: una pieza que no está en el catálogo se rechaza con su id, como antes', async () => {
    prepararTienda(2);
    const items = [...carrito(2), { productId: uuid(99), modalidad: 'compra' }];

    const res = await pedirPago({ items, clienteInfo: comprador() });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, `La pieza con ID ${uuid(99)} no existe en catálogo.`);
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  test('H35: si falla la base de datos, 500 genérico (ya no se confunde con "no existe")', async () => {
    prepararTienda(1);
    mock.method(supabase, 'from', () => ({
      select: () => ({ in: async () => ({ data: null, error: { message: 'conexión perdida' } }) })
    }));

    const res = await pedirPago({ items: carrito(1), clienteInfo: comprador() });

    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body.error, /conexión perdida|no existe/);
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  test('el rechazo por longitud ocurre antes de consultar el catálogo', async () => {
    prepararTienda(1);
    let consultas = 0;
    const original = fake.from;
    mock.method(supabase, 'from', (tabla) => {
      consultas++;
      return original(tabla);
    });

    await pedirPago({ items: carrito(1), clienteInfo: comprador({ nombre: 'x'.repeat(101) }) });

    assert.equal(consultas, 0, 'no debe tocar la base de datos si el dato ya es inválido');
  });

  test('items que no es una lista se trata como carrito vacío en vez de romper', async () => {
    prepararTienda(1);
    for (const items of [undefined, null, 'x', {}, 5]) {
      const res = await pedirPago({ items, clienteInfo: comprador() });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'El carrito de compras está vacío.');
    }
  });
});
