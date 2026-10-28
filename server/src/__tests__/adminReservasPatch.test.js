const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const MESA = uuid(2);
const RESERVA = uuid(10);
const RESERVA_PAGADA = uuid(11);

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

describe('Endpoints R-d: Entrega, Recogida, Cancelación y Bloqueo', () => {
  let fake;
  let stripeMock;

  beforeEach(() => {
    process.env.RESERVAS_ACTIVAS = 'true';
    stripeMock = {
      refunds: {
        create: mock.fn(async ({ payment_intent }) => ({
          id: `re_test_${payment_intent}`,
          status: 'succeeded'
        }))
      }
    };
    mock.method(stripeUtil, 'getStripe', () => stripeMock);

    fake = crearFakeSupabase({
      muebles: [
        { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' },
        { id: MESA, nombre: 'Mesa Bistro', referencia: 'NAV-MES-002', estado: 'disponible' }
      ],
      reservas: [
        {
          id: RESERVA,
          mueble_id: SOFA,
          tipo: 'alquiler',
          estado: 'confirmada',
          fecha_inicio: dia(0),
          fecha_fin: dia(3),
          fin_ocupacion: dia(5),
          importe_total: 100,
          historial: []
        },
        {
          id: RESERVA_PAGADA,
          mueble_id: MESA,
          tipo: 'alquiler',
          estado: 'en_curso',
          fecha_inicio: dia(-1),
          fecha_fin: dia(2),
          fin_ocupacion: dia(4),
          importe_total: 200,
          stripe_payment_intent_id: 'pi_test_123',
          historial: []
        }
      ],
      audit_log: []
    });
    mock.method(supabase, 'from', fake.from);
  });

  afterEach(() => {
    mock.restoreAll();
    delete process.env.RESERVAS_ACTIVAS;
  });

  test('PATCH /api/admin/reservas/:id/entregar actualiza la reserva a en_curso y el mueble a alquilado', async () => {
    const res = await request(app)
      .patch(`/api/admin/reservas/${RESERVA}/entregar`)
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.estado, 'en_curso');
    
    // Verificamos que el mueble pasó a alquilado
    const mueble = fake.tablas.muebles.find(m => m.id === SOFA);
    assert.equal(mueble.estado, 'alquilado');
  });

  test('PATCH /api/admin/reservas/:id/recoger actualiza la reserva a devuelta y el mueble a disponible', async () => {
    // Primero marcamos la reserva en_curso y el mueble alquilado
    fake.tablas.reservas[0].estado = 'en_curso';
    fake.tablas.muebles[0].estado = 'alquilado';

    const res = await request(app)
      .patch(`/api/admin/reservas/${RESERVA}/recoger`)
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.estado, 'devuelta');

    // Verificamos que el mueble pasó a disponible
    const mueble = fake.tablas.muebles.find(m => m.id === SOFA);
    assert.equal(mueble.estado, 'disponible');
  });

  test('POST /api/admin/reservas/:id/cancelar cancela reserva, reembolsa con Stripe, libera mueble y anota en audit_log', async () => {
    // Mueble alquilado porque la reserva pagada está en_curso
    fake.tablas.muebles.find(m => m.id === MESA).estado = 'alquilado';

    const res = await request(app)
      .post(`/api/admin/reservas/${RESERVA_PAGADA}/cancelar`)
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
      .send({ motivo: 'Cancelada por el cliente' });

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.estado, 'cancelada');
    assert.equal(res.body.reembolsado, true);

    // Comprobamos llamada a Stripe refund
    assert.equal(stripeMock.refunds.create.mock.calls.length, 1);
    assert.equal(
      stripeMock.refunds.create.mock.calls[0].arguments[0].payment_intent,
      'pi_test_123'
    );

    // Mueble liberado a disponible (no tiene otras reservas ocupando hoy)
    const mueble = fake.tablas.muebles.find(m => m.id === MESA);
    assert.equal(mueble.estado, 'disponible');

    // Anotado en Audit Log
    const audit = fake.tablas.audit_log.find(
      a => a.entidad === 'reservas' && a.entidad_id === RESERVA_PAGADA
    );
    assert.ok(audit, 'Debe existir entrada en audit_log');
    assert.equal(audit.accion, 'cancelar');
  });

  test('POST /api/admin/reservas/bloqueo crea una reserva de tipo bloqueo', async () => {
    const res = await request(app)
      .post('/api/admin/reservas/bloqueo')
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
      .send({
        mueble_id: SOFA,
        fecha_inicio: dia(10),
        fecha_fin: dia(15),
        motivo: 'Exposición'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.tipo, 'bloqueo');
    assert.equal(res.body.reserva.estado, 'confirmada');
    assert.equal(res.body.reserva.motivo, 'Exposición');
  });
});
