// Panel de reservas: el dinero de una reserva web después de pagarla (docs/reservas-diseno.md, 6.4,
// 8.4 y 8.6; ajustes del 19 oct). Lo que pasa cuando el administrador la cancela y el cliente vuelve
// a la página de éxito o Stripe repite el webhook, el tope de lo que Stripe deja devolver, los
// reembolsos que Stripe rechaza o que se hicieron fuera del panel, y «Dar por reembolsado». Supabase
// y Stripe son dobles; el webhook va firmado de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secreto_de_prueba';
process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { crearEventoCompletado, firmarEvento } = require('./helpers/stripeFixtures');
const { idPedidoDeSesion } = require('../utils/pagos');
const { situacion, claveDeReembolso } = require('../utils/adminReservas');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const SILLA = '00000000-0000-4000-8000-000000000001';
const RESERVA = '00000000-0000-4000-8000-0000000000f1';
const ANA = '00000000-0000-4000-8000-0000000000a1';
const PAGO = 'pi_reserva_1';
const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const MENSAJE_CANCELADA = 'Esta reserva está cancelada. Si tienes cualquier duda, escríbenos.';
const MENSAJE_RECHAZADO =
  'Stripe no ha aceptado el reembolso. Revísalo en el Dashboard de Stripe; si lo devuelves allí, ' +
  'usa «Dar por reembolsado».';
const MENSAJE_SIN_GUARDAR =
  'El reembolso ya está hecho en Stripe, pero no se ha podido guardar. Pulsa «Reintentar ' +
  'reembolso» para guardarlo; no lo repitas desde el Dashboard.';
const MENSAJE_A_MEDIAS =
  'La reserva está cancelada, pero el reembolso no se ha podido hacer. Usa «Reintentar reembolso».';
const MENSAJE_SIN_A_MEDIAS = 'Esta reserva no tiene ningún reembolso a medias.';
const LINEA_DADO_POR_HECHO =
  'Reembolso dado por hecho desde el panel: se hizo fuera, en el Dashboard de Stripe.';

// La reserva provisional tal como la deja POST /api/reservas/sesion-pago.
const provisional = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SILLA,
  tipo: 'alquiler',
  estado: 'pendiente',
  origen: 'web',
  fecha_inicio: dia(10),
  hora_entrega: '10:00:00',
  fecha_fin: dia(13),
  hora_recogida: '10:00:00',
  fin_ocupacion: dia(13),
  dias_margen: 2,
  cliente_id: ANA,
  expira_en: new Date(Date.now() + 30 * 60_000).toISOString(),
  stripe_session_id: 'cs_reserva_1',
  modo_entrega: 'tienda',
  modo_devolucion: 'tienda',
  datos_contacto: { nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456' },
  importe_alquiler: 75,
  importe_envio: 0,
  importe_total: 75,
  precio_desglose: { dias: 3 },
  historial: [],
  ...cambios
});
// La misma, ya confirmada con su pago (lo que deja procesarReservaPagada).
const confirmada = (cambios = {}) =>
  provisional({
    estado: 'confirmada',
    expira_en: null,
    stripe_payment_intent_id: PAGO,
    pedido_id: idPedidoDeSesion('cs_reserva_1'),
    confirmacion_enviada_en: '2026-10-01T10:00:00.000Z',
    ...cambios
  });
// Cancelada desde el panel con el reembolso reclamado y sin hacer (8.6, "a medias").
const SOLICITADO_EN = '2026-10-10T10:00:00.000Z';
const SOLICITADO_EN_S = Date.parse(SOLICITADO_EN) / 1000;
const aMedias = (cambios = {}) =>
  confirmada({
    estado: 'cancelada',
    cancelada_por: 'admin',
    cancelada_en: SOLICITADO_EN,
    reembolso_solicitado_en: SOLICITADO_EN,
    reembolso_importe: 37.5,
    ...cambios
  });

const sesion = {
  id: 'cs_reserva_1',
  object: 'checkout.session',
  payment_status: 'paid',
  status: 'complete',
  amount_total: 7500,
  payment_intent: PAGO,
  metadata: { tipo: 'reserva', reserva_id: RESERVA }
};

let fake;
const instalar = (reservas) => {
  fake = crearFakeSupabase({
    muebles: [
      { id: SILLA, nombre: 'Silla Thonet', referencia: 'NAV-SIL-001', estado: 'disponible' }
    ],
    reservas
  });
  mock.method(supabase, 'from', fake.from);
};

// Stripe: los reembolsos que se crean quedan en `reembolsos`, como los vería refunds.list.
let stripe;
let reembolsos;
let correos;
let registroErrores;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  reembolsos = [];
  stripe = {
    refunds: {
      create: mock.fn(async (datos, opciones) => {
        const refund = {
          id: `re_${reembolsos.length + 1}`,
          amount: datos.amount,
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
          metadata: datos.metadata,
          clave: opciones.idempotencyKey
        };
        reembolsos.unshift(refund);
        return refund;
      }),
      list: mock.fn(async () => ({ data: reembolsos, has_more: false }))
    },
    paymentIntents: {
      retrieve: mock.fn(async (id) => ({ id, amount_received: 7500, status: 'succeeded' }))
    },
    checkout: { sessions: { retrieve: async () => sesion } }
  };
  mock.method(stripeUtil, 'getStripe', () => stripe);
  correos = {
    confirmacion: mock.method(email, 'enviarConfirmacionReserva', async () => {}),
    conflicto: mock.method(email, 'enviarConflictoReserva', async () => {}),
    alerta: mock.method(email, 'enviarAlertaAdmin', async () => {})
  };
  registroErrores = mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  instalar([provisional()]);
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

const accion = (nombre, cuerpo = {}) =>
  request(app)
    .post(`/api/admin/reservas/${RESERVA}/${nombre}`)
    .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
    .send(cuerpo);
const lista = (vista) =>
  request(app)
    .get(`/api/admin/reservas?vista=${vista}`)
    .set('Authorization', `Bearer ${TOKEN_ADMIN}`);
const webhook = () => {
  const { payload, cabecera } = firmarEvento(crearEventoCompletado(sesion));
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', cabecera)
    .send(payload);
};
let ip = 0;
const volverDelPago = () => {
  ip += 1;
  return request(app)
    .get('/api/muebles/confirmar-sesion?session_id=cs_reserva_1')
    .set('X-Forwarded-For', `10.7.0.${ip}`);
};
const fila = () => fake.tablas.reservas.find((r) => r.id === RESERVA);
const correosEnviados = () =>
  correos.confirmacion.mock.callCount() +
  correos.conflicto.mock.callCount() +
  correos.alerta.mock.callCount();
const errorStripe = (tipo, mensaje) => Object.assign(new Error(mensaje), { type: tipo });

describe('una reserva pagada y cancelada después desde el panel (6.4)', () => {
  const pagarYCancelar = async (reembolso) => {
    assert.equal((await webhook()).body.estado, 'confirmada');
    const cancelacion = await accion('cancelar', {
      motivo: 'Lo pide el cliente',
      reembolso_centimos: reembolso
    });
    assert.equal(cancelacion.status, 200);
    return correosEnviados();
  };

  for (const reembolso of [3750, 0]) {
    test(`con ${reembolso ? 'reembolso' : 'nada que devolver'}: la página de éxito dice que está cancelada, sin conflicto ni emails`, async () => {
      const antes = await pagarYCancelar(reembolso);

      const exito = await volverDelPago();
      assert.equal(exito.status, 200);
      assert.deepEqual(exito.body, {
        success: true,
        tipo: 'reserva',
        estado: 'cancelada',
        message: MENSAJE_CANCELADA,
        total: 75
      });
      const repetido = await webhook();
      assert.equal(repetido.status, 200);
      assert.deepEqual(repetido.body, { recibido: true, estado: 'cancelada' });

      assert.equal(fila().conflicto_en ?? null, null);
      assert.equal(fila().estado, 'cancelada');
      assert.equal(correosEnviados(), antes, 'ni aviso de conflicto ni confirmación');
      assert.equal(correos.conflicto.mock.callCount(), 0);
      assert.equal(fake.tablas.pedidos.length, 1);
      assert.deepEqual(
        stripe.refunds.create.mock.calls.map((c) => c.arguments[0].amount),
        reembolso ? [reembolso] : []
      );

      const [item] = (await lista('todas')).body.reservas;
      assert.equal(item.en_conflicto, false);
      assert.equal(item.etiqueta, 'Cancelada');
      assert.deepEqual(item.acciones, []);
      assert.deepEqual((await lista('conflicto')).body.reservas, []);
    });
  }

  test('con el reembolso a medias: sigue a medias, con sus acciones, y «Reintentar» devuelve lo decidido una vez', async () => {
    assert.equal((await webhook()).body.estado, 'confirmada');
    const crear = stripe.refunds.create;
    stripe.refunds.create = mock.fn(async () => {
      throw errorStripe('StripeConnectionError', 'timeout');
    });
    const cancelacion = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });
    assert.equal(cancelacion.status, 502);
    assert.equal(cancelacion.body.error, MENSAJE_A_MEDIAS);
    const antes = correosEnviados();

    assert.equal((await volverDelPago()).body.estado, 'cancelada');
    assert.equal((await webhook()).body.estado, 'cancelada');
    assert.equal(fila().conflicto_en ?? null, null);
    assert.equal(correosEnviados(), antes);
    const [item] = (await lista('reembolsos')).body.reservas;
    assert.equal(item.etiqueta, 'Cancelada · reembolso a medias');
    assert.deepEqual(item.acciones, ['reintentar-reembolso', 'dar-por-reembolsado']);

    stripe.refunds.create = crear;
    const reintento = await accion('reintentar-reembolso');
    assert.equal(reintento.status, 200);
    assert.equal(reintento.body.reserva.reembolso_a_medias, false);
    assert.deepEqual(
      reembolsos.map((r) => r.amount),
      [3750]
    );
  });

  test('ya entregada cuando vuelve a la página de éxito: como confirmada, sin emails', async () => {
    instalar([confirmada({ estado: 'en_curso', entregada_en: new Date().toISOString() })]);
    const exito = await volverDelPago();
    assert.equal(exito.body.estado, 'confirmada');
    assert.equal(correosEnviados(), 0);
    assert.equal(fila().conflicto_en ?? null, null);
  });

  test('una provisional que se canceló sin pagar (el cliente empezó otra) sigue siendo un conflicto', async () => {
    instalar([provisional({ estado: 'cancelada', cancelada_por: 'sistema' })]);
    const exito = await volverDelPago();
    assert.equal(exito.body.estado, 'conflicto');
    assert.ok(fila().conflicto_en);
    assert.equal(correos.conflicto.mock.callCount(), 1);
  });

  test('el conflicto no esconde «Reintentar» ni «Dar por reembolsado» de un reembolso a medias', () => {
    const contexto = { hoy, ahora: new Date() };
    assert.deepEqual(situacion(aMedias({ conflicto_en: '2026-10-11T10:00:00.000Z' }), contexto), {
      etiqueta: 'Cancelada · reembolso a medias',
      acciones: ['reintentar-reembolso', 'dar-por-reembolsado']
    });
    assert.deepEqual(
      situacion(
        provisional({ estado: 'expirada', conflicto_en: '2026-10-11T10:00:00.000Z' }),
        contexto
      ),
      { etiqueta: 'No se pudo confirmar', acciones: [] }
    );
  });

  test('con conflicto_en de antes y el reembolso a medias, «Reintentar» funciona', async () => {
    instalar([aMedias({ conflicto_en: '2026-10-11T10:00:00.000Z' })]);
    const res = await accion('reintentar-reembolso');
    assert.equal(res.status, 200);
    assert.equal(fila().stripe_refund_id, 're_1');
  });
});

describe('cancelar: el tope de Stripe y sus rechazos (8.4, 8.6)', () => {
  beforeEach(() => instalar([confirmada()]));

  test('no pide más de lo que Stripe deja devolver de ese pago: 400 y nada cambia', async () => {
    reembolsos.push(
      { id: 're_dash', amount: 2000, status: 'succeeded', created: SOLICITADO_EN_S, metadata: {} },
      { id: 're_fallido', amount: 3000, status: 'failed', created: SOLICITADO_EN_S, metadata: {} },
      { id: 're_anulado', amount: 1000, status: 'canceled', created: SOLICITADO_EN_S, metadata: {} }
    );

    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 5501 });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Stripe solo permite devolver 55,00 € de este pago.' });
    assert.equal(fila().estado, 'confirmada');
    assert.equal(fila().reembolso_solicitado_en, undefined);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.deepEqual(stripe.paymentIntents.retrieve.mock.calls[0].arguments, [PAGO]);
    assert.deepEqual(stripe.refunds.list.mock.calls[0].arguments[0], {
      payment_intent: PAGO,
      limit: 100
    });

    const justo = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 5500 });
    assert.equal(justo.status, 200);
    assert.equal(stripe.refunds.create.mock.calls[0].arguments[0].amount, 5500);
  });

  test('sin reembolso no pregunta nada a Stripe', async () => {
    assert.equal(
      (await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 0 })).status,
      200
    );
    assert.equal(stripe.paymentIntents.retrieve.mock.callCount(), 0);
    assert.equal(stripe.refunds.list.mock.callCount(), 0);
  });

  test('si no se puede leer el pago en Stripe, cancela igual: el tope lo pone Stripe al reembolsar', async () => {
    stripe.paymentIntents.retrieve = mock.fn(async () => {
      throw errorStripe('StripeConnectionError', 'timeout');
    });
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });
    assert.equal(res.status, 200);
    assert.equal(fila().stripe_refund_id, 're_1');
  });

  test('Stripe rechaza el reembolso (StripeInvalidRequestError): 502 con el aviso del Dashboard y la reserva a medias', async () => {
    stripe.refunds.create = mock.fn(async () => {
      throw errorStripe(
        'StripeInvalidRequestError',
        'Refund amount is greater than unrefunded amount'
      );
    });

    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });

    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_RECHAZADO);
    assert.equal(res.body.reserva.estado, 'cancelada');
    assert.equal(res.body.reserva.reembolso_a_medias, true);
    assert.deepEqual(res.body.reserva.acciones, ['reintentar-reembolso', 'dar-por-reembolsado']);
    assert.ok(!/greater|Refund/.test(res.text), 'nada del detalle de Stripe');
    assert.equal(fila().stripe_refund_id, undefined);
  });

  test('un reembolso que Stripe devuelve fallido no cuenta: 502, a medias, y «Reintentar» crea otro con otra clave', async () => {
    stripe.refunds.create = mock.fn(async (datos, opciones) => {
      const refund = {
        id: 're_fallido',
        amount: datos.amount,
        status: 'failed',
        created: Math.floor(Date.now() / 1000),
        metadata: datos.metadata,
        clave: opciones.idempotencyKey
      };
      reembolsos.unshift(refund);
      return refund;
    });

    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });

    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_RECHAZADO);
    assert.equal(res.body.reserva.reembolso_a_medias, true);
    assert.equal(fila().stripe_refund_id, undefined);
    assert.ok(
      registroErrores.mock.calls.some((c) => String(c.arguments.join(' ')).includes('re_fallido'))
    );

    stripe.refunds.create = mock.fn(async (datos, opciones) => {
      const refund = {
        id: 're_bueno',
        amount: datos.amount,
        status: 'pending',
        created: Math.floor(Date.now() / 1000),
        metadata: datos.metadata
      };
      reembolsos.unshift(refund);
      return { ...refund, clave: opciones.idempotencyKey };
    });
    const reintento = await accion('reintentar-reembolso');

    assert.equal(reintento.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    assert.deepEqual(stripe.refunds.create.mock.calls[0].arguments[1], {
      idempotencyKey: `${claveDeReembolso(RESERVA)}_2`
    });
    assert.equal(fila().stripe_refund_id, 're_bueno');
  });

  test('un reembolso anulado tampoco cuenta', async () => {
    stripe.refunds.create = mock.fn(async () => ({ id: 're_x', status: 'canceled' }));
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });
    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_RECHAZADO);
  });

  test('un fallo pasajero de Stripe sigue siendo «Usa Reintentar reembolso»', async () => {
    stripe.refunds.create = mock.fn(async () => {
      throw errorStripe('StripeAPIError', 'Stripe no responde');
    });
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });
    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_A_MEDIAS);
    assert.equal(res.body.reserva.reembolso_a_medias, true);
  });

  test('hecho en Stripe pero sin guardar: 502 que pide no repetirlo, con la reserva y el id en el log', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.stripe_refund_id ? { message: 'conexión perdida' } : null;

    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });

    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_SIN_GUARDAR);
    assert.equal(res.body.reserva.reembolso_a_medias, true);
    assert.ok(
      registroErrores.mock.calls.some((c) => String(c.arguments.join(' ')).includes('re_1')),
      'el id del reembolso queda en el log'
    );

    delete fake.fallos['reservas.update'];
    const reintento = await accion('reintentar-reembolso');
    assert.equal(reintento.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1, 'lo encuentra y no crea otro');
    assert.equal(fila().stripe_refund_id, 're_1');
  });

  test('sin guardar y sin poder leer la reserva: 502 con el aviso, sin la reserva', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.stripe_refund_id ? { message: 'conexión perdida' } : null;
    let lecturas = 0;
    fake.fallos['reservas.select'] = () => {
      lecturas += 1;
      // La lectura del tope y la de la cancelación van bien; las de después, no.
      return lecturas > 2 ? { message: 'conexión perdida' } : null;
    };
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 3750 });
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { error: MENSAJE_SIN_GUARDAR });
  });
});

describe('reintentar el reembolso: los que no son del panel y los fallidos (8.6)', () => {
  beforeEach(() => instalar([aMedias()]));
  const externo = (cambios = {}) => ({
    id: 're_dashboard',
    amount: 3750,
    status: 'succeeded',
    created: SOLICITADO_EN_S + 3600,
    metadata: {},
    ...cambios
  });

  test('si el pago ya tiene un reembolso hecho fuera del panel después de cancelar: 409 y no crea nada', async () => {
    reembolsos.push(externo());

    const res = await accion('reintentar-reembolso');

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        'Este pago ya tiene un reembolso de 37,50 € hecho fuera del panel. Si con él ya está ' +
        'todo devuelto, usa «Dar por reembolsado».'
    });
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(fila().stripe_refund_id, undefined);
  });

  test('tampoco si está pendiente; los de antes de cancelar y los fallidos o anulados no cuentan', async () => {
    reembolsos.push(externo({ amount: 1000, status: 'pending' }));
    assert.equal((await accion('reintentar-reembolso')).status, 409);

    reembolsos.length = 0;
    reembolsos.push(
      externo({ id: 're_antes', created: SOLICITADO_EN_S - 60 }),
      externo({ id: 're_fallido', status: 'failed' }),
      externo({ id: 're_anulado', status: 'canceled' })
    );
    const res = await accion('reintentar-reembolso');
    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    assert.equal(stripe.refunds.create.mock.calls[0].arguments[0].amount, 3750);
  });

  test('si Stripe rechaza el reintento: 502 con el aviso del Dashboard', async () => {
    stripe.refunds.create = mock.fn(async () => {
      throw errorStripe('StripeInvalidRequestError', 'Charge has already been refunded');
    });
    const res = await accion('reintentar-reembolso');
    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_RECHAZADO);
    assert.equal(res.body.reserva.reembolso_a_medias, true);
  });
});

describe('dar por reembolsado (8.6, 19 oct)', () => {
  test('cierra el reembolso a medias sin mover dinero, con su línea en el historial', async () => {
    instalar([aMedias()]);

    const res = await accion('dar-por-reembolsado');

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body), ['reserva']);
    assert.equal(res.body.reserva.reembolso_a_medias, false);
    assert.equal(res.body.reserva.etiqueta, 'Cancelada');
    assert.deepEqual(res.body.reserva.acciones, []);
    const linea = fila().historial.at(-1);
    assert.equal(linea.tipo, 'reembolso_dado_por_hecho');
    assert.equal(linea.detalle, LINEA_DADO_POR_HECHO);
    assert.equal(linea.por, 'admin');
    assert.equal(fila().stripe_refund_id, undefined);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(stripe.refunds.list.mock.callCount(), 0);
    assert.deepEqual((await lista('reembolsos')).body.reservas, []);

    // Ya no está a medias: ni otro «Dar por reembolsado» ni «Reintentar».
    assert.deepEqual((await accion('dar-por-reembolsado')).body, { error: MENSAJE_SIN_A_MEDIAS });
    assert.equal((await accion('reintentar-reembolso')).status, 409);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
  });

  test('solo con un reembolso a medias: 409 en cualquier otro caso, sin escribir', async () => {
    for (const reserva of [
      aMedias({ stripe_refund_id: 're_hecho' }),
      confirmada({ estado: 'cancelada' }),
      confirmada()
    ]) {
      instalar([reserva]);
      const res = await accion('dar-por-reembolsado');
      assert.equal(res.status, 409);
      assert.deepEqual(res.body, { error: MENSAJE_SIN_A_MEDIAS });
      assert.equal(fake.escrituras.length, 0);
    }
  });

  test('aparece en las acciones solo cuando el reembolso está a medias', () => {
    const contexto = { hoy, ahora: new Date() };
    assert.deepEqual(situacion(aMedias(), contexto).acciones, [
      'reintentar-reembolso',
      'dar-por-reembolsado'
    ]);
    for (const reserva of [
      aMedias({ stripe_refund_id: 're_1' }),
      confirmada(),
      confirmada({ estado: 'cancelada' })
    ]) {
      assert.ok(!situacion(reserva, contexto).acciones.includes('dar-por-reembolsado'));
    }
  });

  test('dos clics a la vez: uno lo cierra y el otro recibe 409; una sola línea', async () => {
    instalar([aMedias()]);
    const respuestas = await Promise.all([
      accion('dar-por-reembolsado'),
      accion('dar-por-reembolsado')
    ]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
    assert.equal(fila().historial.filter((l) => l.tipo === 'reembolso_dado_por_hecho').length, 1);
  });

  test('un cuerpo que no es un objeto: 400 en castellano', async () => {
    instalar([aMedias()]);
    const res = await request(app)
      .post(`/api/admin/reservas/${RESERVA}/dar-por-reembolsado`)
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
      .set('Content-Type', 'application/json')
      .send('[]');
    assert.equal(res.status, 400);
    assert.ok(!/expected|received/i.test(res.body.error), res.body.error);
  });
});
