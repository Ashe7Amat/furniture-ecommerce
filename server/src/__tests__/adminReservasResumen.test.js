// Panel de reservas: GET /api/admin/reservas/resumen, el número de la insignia del menú (los avisos
// que no pueden esperar: retrasadas, pagadas sin confirmar y reembolsos a medias). Supabase es el
// doble en memoria; las fechas van relativas a hoy en Madrid, porque el endpoint usa el reloj de verdad.
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

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const TOKEN_CLIENTE = jwt.sign(
  { sub: uuid(900), email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'cliente' },
  process.env.JWT_SECRET
);

const MUEBLES = () => [{ id: SOFA, nombre: 'Sofá Lumina', referencia: null, estado: 'disponible' }];

const alquiler = (cambios = {}) => ({
  id: uuid(101),
  mueble_id: SOFA,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(5),
  hora_entrega: '10:00:00',
  fecha_fin: dia(8),
  hora_recogida: '18:30:00',
  fin_ocupacion: dia(8),
  dias_margen: 2,
  historial: [],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});
const retrasada = (id) =>
  alquiler({
    id: uuid(id),
    estado: 'en_curso',
    fecha_inicio: dia(-9),
    fecha_fin: dia(-1),
    fin_ocupacion: dia(-1),
    entregada_en: '2026-01-01T10:00:00.000Z'
  });
const sinConfirmar = (id) =>
  alquiler({ id: uuid(id), estado: 'expirada', conflicto_en: '2026-10-10T10:00:00.000Z' });
const reembolsoAMedias = (id, cambios = {}) =>
  alquiler({
    id: uuid(id),
    estado: 'cancelada',
    reembolso_solicitado_en: '2026-10-11T10:00:00.000Z',
    reembolso_importe: 50,
    ...cambios
  });

const instalar = (reservas = []) => {
  const fake = crearFakeSupabase({ muebles: MUEBLES(), reservas });
  mock.method(supabase, 'from', fake.from);
  return fake;
};
const resumen = () =>
  request(app).get('/api/admin/reservas/resumen').set('Authorization', `Bearer ${TOKEN_ADMIN}`);

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  mock.method(console, 'error', () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('GET /api/admin/reservas/resumen: acceso', () => {
  test('sin sesión 401; con sesión de cliente 403', async () => {
    assert.equal((await request(app).get('/api/admin/reservas/resumen')).status, 401);
    const cliente = await request(app)
      .get('/api/admin/reservas/resumen')
      .set('Authorization', `Bearer ${TOKEN_CLIENTE}`);
    assert.equal(cliente.status, 403);
  });

  test('con el interruptor apagado: 403 y sin tocar la base de datos', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    const res = await resumen();
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Las reservas por fechas todavía no están activadas.' });
    assert.equal(from.mock.callCount(), 0);
  });
});

describe('GET /api/admin/reservas/resumen: la cuenta', () => {
  test('sin nada que atender: todo a cero, con hoy en Madrid y sin caché', async () => {
    instalar([alquiler()]);
    const res = await resumen();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      hoy,
      total: 0,
      retrasadas: 0,
      en_conflicto: 0,
      reembolsos_a_medias: 0
    });
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('cuenta cada aviso en su vista, y el total suma las tres', async () => {
    instalar([retrasada(1), retrasada(2), sinConfirmar(3), reembolsoAMedias(4)]);
    const res = await resumen();
    assert.equal(res.body.retrasadas, 2);
    assert.equal(res.body.en_conflicto, 1);
    assert.equal(res.body.reembolsos_a_medias, 1);
    assert.equal(res.body.total, 4);
  });

  test('una reserva en dos vistas (sin confirmar y con el reembolso a medias) cuenta una vez en el total', async () => {
    instalar([reembolsoAMedias(1, { conflicto_en: '2026-10-12T10:00:00.000Z' })]);
    const res = await resumen();
    assert.equal(res.body.en_conflicto, 1);
    assert.equal(res.body.reembolsos_a_medias, 1);
    assert.equal(res.body.total, 1);
  });

  test('un reembolso dado por hecho desde el panel ya no es un aviso', async () => {
    instalar([
      reembolsoAMedias(1, {
        historial: [
          { fecha: '2026-10-12T10:00:00.000Z', tipo: 'reembolso_dado_por_hecho', por: 'admin' }
        ]
      })
    ]);
    const res = await resumen();
    assert.equal(res.body.reembolsos_a_medias, 0);
    assert.equal(res.body.total, 0);
  });

  test('las entregas y recogidas de hoy y mañana no son un aviso', async () => {
    instalar([
      alquiler({ id: uuid(1), fecha_inicio: hoy }),
      alquiler({
        id: uuid(2),
        estado: 'en_curso',
        fecha_inicio: dia(-3),
        fecha_fin: dia(1),
        fin_ocupacion: dia(1)
      })
    ]);
    const res = await resumen();
    assert.equal(res.body.total, 0);
  });

  test('una recogida que vence hoy todavía no está retrasada', async () => {
    instalar([
      alquiler({
        id: uuid(1),
        estado: 'en_curso',
        fecha_inicio: dia(-5),
        fecha_fin: hoy,
        fin_ocupacion: hoy
      })
    ]);
    assert.equal((await resumen()).body.retrasadas, 0);
  });

  test('si falla la base de datos: 500 genérico y el detalle solo al log', async () => {
    const fake = instalar([retrasada(1)]);
    fake.fallos['reservas.select'] = { message: 'conexión perdida con 10.0.0.3' };
    const res = await resumen();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al cargar los avisos de reservas.' });
    assert.ok(console.error.mock.calls.some((c) => /conexión perdida/.test(c.arguments[1])));
  });
});
