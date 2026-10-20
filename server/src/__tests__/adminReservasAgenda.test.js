// Panel de reservas: GET /api/admin/reservas/agenda, las entregas y recogidas de hoy y mañana en una
// sola lista por día y hora, con lo que hace falta para organizar la ruta y llamar. Supabase es el
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
const MESA = uuid(2);

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const TOKEN_CLIENTE = jwt.sign(
  { sub: uuid(900), email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'cliente' },
  process.env.JWT_SECRET
);

const MUEBLES = () => [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' },
  { id: MESA, nombre: 'Mesa de roble', referencia: null, estado: 'disponible' }
];

const CONTACTO = {
  nombre: 'Ana Pruebas',
  telefono: '600 000 001',
  email: 'ana@ejemplo.com',
  direccion: 'Calle Falsa 1, Barcelona',
  notas: 'Llamar antes de subir'
};

const alquiler = (cambios = {}) => ({
  id: uuid(101),
  mueble_id: SOFA,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: hoy,
  hora_entrega: '10:00:00',
  fecha_fin: dia(4),
  hora_recogida: '18:30:00',
  fin_ocupacion: dia(4),
  dias_margen: 2,
  modo_entrega: 'domicilio',
  modo_devolucion: 'domicilio',
  direccion_entrega: 'Calle Falsa 1, Barcelona',
  datos_contacto: CONTACTO,
  historial: [],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});
// Entregada, con la recogida prevista en `fin`.
const entregada = (id, fin, cambios = {}) =>
  alquiler({
    id: uuid(id),
    estado: 'en_curso',
    fecha_inicio: dia(-3),
    fecha_fin: fin,
    fin_ocupacion: fin,
    entregada_en: '2026-01-01T10:00:00.000Z',
    ...cambios
  });

const instalar = (reservas = []) => {
  const fake = crearFakeSupabase({ muebles: MUEBLES(), reservas });
  mock.method(supabase, 'from', fake.from);
  return fake;
};
const agenda = () =>
  request(app).get('/api/admin/reservas/agenda').set('Authorization', `Bearer ${TOKEN_ADMIN}`);

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  mock.method(console, 'error', () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('GET /api/admin/reservas/agenda: acceso', () => {
  test('sin sesión 401; con sesión de cliente 403', async () => {
    assert.equal((await request(app).get('/api/admin/reservas/agenda')).status, 401);
    const cliente = await request(app)
      .get('/api/admin/reservas/agenda')
      .set('Authorization', `Bearer ${TOKEN_CLIENTE}`);
    assert.equal(cliente.status, 403);
  });

  test('con el interruptor apagado: 403 y sin tocar la base de datos', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    const res = await agenda();
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Las reservas por fechas todavía no están activadas.' });
    assert.equal(from.mock.callCount(), 0);
  });
});

describe('GET /api/admin/reservas/agenda: qué entra', () => {
  test('sin nada para hoy ni mañana: lista vacía, con hoy y mañana en Madrid y sin caché', async () => {
    instalar([alquiler({ fecha_inicio: dia(5), fecha_fin: dia(8), fin_ocupacion: dia(8) })]);
    const res = await agenda();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { hoy, manana: dia(1), trayectos: [] });
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('una entrega de hoy lleva la hora, la pieza, el cliente, el teléfono y la dirección', async () => {
    instalar([alquiler()]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.deepEqual(trayecto, {
      clave: `${uuid(101)}:entrega`,
      tipo: 'entrega',
      dia: hoy,
      hora: '10:00',
      modo: 'domicilio',
      atrasada: false,
      prevista: null,
      reserva: {
        id: uuid(101),
        referencia: '00000000',
        pieza: { nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' },
        cliente: { nombre: 'Ana Pruebas', telefono: '600 000 001' },
        direccion: 'Calle Falsa 1, Barcelona'
      }
    });
  });

  test('la agenda no filtra el email ni las notas del cliente', async () => {
    instalar([alquiler()]);
    const texto = JSON.stringify((await agenda()).body);
    assert.ok(!texto.includes('ana@ejemplo.com'));
    assert.ok(!texto.includes('Llamar antes de subir'));
  });

  test('una recogida de mañana va en mañana, con la hora de recogida y el modo de devolución', async () => {
    instalar([entregada(1, dia(1), { modo_devolucion: 'tienda' })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.tipo, 'recogida');
    assert.equal(trayecto.dia, dia(1));
    assert.equal(trayecto.hora, '18:30');
    assert.equal(trayecto.modo, 'tienda');
    assert.equal(trayecto.atrasada, false);
  });

  test('una recogida ampliada va el día al que se amplió, no el pactado', async () => {
    instalar([entregada(1, dia(-1), { fin_ocupacion: dia(1) })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.tipo, 'recogida');
    assert.equal(trayecto.dia, dia(1));
  });

  test('pasado mañana no entra, ni una entrega ni una recogida', async () => {
    instalar([
      alquiler({ id: uuid(1), fecha_inicio: dia(2), fecha_fin: dia(5), fin_ocupacion: dia(5) }),
      entregada(2, dia(2))
    ]);
    assert.deepEqual((await agenda()).body.trayectos, []);
  });

  test('las recogidas retrasadas no están: son un aviso con su vista', async () => {
    instalar([entregada(1, dia(-1))]);
    assert.deepEqual((await agenda()).body.trayectos, []);
  });

  test('solo cuentan las confirmadas por entregar y las entregadas por recoger', async () => {
    instalar([
      alquiler({ id: uuid(1), estado: 'pendiente', expira_en: dia(1) }),
      alquiler({ id: uuid(2), estado: 'cancelada' }),
      alquiler({ id: uuid(3), estado: 'devuelta', fin_ocupacion: hoy }),
      alquiler({ id: uuid(4), tipo: 'bloqueo', estado: 'confirmada' }),
      alquiler({ id: uuid(5), tipo: 'venta', fecha_fin: null, fin_ocupacion: null, dias_margen: 0 })
    ]);
    assert.deepEqual((await agenda()).body.trayectos, []);
  });
});

describe('GET /api/admin/reservas/agenda: entregas atrasadas', () => {
  test('una entrega que tenía que haberse hecho antes de hoy va en hoy, marcada y con su día previsto', async () => {
    instalar([alquiler({ fecha_inicio: dia(-2), fecha_fin: dia(2), fin_ocupacion: dia(2) })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.dia, hoy);
    assert.equal(trayecto.atrasada, true);
    assert.equal(trayecto.prevista, dia(-2));
  });

  test('una entrega de hoy no está atrasada', async () => {
    instalar([alquiler()]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.atrasada, false);
    assert.equal(trayecto.prevista, null);
  });

  test('una recogida nunca está atrasada', async () => {
    instalar([entregada(1, hoy)]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.tipo, 'recogida');
    assert.equal(trayecto.atrasada, false);
    assert.equal(trayecto.prevista, null);
  });
});

describe('GET /api/admin/reservas/agenda: dirección y cliente', () => {
  test('en una tienda no hay dirección que llevar, aunque el cliente la dejara', async () => {
    instalar([alquiler({ modo_entrega: 'tienda' })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.modo, 'tienda');
    assert.equal(trayecto.reserva.direccion, null);
  });

  test('sin dirección de entrega, sale la del cliente', async () => {
    instalar([alquiler({ direccion_entrega: null })]);
    assert.equal((await agenda()).body.trayectos[0].reserva.direccion, 'Calle Falsa 1, Barcelona');
  });

  test('sin ninguna dirección: null, sin romper', async () => {
    instalar([alquiler({ direccion_entrega: null, datos_contacto: { nombre: 'Ana Pruebas' } })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.reserva.direccion, null);
    assert.deepEqual(trayecto.reserva.cliente, { nombre: 'Ana Pruebas', telefono: null });
  });

  test('sin datos de contacto: cliente null', async () => {
    instalar([alquiler({ datos_contacto: null, direccion_entrega: null })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.reserva.cliente, null);
    assert.equal(trayecto.reserva.direccion, null);
  });

  test('una pieza que ya no está en el catálogo sale con su aviso, sin romper', async () => {
    instalar([alquiler({ mueble_id: uuid(77) })]);
    const [trayecto] = (await agenda()).body.trayectos;
    assert.equal(trayecto.reserva.pieza.nombre, '(pieza eliminada)');
    assert.equal(trayecto.reserva.pieza.referencia, null);
  });
});

describe('GET /api/admin/reservas/agenda: el orden', () => {
  test('por día, y en un día por hora (sin hora al final)', async () => {
    instalar([
      alquiler({
        id: uuid(1),
        fecha_inicio: dia(1),
        hora_entrega: '09:00:00',
        fecha_fin: dia(5),
        fin_ocupacion: dia(5)
      }),
      alquiler({ id: uuid(2), hora_entrega: '16:00:00' }),
      alquiler({ id: uuid(3), hora_entrega: '08:30:00', mueble_id: MESA }),
      alquiler({ id: uuid(4), hora_entrega: null, mueble_id: MESA })
    ]);
    const claves = (await agenda()).body.trayectos.map((t) => t.clave);
    assert.deepEqual(claves, [
      `${uuid(3)}:entrega`,
      `${uuid(2)}:entrega`,
      `${uuid(4)}:entrega`,
      `${uuid(1)}:entrega`
    ]);
  });

  test('a la misma hora, la entrega va antes que la recogida', async () => {
    // La recogida tiene la referencia que iría primero: solo el tipo las pone en este orden.
    instalar([
      entregada(1, hoy, { hora_recogida: '10:00:00' }),
      alquiler({
        id: uuid(2),
        pedido_id: 'ffffffff-aaaa-4000-8000-000000000001',
        hora_entrega: '10:00:00',
        mueble_id: MESA
      })
    ]);
    const tipos = (await agenda()).body.trayectos.map((t) => t.tipo);
    assert.deepEqual(tipos, ['entrega', 'recogida']);
  });

  test('lo atrasado va primero en hoy, aunque su hora sea más tarde', async () => {
    instalar([
      alquiler({ id: uuid(1), hora_entrega: '08:00:00' }),
      alquiler({
        id: uuid(2),
        mueble_id: MESA,
        fecha_inicio: dia(-1),
        hora_entrega: '19:00:00',
        fecha_fin: dia(3),
        fin_ocupacion: dia(3)
      })
    ]);
    const claves = (await agenda()).body.trayectos.map((t) => t.clave);
    assert.deepEqual(claves, [`${uuid(2)}:entrega`, `${uuid(1)}:entrega`]);
  });

  test('a igual día, hora y tipo, por referencia (el orden no cambia entre cargas)', async () => {
    instalar([
      // Los ids van al revés que las referencias: solo la referencia las pone en este orden.
      alquiler({ id: uuid(3), mueble_id: MESA, pedido_id: 'ffffffff-aaaa-4000-8000-000000000001' }),
      alquiler({ id: uuid(4), mueble_id: MESA, pedido_id: '11111111-aaaa-4000-8000-000000000002' }),
      alquiler({ id: uuid(5), mueble_id: SOFA })
    ]);
    const referencias = (await agenda()).body.trayectos.map((t) => t.reserva.referencia);
    assert.deepEqual(referencias, ['00000000', '11111111', 'FFFFFFFF']);
  });

  test('con la misma referencia, por clave (la de la reserva)', async () => {
    instalar([alquiler({ id: uuid(9) }), alquiler({ id: uuid(8) })]);
    const claves = (await agenda()).body.trayectos.map((t) => t.clave);
    assert.deepEqual(claves, [`${uuid(8)}:entrega`, `${uuid(9)}:entrega`]);
  });
});

describe('GET /api/admin/reservas/agenda: errores', () => {
  test('si falla la base de datos: 500 genérico y el detalle solo al log', async () => {
    const fake = instalar([alquiler()]);
    fake.fallos['reservas.select'] = { message: 'conexión perdida con 10.0.0.3' };
    const res = await agenda();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al cargar las entregas y recogidas.' });
    assert.ok(console.error.mock.calls.some((c) => /conexión perdida/.test(c.arguments[1])));
  });
});
