const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const RESERVA = uuid(10);

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

describe('Endpoints PATCH dedicados para entrega y recogida de reservas (R-d)', () => {
  let fake;

  beforeEach(() => {
    process.env.RESERVAS_ACTIVAS = 'true';
    fake = crearFakeSupabase({
      muebles: [{ id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' }],
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
        }
      ]
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
});
