// Tests de la confirmación del pago de una reserva por fechas (utils/reservas.js,
// procesarReservaPagada y liberarReservaDeSesionCaducada; docs/reservas-diseno.md 6.4): por el
// webhook firmado de verdad y por la página de éxito (confirmar-sesion), con el doble de Supabase.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { crearEventoCompletado, firmarEvento } = require('./helpers/stripeFixtures');
const { idPedidoDeSesion } = require('../utils/pagos');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);

const ANA = '00000000-0000-4000-8000-0000000000a1';
const SILLA = '00000000-0000-4000-8000-000000000001';
const RESERVA = '00000000-0000-4000-8000-0000000000f1';
const OTRA = '00000000-0000-4000-8000-0000000000f2';

// La reserva provisional tal como la deja POST /api/reservas/sesion-pago.
const provisional = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SILLA,
  tipo: 'alquiler',
  estado: 'pendiente',
  fecha_inicio: dia(10),
  hora_entrega: '10:00',
  fecha_fin: dia(13),
  hora_recogida: '10:00',
  fin_ocupacion: dia(13),
  dias_margen: 2,
  cliente_id: ANA,
  expira_en: new Date(Date.now() + 30 * 60_000).toISOString(),
  stripe_session_id: 'cs_reserva_1',
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: 'Calle Mayor 15, Barcelona',
  datos_contacto: {
    nombre: 'Ana Martínez',
    email: 'ana@ejemplo.com',
    telefono: '600123456',
    direccion: 'Calle Mayor 15, Barcelona',
    notas: null
  },
  importe_alquiler: 75,
  importe_envio: 0,
  importe_total: 75,
  precio_desglose: { dias: 3 },
  pedido_id: null,
  confirmacion_enviada_en: null,
  conflicto_en: null,
  ...cambios
});

const sesionPagada = (cambios = {}) => ({
  id: 'cs_reserva_1',
  object: 'checkout.session',
  payment_status: 'paid',
  status: 'complete',
  amount_total: 7500,
  payment_intent: 'pi_reserva_1',
  metadata: { tipo: 'reserva', reserva_id: RESERVA },
  ...cambios
});

let fake;
let correos;
const instalar = (reservas) => {
  fake = crearFakeSupabase({
    muebles: [{ id: SILLA, nombre: 'Silla Thonet', estado: 'disponible', precio_alquiler_dia: 25 }],
    reservas
  });
  mock.method(supabase, 'from', fake.from);
};

const enviarWebhook = (evento) => {
  const { payload, cabecera } = firmarEvento(evento);
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', cabecera)
    .send(payload);
};
const pagado = (sesion = sesionPagada()) => enviarWebhook(crearEventoCompletado(sesion));
const caducado = (sesion) =>
  enviarWebhook({
    id: 'evt_caducada',
    object: 'event',
    type: 'checkout.session.expired',
    data: { object: sesion }
  });

let ip = 0;
const volverDelPago = (sesion = sesionPagada()) => {
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { retrieve: async () => sesion } }
  }));
  ip += 1;
  return request(app)
    .get(`/api/muebles/confirmar-sesion?session_id=${sesion.id}`)
    .set('X-Forwarded-For', `10.2.0.${ip}`);
};

const reserva = (id = RESERVA) => fake.tablas.reservas.find((r) => r.id === id);
const pedidos = () => fake.tablas.pedidos;
const veces = (nombre) => correos[nombre].mock.callCount();

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
  correos = {
    confirmacion: mock.method(email, 'enviarConfirmacionReserva', async () => {}),
    conflicto: mock.method(email, 'enviarConflictoReserva', async () => {}),
    alerta: mock.method(email, 'enviarAlertaAdmin', async () => {}),
    venta: mock.method(email, 'enviarNotificacionVenta', async () => {}),
    compra: mock.method(email, 'enviarConfirmacionCliente', async () => {})
  };
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  instalar([provisional()]);
});

afterEach(() => mock.restoreAll());

describe('webhook checkout.session.completed de una reserva', () => {
  test('confirma la reserva, registra su pedido, los enlaza y envía los emails una vez', async () => {
    const res = await pagado();

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { recibido: true, estado: 'confirmada' });

    const r = reserva();
    assert.equal(r.estado, 'confirmada');
    assert.equal(r.stripe_session_id, 'cs_reserva_1');
    assert.equal(r.stripe_payment_intent_id, 'pi_reserva_1');
    assert.equal(r.expira_en, null);
    assert.equal(r.pedido_id, idPedidoDeSesion('cs_reserva_1'));
    assert.ok(r.confirmacion_enviada_en);
    assert.equal(r.conflicto_en, null);

    assert.equal(pedidos().length, 1);
    const [pedido] = pedidos();
    assert.equal(pedido.id, idPedidoDeSesion('cs_reserva_1'));
    assert.equal(pedido.total, 75);
    assert.equal(pedido.cliente_id, ANA);
    assert.equal(pedido.metodo_entrega, 'domicilio');
    assert.equal(pedido.cliente_info.email, 'ana@ejemplo.com');
    assert.deepEqual(pedido.items, [
      {
        productId: SILLA,
        nombre: 'Silla Thonet',
        modalidad: 'alquiler',
        cantidad: 1,
        precio: 75,
        fecha_inicio: dia(10),
        hora_entrega: '10:00',
        fecha_fin: dia(13),
        hora_recogida: '10:00',
        dias: 3,
        reserva_id: RESERVA
      }
    ]);

    assert.equal(veces('confirmacion'), 1);
    const { email: para, nombre, reserva: datos } = correos.confirmacion.mock.calls[0].arguments[0];
    assert.equal(para, 'ana@ejemplo.com');
    assert.equal(nombre, 'Ana Martínez');
    assert.equal(datos.pieza, 'Silla Thonet');
    assert.equal(datos.dias, 3);
    assert.equal(datos.total, 75);
    assert.equal(veces('alerta'), 1);
    assert.equal(correos.alerta.mock.calls[0].arguments[0].asunto, 'Nueva reserva de alquiler');
    assert.equal(veces('conflicto'), 0);
    assert.equal(veces('venta') + veces('compra'), 0, 'no son los correos de una compra');
  });

  test('con entrega en la tienda el pedido va como "recogida"', async () => {
    instalar([provisional({ modo_entrega: 'tienda', direccion_entrega: null })]);
    await pagado();
    assert.equal(pedidos()[0].metodo_entrega, 'recogida');
  });

  test('el mismo aviso dos veces deja un pedido y un juego de emails', async () => {
    await pagado();
    const res = await pagado();
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'confirmada');
    assert.equal(pedidos().length, 1);
    assert.equal(veces('confirmacion'), 1);
    assert.equal(veces('alerta'), 1);
  });

  test('webhook y página de éxito a la vez: un pedido, una confirmación y un juego de emails', async () => {
    const [webhook, exito] = await Promise.all([pagado(), volverDelPago()]);
    assert.equal(webhook.body.estado, 'confirmada');
    assert.equal(exito.body.estado, 'confirmada');
    assert.equal(pedidos().length, 1);
    assert.equal(reserva().estado, 'confirmada');
    assert.equal(veces('confirmacion'), 1);
  });

  test('si la sesión no llegó a guardarse en la reserva (paso 8), se guarda al confirmar', async () => {
    instalar([provisional({ stripe_session_id: null })]);
    await pagado();
    assert.equal(reserva().estado, 'confirmada');
    assert.equal(reserva().stripe_session_id, 'cs_reserva_1');
  });

  test('el id del pago también se lee si la sesión llega con el pago expandido', async () => {
    await pagado(
      sesionPagada({ payment_intent: { id: 'pi_expandido', object: 'payment_intent' } })
    );
    assert.equal(reserva().stripe_payment_intent_id, 'pi_expandido');
  });

  test('pago tardío de una provisional ya expirada: si las fechas siguen libres, se confirma', async () => {
    instalar([provisional({ estado: 'expirada' })]);
    const res = await pagado();
    assert.equal(res.body.estado, 'confirmada');
    assert.equal(reserva().estado, 'confirmada');
    assert.equal(veces('conflicto'), 0);
  });

  test('las provisionales caducadas de otra persona se limpian antes de confirmar (4.6)', async () => {
    instalar([
      provisional({ estado: 'expirada' }),
      provisional({
        id: OTRA,
        cliente_id: '00000000-0000-4000-8000-0000000000b2',
        expira_en: new Date(Date.now() - 60_000).toISOString(),
        stripe_session_id: 'cs_de_otra'
      })
    ]);
    const res = await pagado();
    assert.equal(res.body.estado, 'confirmada');
    assert.equal(reserva(OTRA).estado, 'expirada');
  });

  test('pago tardío cuando las fechas ya son de otra persona: conflicto, pedido registrado y aviso una sola vez', async () => {
    instalar([
      provisional({ estado: 'expirada' }),
      provisional({
        id: OTRA,
        estado: 'confirmada',
        cliente_id: '00000000-0000-4000-8000-0000000000b2',
        expira_en: null,
        stripe_session_id: 'cs_de_otra'
      })
    ]);

    const res = await pagado();

    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'conflicto');
    assert.equal(reserva().estado, 'expirada');
    assert.ok(reserva().conflicto_en);
    assert.equal(reserva().confirmacion_enviada_en, null);
    assert.equal(pedidos().length, 1, 'el dinero está cobrado: el pedido se registra siempre');
    assert.equal(reserva().pedido_id, pedidos()[0].id);
    assert.equal(veces('conflicto'), 1);
    assert.equal(veces('alerta'), 1);
    assert.equal(
      correos.alerta.mock.calls[0].arguments[0].asunto,
      'Reserva pagada que no se ha podido confirmar'
    );
    assert.equal(veces('confirmacion'), 0);

    await pagado();
    await volverDelPago();
    assert.equal(veces('conflicto'), 1, 'ni el reintento ni la página de éxito lo repiten');
    assert.equal(veces('alerta'), 1);
  });

  test('pago de una provisional cancelada (el cliente empezó otra): conflicto', async () => {
    instalar([provisional({ estado: 'cancelada', cancelada_por: 'sistema' })]);
    const res = await pagado();
    assert.equal(res.body.estado, 'conflicto');
    assert.equal(reserva().estado, 'cancelada');
    assert.equal(veces('conflicto'), 1);
  });

  test('una reserva ya en curso con otra sesión: conflicto, no la toca', async () => {
    const PEDIDO_ANTERIOR = idPedidoDeSesion('cs_otra');
    instalar([
      provisional({
        estado: 'en_curso',
        stripe_session_id: 'cs_otra',
        expira_en: null,
        pedido_id: PEDIDO_ANTERIOR,
        entregada_en: new Date().toISOString()
      })
    ]);
    const res = await pagado();
    assert.equal(res.body.estado, 'conflicto');
    assert.equal(reserva().estado, 'en_curso');
    assert.equal(reserva().stripe_session_id, 'cs_otra');
    assert.equal(pedidos().length, 1, 'el pago nuevo tiene su pedido');
    assert.equal(reserva().pedido_id, PEDIDO_ANTERIOR, 'pero no se lleva el enlace de la reserva');
  });
});

test('si ya se entregó cuando llega el reintento, no se manda la confirmación con retraso', async () => {
  // La confirmó otra llamada con esta misma sesión, que murió antes de los emails, y el
  // administrador ya la ha marcado entregada.
  instalar([
    provisional({
      estado: 'en_curso',
      expira_en: null,
      entregada_en: new Date().toISOString()
    })
  ]);
  const res = await pagado();
  assert.equal(res.body.estado, 'confirmada');
  assert.equal(veces('confirmacion'), 0);
  assert.equal(reserva().confirmacion_enviada_en, null);
});

describe('fallos entre pasos y reintentos (6.4, test obligatorio)', () => {
  test('falla registrar el pedido (entre los pasos 3 y 4): 500, y el reintento lo completa todo una vez', async () => {
    fake.fallos['pedidos.insert'] = { message: 'conexión perdida' };
    const primero = await pagado();
    assert.equal(primero.status, 500, 'Stripe reintentará');
    assert.equal(reserva().estado, 'confirmada');
    assert.equal(pedidos().length, 0);
    assert.equal(veces('confirmacion'), 0);

    delete fake.fallos['pedidos.insert'];
    const segundo = await pagado();

    assert.equal(segundo.status, 200);
    assert.equal(segundo.body.estado, 'confirmada');
    assert.equal(pedidos().length, 1);
    assert.equal(reserva().pedido_id, pedidos()[0].id);
    assert.equal(veces('confirmacion'), 1);
    assert.equal(veces('alerta'), 1);
  });

  test('falla enlazar el pedido (entre los pasos 4 y 5): 500, y el reintento lo enlaza sin otro pedido ni más emails', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      'pedido_id' in consulta.datos ? { message: 'conexión perdida' } : null;
    assert.equal((await pagado()).status, 500);
    assert.equal(pedidos().length, 1);
    assert.equal(reserva().pedido_id, null);
    assert.equal(veces('confirmacion'), 0);

    delete fake.fallos['reservas.update'];
    assert.equal((await pagado()).status, 200);

    assert.equal(pedidos().length, 1);
    assert.equal(reserva().pedido_id, pedidos()[0].id);
    assert.equal(veces('confirmacion'), 1);
  });

  test('falla la confirmación: 500 sin pedido, y el reintento confirma', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.estado === 'confirmada' ? { message: 'conexión perdida' } : null;
    assert.equal((await pagado()).status, 500);
    assert.equal(reserva().estado, 'pendiente');
    assert.equal(pedidos().length, 0);

    delete fake.fallos['reservas.update'];
    assert.equal((await pagado()).body.estado, 'confirmada');
  });

  test('falla leer la reserva: 500', async () => {
    fake.fallos['reservas.select'] = { message: 'conexión perdida' };
    assert.equal((await pagado()).status, 500);
  });

  test('falla leer la pieza: 500', async () => {
    fake.fallos['muebles.select'] = { message: 'conexión perdida' };
    assert.equal((await pagado()).status, 500);
  });

  test('falla reclamar el envío de los emails: 500 y nadie los envía todavía', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      'confirmacion_enviada_en' in consulta.datos ? { message: 'conexión perdida' } : null;
    assert.equal((await pagado()).status, 500);
    assert.equal(veces('confirmacion'), 0);
    delete fake.fallos['reservas.update'];
    await pagado();
    assert.equal(veces('confirmacion'), 1);
  });
});

describe('pagos de reservas que no existen', () => {
  test('una reserva_id que no está en la tabla: 200 "ignorada", aviso al administrador y nada escrito', async () => {
    const res = await pagado(sesionPagada({ metadata: { tipo: 'reserva', reserva_id: OTRA } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'ignorada');
    assert.equal(pedidos().length, 0);
    assert.equal(veces('alerta'), 1);
    assert.equal(
      correos.alerta.mock.calls[0].arguments[0].asunto,
      'Pago cobrado de una reserva que no existe'
    );
  });

  test('una reserva_id que no es un id ni siquiera se busca', async () => {
    const res = await pagado(sesionPagada({ metadata: { tipo: 'reserva', reserva_id: 'x' } }));
    assert.equal(res.body.estado, 'ignorada');
    assert.equal(fake.escrituras.length, 0);
  });

  test('sin reserva_id, también', async () => {
    const res = await pagado(sesionPagada({ metadata: { tipo: 'reserva' } }));
    assert.equal(res.body.estado, 'ignorada');
  });
});

describe('webhook checkout.session.expired', () => {
  const sesionCaducada = (cambios = {}) =>
    sesionPagada({ payment_status: 'unpaid', status: 'expired', ...cambios });

  test('libera las fechas de la reserva provisional', async () => {
    const res = await caducado(sesionCaducada());
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { recibido: true, estado: 'expirada' });
    assert.equal(reserva().estado, 'expirada');
  });

  test('una reserva que ya no está pendiente no se toca', async () => {
    instalar([provisional({ estado: 'confirmada', expira_en: null })]);
    const res = await caducado(sesionCaducada());
    assert.equal(res.body.estado, 'sin_cambios');
    assert.equal(reserva().estado, 'confirmada');
  });

  test('una reserva_id que no es un id se ignora', async () => {
    const res = await caducado(sesionCaducada({ metadata: { tipo: 'reserva', reserva_id: 'x' } }));
    assert.equal(res.body.estado, 'ignorada');
  });

  test('la sesión caducada de una compra se ignora, como antes', async () => {
    const res = await caducado(sesionCaducada({ metadata: { items: '[]' } }));
    assert.deepEqual(res.body, { recibido: true, ignorado: true });
    assert.equal(reserva().estado, 'pendiente');
  });

  test('si falla la base de datos, 500 para que Stripe reintente', async () => {
    fake.fallos['reservas.update'] = { message: 'conexión perdida' };
    const res = await caducado(sesionCaducada());
    assert.equal(res.status, 500);
  });
});

describe('página de éxito (confirmar-sesion) de una reserva', () => {
  test('confirmada: lo dice, con el total', async () => {
    const res = await volverDelPago();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      success: true,
      tipo: 'reserva',
      estado: 'confirmada',
      message: 'Reserva confirmada. Te hemos enviado los detalles por email.',
      total: 75
    });
  });

  test('conflicto: le dice que se le devolverá el importe', async () => {
    instalar([provisional({ estado: 'cancelada' })]);
    const res = await volverDelPago();
    assert.equal(res.body.estado, 'conflicto');
    assert.equal(
      res.body.message,
      'Hemos recibido tu pago, pero esas fechas ya no estaban libres. Te devolveremos el importe y te escribiremos por email.'
    );
  });

  test('si no se puede registrar ahora: "estamos confirmando", nunca un error de pago', async () => {
    fake.fallos['reservas.select'] = { message: 'conexión perdida' };
    const res = await volverDelPago();
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'procesando');
    assert.equal(
      res.body.message,
      'Pago recibido. Estamos confirmando tu reserva y te llegará un email en cuanto esté.'
    );
  });

  test('una reserva que no existe: también "estamos confirmando" (el administrador ya tiene el aviso)', async () => {
    const res = await volverDelPago(
      sesionPagada({ metadata: { tipo: 'reserva', reserva_id: OTRA } })
    );
    assert.equal(res.body.estado, 'procesando');
  });
});
