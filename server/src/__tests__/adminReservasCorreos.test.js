// Los correos al cliente de las acciones del panel (R-e, paso 20): la cancelación de un alquiler y el
// reembolso hecho (al cancelar, al reintentar o al darlo por reembolsado con Stripe conforme). Solo a
// alquileres con email y que no sean de un contrato antiguo; nunca dos veces el del reembolso.
// Supabase y Stripe son dobles y los correos, mocks: no se envía nada de verdad.
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
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const RESERVA = uuid(101);

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const alquiler = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SOFA,
  pedido_id: 'a1b2c3d4-0000-4000-8000-000000000001',
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(5),
  hora_entrega: '10:00:00',
  fecha_fin: dia(8),
  hora_recogida: '18:30:00',
  fin_ocupacion: dia(8),
  dias_margen: 1,
  cliente_id: uuid(900),
  modo_entrega: 'tienda',
  modo_devolucion: 'tienda',
  datos_contacto: { nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456' },
  importe_total: 120.5,
  stripe_payment_intent_id: 'pi_123',
  historial: [{ fecha: '2026-10-01T10:00:00.000Z', tipo: 'creada', por: 'cliente' }],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});

let fake;
const instalar = (reservas) => {
  fake = crearFakeSupabase({
    muebles: [{ id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' }],
    reservas
  });
  mock.method(supabase, 'from', fake.from);
};

let stripe;
let correos;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  mock.method(console, 'error', () => {});
  mock.method(console, 'log', () => {});
  stripe = {
    refunds: {
      create: mock.fn(async () => ({ id: 're_1', status: 'succeeded' })),
      list: mock.fn(async () => ({ data: [], has_more: false }))
    },
    paymentIntents: {
      retrieve: mock.fn(async (id) => ({ id, amount_received: 12050, status: 'succeeded' }))
    }
  };
  mock.method(stripeUtil, 'getStripe', () => stripe);
  correos = {
    cancelacion: mock.method(email, 'enviarCancelacionReserva', async () => {}),
    reembolso: mock.method(email, 'enviarReembolsoReserva', async () => {})
  };
  instalar([alquiler()]);
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
const argumentos = (mockFn) => mockFn.mock.calls.map((c) => c.arguments[0]);

describe('cancelar', () => {
  test('con reembolso: el correo de la cancelación con lo que se devolverá y luego el del reembolso', async () => {
    const res = await accion('cancelar', { motivo: 'Avería del camión', reembolso_centimos: 5000 });
    assert.equal(res.status, 200);

    const [cancelacion] = argumentos(correos.cancelacion);
    assert.deepEqual(cancelacion, {
      email: 'ana@ejemplo.com',
      nombre: 'Ana Martínez',
      reserva: {
        pedidoId: 'a1b2c3d4-0000-4000-8000-000000000001',
        pieza: 'Sofá Lumina',
        fechaInicio: dia(5),
        horaEntrega: '10:00',
        fechaFin: dia(8),
        horaRecogida: '18:30',
        modoEntrega: 'tienda',
        modoRecogida: 'tienda',
        direccion: undefined
      },
      reembolso: 50
    });
    // El motivo es una nota del panel: no viaja al correo.
    assert.ok(!JSON.stringify(cancelacion).includes('Avería'));
    const [reembolso] = argumentos(correos.reembolso);
    assert.equal(reembolso.reembolso, 50);
    assert.equal(reembolso.email, 'ana@ejemplo.com');
  });

  test('sin reembolso: solo el de la cancelación, con reembolso 0', async () => {
    const res = await accion('cancelar', { motivo: 'Lo pide el cliente', reembolso_centimos: 0 });
    assert.equal(res.status, 200);
    assert.equal(argumentos(correos.cancelacion)[0].reembolso, 0);
    assert.equal(correos.reembolso.mock.callCount(), 0);
  });

  test('si el reembolso falla: la cancelación se cuenta, el reembolso no (todavía)', async () => {
    stripe.refunds.create = mock.fn(async () => {
      throw new Error('Stripe no responde');
    });
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 5000 });
    assert.equal(res.status, 502);
    assert.equal(correos.cancelacion.mock.callCount(), 1);
    assert.equal(correos.reembolso.mock.callCount(), 0);
  });

  test('una cancelación que no se puede hacer (409) no envía nada', async () => {
    instalar([alquiler({ estado: 'cancelada' })]);
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 0 });
    assert.equal(res.status, 409);
    assert.equal(correos.cancelacion.mock.callCount(), 0);
  });

  test('ni a los contratos antiguos, ni sin email, ni por una venta', async () => {
    for (const cambios of [
      { origen: 'legacy' },
      { datos_contacto: { nombre: 'Sin email' } },
      { tipo: 'venta', fecha_fin: null, fin_ocupacion: null, dias_margen: 0, datos_contacto: null }
    ]) {
      instalar([alquiler(cambios)]);
      const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 0 });
      assert.equal(res.status, 200, JSON.stringify(cambios));
    }
    assert.equal(correos.cancelacion.mock.callCount(), 0);
  });

  test('si el correo falla, la cancelación sigue hecha', async () => {
    correos.cancelacion.mock.mockImplementation(async () => {
      throw new Error('Resend caído');
    });
    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 0 });
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.reservas[0].estado, 'cancelada');
  });
});

describe('reintentar y dar por reembolsado', () => {
  const aMedias = () =>
    alquiler({
      estado: 'cancelada',
      cancelada_en: '2026-10-10T10:00:00.000Z',
      reembolso_solicitado_en: '2026-10-10T10:00:00.000Z',
      reembolso_importe: 50
    });

  test('reintentar con éxito: el correo del reembolso, una vez', async () => {
    instalar([aMedias()]);
    const res = await accion('reintentar-reembolso');
    assert.equal(res.status, 200);
    assert.equal(argumentos(correos.reembolso)[0].reembolso, 50);
    // Ya hecho: un segundo reintento es un 409 y no repite el correo.
    const otra = await accion('reintentar-reembolso');
    assert.equal(otra.status, 409);
    assert.equal(correos.reembolso.mock.callCount(), 1);
    assert.equal(correos.cancelacion.mock.callCount(), 0);
  });

  test('reintentar que vuelve a fallar: sin correo', async () => {
    instalar([aMedias()]);
    stripe.refunds.create = mock.fn(async () => {
      throw new Error('Stripe no responde');
    });
    const res = await accion('reintentar-reembolso');
    assert.equal(res.status, 502);
    assert.equal(correos.reembolso.mock.callCount(), 0);
  });

  test('dar por reembolsado con lo devuelto en Stripe: el correo del reembolso', async () => {
    instalar([aMedias()]);
    stripe.refunds.list = mock.fn(async () => ({
      data: [
        {
          id: 're_fuera',
          status: 'succeeded',
          amount: 5000,
          created: Date.parse('2026-10-10T11:00:00Z') / 1000
        }
      ],
      has_more: false
    }));
    const res = await accion('dar-por-reembolsado');
    assert.equal(res.status, 200);
    assert.equal(argumentos(correos.reembolso)[0].reembolso, 50);
  });

  test('dar por reembolsado aunque no conste (otro medio de pago): sin correo, lo cuenta el admin', async () => {
    instalar([aMedias()]);
    const res = await accion('dar-por-reembolsado', { aunque_no_conste: true });
    assert.equal(res.status, 200);
    assert.equal(correos.reembolso.mock.callCount(), 0);
  });
});
