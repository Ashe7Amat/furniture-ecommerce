// «Devolver fianza», POST /api/admin/reservas/:id/devolver-fianza (R-e, paso 18; 6.6, opción A): tras
// la recogida, devolver la fianza entera o retener una parte con su motivo, con un reembolso parcial
// del pago en Stripe y las tres capas del 8.6 (reclamar, reembolsar, guardar). También la etiqueta y
// la acción que ve el panel, el registro de actividad y el correo al cliente. Supabase y Stripe son
// dobles y el correo, un mock: no se mueve dinero ni se envía nada de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const email = require('../utils/email');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const {
  claveDeFianza,
  MENSAJE_FIANZA_A_MEDIAS,
  MENSAJE_FIANZA_RECHAZADA
} = require('../utils/adminReservas');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const RESERVA = uuid(101);

const TOKEN_ADMIN = jwt.sign(
  { sub: 'admin-1', email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

// Un alquiler recogido con su fianza de 30 € cobrada (130 € en total).
const devuelta = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SOFA,
  pedido_id: 'a1b2c3d4-0000-4000-8000-000000000001',
  tipo: 'alquiler',
  estado: 'devuelta',
  origen: 'web',
  fecha_inicio: dia(-10),
  hora_entrega: '10:00:00',
  fecha_fin: dia(-2),
  hora_recogida: '10:00:00',
  fin_ocupacion: dia(-2),
  dias_margen: 0,
  cliente_id: uuid(900),
  modo_entrega: 'tienda',
  modo_devolucion: 'tienda',
  datos_contacto: { nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456' },
  importe_total: 130,
  fianza_importe: 30,
  fianza_estado: 'garantizada',
  stripe_payment_intent_id: 'pi_123',
  entregada_en: `${dia(-10)}T10:00:00.000Z`,
  devuelta_en: `${dia(-2)}T10:00:00.000Z`,
  historial: [{ fecha: '2026-10-01T10:00:00.000Z', tipo: 'creada', por: 'cliente' }],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});

let fake;
const instalar = (reservas = [devuelta()]) => {
  fake = crearFakeSupabase({
    muebles: [{ id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' }],
    reservas
  });
  mock.method(supabase, 'from', fake.from);
};

let stripe;
let correo;
let errores;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  errores = mock.method(console, 'error', () => {});
  mock.method(console, 'log', () => {});
  let n = 0;
  stripe = {
    refunds: {
      create: mock.fn(async (datos) => ({
        id: `re_${++n}`,
        status: 'succeeded',
        amount: datos.amount,
        metadata: datos.metadata
      })),
      list: mock.fn(async () => ({ data: [], has_more: false }))
    }
  };
  mock.method(stripeUtil, 'getStripe', () => stripe);
  correo = mock.method(email, 'enviarDevolucionFianza', async () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

const devolver = (cuerpo = {}) =>
  request(app)
    .post(`/api/admin/reservas/${RESERVA}/devolver-fianza`)
    .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
    .send(cuerpo);
const fila = () => fake.tablas.reservas.find((r) => r.id === RESERVA);
const auditoria = () => (fake.tablas.audit_log || []).filter((r) => r.accion === 'resolver_fianza');

describe('lo que ve el panel', () => {
  const lista = async () => {
    const res = await request(app)
      .get('/api/admin/reservas?vista=todas')
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`);
    return res.body.reservas[0];
  };

  test('una devuelta con la fianza cobrada: «fianza por resolver» y la acción devolver-fianza', async () => {
    const r = await lista();
    assert.equal(r.etiqueta, 'Devuelta · fianza por resolver');
    assert.deepEqual(r.acciones, ['devolver-fianza']);
    assert.deepEqual(r.fianza, {
      importe: 30,
      estado: 'garantizada',
      retenido: null,
      motivo_retencion: null
    });
  });

  test('cada estado de la fianza con su etiqueta, y la acción solo mientras está por resolver', async () => {
    for (const [estado, etiqueta, acciones] of [
      ['en_resolucion', 'Devuelta · fianza a medias', ['devolver-fianza']],
      ['liberada', 'Devuelta · fianza devuelta', []],
      ['cobrada_parcial', 'Devuelta · fianza devuelta en parte', []],
      ['cobrada', 'Devuelta · fianza retenida', []],
      ['no_aplica', 'Devuelta', []],
      [null, 'Devuelta', []]
    ]) {
      instalar([devuelta({ fianza_estado: estado })]);
      const r = await lista();
      assert.equal(r.etiqueta, etiqueta, String(estado));
      assert.deepEqual(r.acciones, acciones, String(estado));
    }
  });

  test('antes de la recogida no se puede: 409', async () => {
    instalar([devuelta({ estado: 'en_curso', devuelta_en: null })]);
    const res = await devolver();
    assert.equal(res.status, 409);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
  });
});

describe('devolverla entera', () => {
  test('reembolsa la fianza en Stripe con su marca y clave, la deja liberada y avisa al cliente', async () => {
    const res = await devolver();
    assert.equal(res.status, 200);

    const [[datos, opciones]] = stripe.refunds.create.mock.calls.map((c) => c.arguments);
    assert.deepEqual(datos, {
      payment_intent: 'pi_123',
      amount: 3000,
      metadata: { reserva_id: RESERVA, tipo: 'devolucion_fianza' }
    });
    assert.deepEqual(opciones, { idempotencyKey: claveDeFianza(RESERVA) });

    assert.equal(fila().fianza_estado, 'liberada');
    assert.equal(fila().fianza_stripe_ref, 're_1');
    assert.deepEqual(
      fila()
        .historial.slice(-2)
        .map((l) => [l.tipo, l.detalle]),
      [
        ['fianza_en_resolucion', 'Fianza: se devuelve entera (30,00 €).'],
        ['fianza_resuelta', 'Fianza devuelta en Stripe: 30,00 € (re_1).']
      ]
    );
    assert.equal(res.body.reserva.etiqueta, 'Devuelta · fianza devuelta');
    assert.deepEqual(res.body.reserva.acciones, []);

    const [
      {
        arguments: [aviso]
      }
    ] = correo.mock.calls;
    assert.equal(aviso.email, 'ana@ejemplo.com');
    assert.equal(aviso.reserva.pieza, 'Sofá Lumina');
    assert.deepEqual(
      {
        fianza: aviso.fianza,
        devuelto: aviso.devuelto,
        retenido: aviso.retenido,
        motivo: aviso.motivo
      },
      { fianza: 30, devuelto: 30, retenido: 0, motivo: null }
    );
  });

  test('queda en el registro de actividad: quién, cuánto y el reembolso', async () => {
    await devolver();
    const [registro] = auditoria();
    assert.equal(registro.admin_email, 'admin@test.com');
    assert.equal(registro.entidad, 'reservas');
    assert.equal(registro.entidad_id, RESERVA);
    // calcularDiff (utils/audit.js) apunta como null lo que antes no existía.
    assert.deepEqual(registro.datos_anteriores, {
      fianza_estado: 'garantizada',
      devuelto: null,
      retenido: null,
      motivo_retencion: null,
      refund_id: null
    });
    assert.deepEqual(registro.datos_nuevos, {
      fianza_estado: 'liberada',
      devuelto: 30,
      retenido: 0,
      motivo_retencion: null,
      refund_id: 're_1'
    });
  });

  test('una segunda vez: 409, sin otro reembolso ni otro correo', async () => {
    await devolver();
    const res = await devolver();
    assert.equal(res.status, 409);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    assert.equal(correo.mock.callCount(), 1);
  });

  test('dos clics a la vez: un solo reembolso', async () => {
    const respuestas = await Promise.all([devolver(), devolver()]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
  });
});

describe('retener una parte', () => {
  test('devuelve el resto, guarda lo retenido y el motivo, y se lo cuenta al cliente', async () => {
    const res = await devolver({ retener_centimos: 1250, motivo_retencion: 'Arañazo en la pata' });
    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.calls[0].arguments[0].amount, 1750);
    assert.equal(fila().fianza_estado, 'cobrada_parcial');
    assert.equal(
      fila().historial.at(-2).detalle,
      'Fianza: se devuelven 17,50 € y se retienen 12,50 €. Motivo: Arañazo en la pata.'
    );
    assert.deepEqual(res.body.reserva.fianza, {
      importe: 30,
      estado: 'cobrada_parcial',
      retenido: 12.5,
      motivo_retencion: 'Arañazo en la pata'
    });
    const aviso = correo.mock.calls[0].arguments[0];
    assert.deepEqual(
      [aviso.devuelto, aviso.retenido, aviso.motivo],
      [17.5, 12.5, 'Arañazo en la pata']
    );
    assert.equal(auditoria()[0].datos_nuevos.motivo_retencion, 'Arañazo en la pata');
  });

  test('retenerla entera no mueve dinero: cobrada', async () => {
    const res = await devolver({ retener_centimos: 3000, motivo_retencion: 'Pieza rota' });
    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(fila().fianza_estado, 'cobrada');
    assert.equal(fila().fianza_stripe_ref, undefined);
    assert.equal(fila().historial.at(-1).detalle, 'Fianza retenida entera (30,00 €).');
    assert.equal(correo.mock.calls[0].arguments[0].devuelto, 0);
  });

  test('más que la fianza: 400 sin tocar nada', async () => {
    const res = await devolver({ retener_centimos: 3001, motivo_retencion: 'x' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'No se puede retener más que la fianza (30,00 €).');
    assert.equal(fila().fianza_estado, 'garantizada');
  });

  test('sin motivo, negativa o con decimales: 400 en castellano', async () => {
    for (const [cuerpo, mensaje] of [
      [{ retener_centimos: 500 }, 'Escribe el motivo por el que retienes parte de la fianza.'],
      [
        { retener_centimos: 500, motivo_retencion: '   ' },
        'Escribe el motivo por el que retienes parte de la fianza.'
      ],
      [{ retener_centimos: -1 }, 'Lo que se retiene no puede ser negativo.'],
      [{ retener_centimos: 12.5 }, 'Lo que se retiene tiene que ser un número entero de céntimos.']
    ]) {
      const res = await devolver(cuerpo);
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      assert.equal(res.body.error, mensaje);
    }
    assert.equal(fake.escrituras.length, 0);
  });
});

describe('cuando Stripe falla (8.6)', () => {
  test('queda a medias (502) y la misma acción la termina con lo decidido, sin repetirla', async () => {
    stripe.refunds.create = mock.fn(async () => {
      throw new Error('Stripe no responde');
    });
    const primera = await devolver({ retener_centimos: 1000, motivo_retencion: 'Mancha' });
    assert.equal(primera.status, 502);
    assert.equal(primera.body.error, MENSAJE_FIANZA_A_MEDIAS);
    assert.equal(primera.body.codigo, 'reembolso_a_medias');
    assert.equal(primera.body.reserva.etiqueta, 'Devuelta · fianza a medias');
    assert.equal(fila().fianza_estado, 'en_resolucion');
    assert.ok(errores.mock.calls.some((c) => /\[ALERTA\]/.test(c.arguments[0])));
    assert.equal(correo.mock.callCount(), 0);

    stripe.refunds.create = mock.fn(async (datos) => ({
      id: 're_ok',
      status: 'succeeded',
      ...datos
    }));
    // Lo que se mande al reintentar no cuenta: vale lo decidido la primera vez.
    const segunda = await devolver({ retener_centimos: 0 });
    assert.equal(segunda.status, 200);
    assert.equal(stripe.refunds.create.mock.calls[0].arguments[0].amount, 2000);
    assert.equal(fila().fianza_estado, 'cobrada_parcial');
    assert.equal(correo.mock.calls[0].arguments[0].motivo, 'Mancha');
  });

  test('al reintentar, si la devolución ya estaba hecha en Stripe, no crea otra', async () => {
    instalar([
      devuelta({
        fianza_estado: 'en_resolucion',
        historial: [
          {
            fecha: '2026-10-10T10:00:00.000Z',
            tipo: 'fianza_en_resolucion',
            por: 'admin',
            retener_centimos: 0,
            motivo_retencion: null
          }
        ]
      })
    ]);
    stripe.refunds.list = mock.fn(async () => ({
      data: [
        {
          id: 're_otro',
          status: 'succeeded',
          metadata: { reserva_id: RESERVA, tipo: 'reembolso_cancelacion' }
        },
        {
          id: 're_hecho',
          status: 'succeeded',
          metadata: { reserva_id: RESERVA, tipo: 'devolucion_fianza' }
        }
      ],
      has_more: false
    }));
    const res = await devolver();
    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(fila().fianza_stripe_ref, 're_hecho');
    assert.equal(fila().fianza_estado, 'liberada');
  });

  test('si el anterior falló en Stripe, el nuevo va con otra clave', async () => {
    instalar([
      devuelta({
        fianza_estado: 'en_resolucion',
        historial: [{ tipo: 'fianza_en_resolucion', por: 'admin', retener_centimos: 0 }]
      })
    ]);
    stripe.refunds.list = mock.fn(async () => ({
      data: [
        {
          id: 're_fallido',
          status: 'failed',
          metadata: { reserva_id: RESERVA, tipo: 'devolucion_fianza' }
        }
      ],
      has_more: false
    }));
    await devolver();
    assert.deepEqual(stripe.refunds.create.mock.calls[0].arguments[1], {
      idempotencyKey: `${claveDeFianza(RESERVA)}_2`
    });
  });

  test('si Stripe la rechaza: 502 con el aviso de revisarla, sigue a medias', async () => {
    stripe.refunds.create = mock.fn(async () => {
      const error = new Error('Charge already refunded');
      error.type = 'StripeInvalidRequestError';
      throw error;
    });
    const res = await devolver();
    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_FIANZA_RECHAZADA);
    assert.equal(fila().fianza_estado, 'en_resolucion');
  });

  test('un reembolso que Stripe devuelve como fallido también es un rechazo', async () => {
    stripe.refunds.create = mock.fn(async () => ({ id: 're_x', status: 'failed' }));
    const res = await devolver();
    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_FIANZA_RECHAZADA);
  });

  test('sin Stripe configurado: a medias', async () => {
    mock.method(stripeUtil, 'getStripe', () => null);
    const res = await devolver();
    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_FIANZA_A_MEDIAS);
  });

  test('hecha en Stripe y sin poder guardarla: 502 a medias, y el reintento la encuentra', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.fianza_stripe_ref ? { message: 'conexión perdida' } : null;
    const primera = await devolver();
    assert.equal(primera.status, 502);
    assert.equal(fila().fianza_estado, 'en_resolucion');

    delete fake.fallos['reservas.update'];
    const hechos = stripe.refunds.create.mock.calls.map((c, i) => ({
      id: `re_${i + 1}`,
      status: 'succeeded',
      metadata: c.arguments[0].metadata
    }));
    stripe.refunds.list = mock.fn(async () => ({ data: hechos, has_more: false }));
    const segunda = await devolver();
    assert.equal(segunda.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    assert.equal(fila().fianza_stripe_ref, 're_1');
  });
});
