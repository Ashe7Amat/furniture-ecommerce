// Panel de reservas: GET /api/admin/reservas/calendario, la ocupación de unos días para el calendario de
// una pieza y la vista general. Supabase es el doble en memoria; las fechas van relativas a hoy en
// Madrid, porque el endpoint usa el reloj de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { MAX_CALENDARIO } = require('../utils/adminReservas');
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
  { email: 'cliente@test.com', nombre: 'Cliente', rol: 'cliente' },
  process.env.JWT_SECRET
);

const MUEBLES = () => [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' },
  { id: MESA, nombre: 'Mesa de roble', referencia: 'NAV-MES-007', estado: 'disponible' }
];

const ANA = {
  nombre: 'Ana Pérez',
  email: 'ana.perez@ejemplo.com',
  telefono: '600 111 222',
  direccion: 'Calle del Sol 12, Barcelona',
  notas: 'Tercero sin ascensor'
};

// Un alquiler confirmado del día 5 al 8, con 2 días de margen: ocupa del 5 al 9 (el 10 queda libre).
const alquiler = (n, cambios = {}) => ({
  id: uuid(100 + n),
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
  modo_entrega: 'domicilio',
  modo_devolucion: 'domicilio',
  direccion_entrega: 'Calle del Sol 12, Barcelona',
  datos_contacto: ANA,
  importe_total: 120.5,
  stripe_payment_intent_id: 'pi_123',
  historial: [],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});

const instalar = (reservas = []) => {
  const fake = crearFakeSupabase({ muebles: MUEBLES(), reservas });
  mock.method(supabase, 'from', fake.from);
  return fake;
};
const calendario = (consulta, token = TOKEN_ADMIN) =>
  request(app)
    .get(`/api/admin/reservas/calendario?${consulta}`)
    .set('Authorization', `Bearer ${token}`);
const ventana = (desde, hasta) => `desde=${dia(desde)}&hasta=${dia(hasta)}`;
const ids = (res) => res.body.reservas.map((r) => r.id);

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  mock.method(console, 'error', () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('calendario: quién puede pedirlo', () => {
  test('sin sesión: 401; con la sesión de un cliente: 403', async () => {
    const sinSesion = await request(app).get(`/api/admin/reservas/calendario?${ventana(0, 10)}`);
    assert.equal(sinSesion.status, 401);
    assert.equal((await calendario(ventana(0, 10), TOKEN_CLIENTE)).status, 403);
  });

  test('con las reservas apagadas: 403 sin tocar la base de datos', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    instalar();
    const res = await calendario(ventana(0, 10));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Las reservas por fechas todavía no están activadas.');
    assert.equal(supabase.from.mock.calls.length, 0);
  });
});

describe('calendario: qué reservas entran', () => {
  test('lo que ocupa algún día de la ventana, con los dos extremos incluidos', async () => {
    instalar([alquiler(1)]);
    // Ocupa del día 5 al 9 (con el margen).
    assert.deepEqual(ids(await calendario(ventana(0, 4))), []);
    assert.deepEqual(ids(await calendario(ventana(0, 5))), [uuid(101)]);
    assert.deepEqual(ids(await calendario(ventana(6, 7))), [uuid(101)]);
    assert.deepEqual(ids(await calendario(ventana(9, 12))), [uuid(101)]);
    assert.deepEqual(ids(await calendario(ventana(10, 12))), []);
  });

  test('el margen cuenta: una ventana que solo toca los días de margen la incluye', async () => {
    instalar([alquiler(1, { dias_margen: 0 })]);
    // Sin margen, el día de la recogida (8) ya está libre.
    assert.deepEqual(ids(await calendario(ventana(8, 12))), []);
    assert.deepEqual(ids(await calendario(ventana(7, 12))), [uuid(101)]);
  });

  test('una venta no tiene fin: entra en cualquier ventana posterior a su día', async () => {
    instalar([
      alquiler(1, {
        tipo: 'venta',
        fecha_inicio: dia(3),
        fecha_fin: null,
        fin_ocupacion: null,
        dias_margen: 0,
        hora_entrega: null,
        hora_recogida: null,
        datos_contacto: null,
        motivo: 'Venta en tienda'
      })
    ]);
    assert.deepEqual(ids(await calendario(ventana(50, 60))), [uuid(101)]);
    assert.deepEqual(ids(await calendario(ventana(0, 2))), []);
  });

  test('canceladas y no pagadas (caducadas) no ocupan; las esperando pago, las entregadas y las devueltas sí', async () => {
    const ayer = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    instalar([
      alquiler(1, { estado: 'cancelada' }),
      alquiler(2, { estado: 'expirada' }),
      alquiler(3, { estado: 'pendiente', expira_en: ayer }),
      alquiler(4, { estado: 'pendiente', expira_en: manana, stripe_payment_intent_id: null }),
      alquiler(5, {
        estado: 'en_curso',
        fecha_inicio: dia(2),
        fecha_fin: dia(9),
        fin_ocupacion: dia(9)
      }),
      alquiler(6, {
        estado: 'devuelta',
        fecha_inicio: dia(-3),
        fecha_fin: dia(1),
        fin_ocupacion: dia(0)
      })
    ]);
    const res = await calendario(ventana(0, 30));
    assert.deepEqual(ids(res).sort(), [uuid(104), uuid(105), uuid(106)]);
  });

  test('con mueble_id, solo las de esa pieza', async () => {
    instalar([alquiler(1), alquiler(2, { mueble_id: MESA })]);
    assert.deepEqual(ids(await calendario(`${ventana(0, 30)}&mueble_id=${MESA}`)), [uuid(102)]);
    assert.deepEqual(ids(await calendario(ventana(0, 30))).sort(), [uuid(101), uuid(102)]);
  });

  test('las más próximas primero, de cualquier pieza', async () => {
    instalar([
      alquiler(1, { fecha_inicio: dia(12), fecha_fin: dia(14), fin_ocupacion: dia(14) }),
      alquiler(2, {
        mueble_id: MESA,
        fecha_inicio: dia(3),
        fecha_fin: dia(4),
        fin_ocupacion: dia(4)
      }),
      alquiler(3, { fecha_inicio: dia(20), fecha_fin: dia(22), fin_ocupacion: dia(22) })
    ]);
    assert.deepEqual(ids(await calendario(ventana(0, 40))), [uuid(102), uuid(101), uuid(103)]);
  });

  test('una pieza que ya no está en el catálogo sale con su aviso', async () => {
    instalar([alquiler(1, { mueble_id: uuid(77) })]);
    const [reserva] = (await calendario(ventana(0, 30))).body.reservas;
    assert.equal(reserva.pieza.nombre, '(pieza eliminada)');
  });
});

describe('calendario: las retrasadas', () => {
  // Entregada el día -10, tenía que volver el -3 y con 2 días de margen su ocupación acabó el -1.
  const retrasada = (n, cambios = {}) =>
    alquiler(n, {
      estado: 'en_curso',
      fecha_inicio: dia(-10),
      fecha_fin: dia(-3),
      fin_ocupacion: dia(-3),
      ...cambios
    });

  test('si la ventana llega a hoy o más allá, salen aunque su ocupación ya haya acabado', async () => {
    instalar([retrasada(1)]);
    const res = await calendario(ventana(0, 30));
    assert.deepEqual(ids(res), [uuid(101)]);
    assert.equal(res.body.reservas[0].retrasada, true);
    assert.equal(res.body.reservas[0].etiqueta, 'Retrasada');
    assert.deepEqual(ids(await calendario(ventana(-5, 0))), [uuid(101)]);
  });

  test('la ventana que acaba justo hoy también las trae, aunque su ocupación acabara antes', async () => {
    instalar([retrasada(1)]);
    assert.deepEqual(ids(await calendario(ventana(0, 0))), [uuid(101)]);
  });

  test('una entregada o una confirmada que no es retrasada y cae fuera de la ventana no se cuela', async () => {
    instalar([
      alquiler(1, {
        estado: 'en_curso',
        fecha_inicio: dia(40),
        fecha_fin: dia(45),
        fin_ocupacion: dia(45)
      }),
      alquiler(2, {
        estado: 'confirmada',
        fecha_inicio: dia(-10),
        fecha_fin: dia(-3),
        fin_ocupacion: dia(-3)
      })
    ]);
    assert.deepEqual(ids(await calendario(ventana(0, 30))), []);
  });

  test('las retrasadas se mezclan con el resto por fecha de inicio', async () => {
    instalar([
      alquiler(1, { fecha_inicio: dia(5), fecha_fin: dia(8), fin_ocupacion: dia(8) }),
      retrasada(2),
      alquiler(3, {
        mueble_id: MESA,
        fecha_inicio: dia(-1),
        fecha_fin: dia(2),
        fin_ocupacion: dia(2)
      })
    ]);
    assert.deepEqual(ids(await calendario(ventana(0, 30))), [uuid(102), uuid(103), uuid(101)]);
  });

  test('si la ventana acaba antes de hoy, solo salen si su ocupación llega a ella', async () => {
    instalar([retrasada(1)]);
    assert.deepEqual(ids(await calendario(ventana(-30, -1))), [uuid(101)]);
    assert.deepEqual(ids(await calendario(ventana(-30, -12))), []);
  });

  test('una retrasada cuya ocupación sí entra no sale dos veces', async () => {
    instalar([retrasada(1, { fin_ocupacion: dia(2), dias_margen: 0 })]);
    const res = await calendario(ventana(0, 30));
    assert.deepEqual(ids(res), [uuid(101)]);
  });

  test('con mueble_id, solo las retrasadas de esa pieza', async () => {
    instalar([retrasada(1), retrasada(2, { mueble_id: MESA })]);
    assert.deepEqual(ids(await calendario(`${ventana(0, 30)}&mueble_id=${MESA}`)), [uuid(102)]);
  });

  test('una entregada que aún no tiene que volver no es retrasada', async () => {
    instalar([
      alquiler(1, {
        estado: 'en_curso',
        fecha_inicio: dia(-1),
        fecha_fin: dia(4),
        fin_ocupacion: dia(4)
      })
    ]);
    const [reserva] = (await calendario(ventana(0, 30))).body.reservas;
    assert.equal(reserva.retrasada, false);
    assert.equal(reserva.etiqueta, 'Entregada');
  });
});

describe('calendario: lo que se enseña de cada reserva', () => {
  test('lo justo para dibujar y reconocer la reserva, sin datos del cliente más que el nombre', async () => {
    instalar([alquiler(1, { pedido_id: 'a1b2c3d4-0000-4000-8000-000000000001' })]);
    const res = await calendario(ventana(0, 30));
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'private, no-store');
    assert.deepEqual(res.body, {
      hoy,
      desde: dia(0),
      hasta: dia(30),
      limitada: false,
      reservas: [
        {
          id: uuid(101),
          referencia: 'A1B2C3D4',
          tipo: 'alquiler',
          estado: 'confirmada',
          etiqueta: 'Confirmada',
          retrasada: false,
          en_conflicto: false,
          pieza: { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' },
          cliente: 'Ana Pérez',
          motivo: null,
          fecha_inicio: dia(5),
          hora_entrega: '10:00',
          fecha_fin: dia(8),
          hora_recogida: '18:30',
          fin_ocupacion: dia(8),
          dias_margen: 2,
          ocupada_hasta: dia(10)
        }
      ]
    });
  });

  test('una recogida ampliada ocupa hasta su nueva fecha más el margen', async () => {
    instalar([alquiler(1, { fin_ocupacion: dia(11) })]);
    const [reserva] = (await calendario(ventana(0, 30))).body.reservas;
    assert.equal(reserva.fecha_fin, dia(8));
    assert.equal(reserva.fin_ocupacion, dia(11));
    assert.equal(reserva.ocupada_hasta, dia(13));
  });

  test('un bloqueo enseña su motivo y no tiene cliente; una venta no tiene fin', async () => {
    instalar([
      alquiler(1, {
        tipo: 'bloqueo',
        datos_contacto: null,
        motivo: 'Exposición en la tienda',
        dias_margen: 0
      }),
      alquiler(2, {
        tipo: 'venta',
        mueble_id: MESA,
        fecha_inicio: dia(3),
        fecha_fin: null,
        fin_ocupacion: null,
        dias_margen: 0,
        hora_entrega: null,
        hora_recogida: null,
        datos_contacto: null,
        motivo: 'Venta en tienda'
      })
    ]);
    const { reservas } = (await calendario(ventana(0, 30))).body;
    const bloqueo = reservas.find((r) => r.tipo === 'bloqueo');
    const venta = reservas.find((r) => r.tipo === 'venta');
    assert.equal(bloqueo.cliente, null);
    assert.equal(bloqueo.motivo, 'Exposición en la tienda');
    assert.equal(bloqueo.ocupada_hasta, dia(8));
    assert.equal(venta.fecha_fin, null);
    assert.equal(venta.fin_ocupacion, null);
    assert.equal(venta.ocupada_hasta, null);
    assert.equal(venta.hora_entrega, null);
  });

  test('las reservas esperando pago salen con su etiqueta', async () => {
    const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    instalar([
      alquiler(1, { estado: 'pendiente', expira_en: manana, stripe_payment_intent_id: null })
    ]);
    const [reserva] = (await calendario(ventana(0, 30))).body.reservas;
    assert.equal(reserva.etiqueta, 'Esperando pago');
  });

  test('una pagada que no se pudo confirmar sale como en conflicto', async () => {
    instalar([alquiler(1, { conflicto_en: '2026-10-02T10:00:00.000Z' })]);
    const [reserva] = (await calendario(ventana(0, 30))).body.reservas;
    assert.equal(reserva.en_conflicto, true);
    assert.equal(reserva.etiqueta, 'No se pudo confirmar');
  });
});

describe('calendario: el límite', () => {
  const muchas = (cuantas) =>
    Array.from({ length: cuantas }, (_, i) =>
      alquiler(i + 1, {
        id: uuid(1000 + i),
        fecha_inicio: dia(5),
        fecha_fin: dia(6),
        fin_ocupacion: dia(6),
        dias_margen: 0
      })
    );

  test('con MAX_CALENDARIO reservas en la ventana, avisa de que pueden faltar', async () => {
    instalar(muchas(MAX_CALENDARIO));
    const res = await calendario(ventana(0, 30));
    assert.equal(res.body.reservas.length, MAX_CALENDARIO);
    assert.equal(res.body.limitada, true);
  });

  test('con más, solo lee MAX_CALENDARIO', async () => {
    instalar(muchas(MAX_CALENDARIO + 5));
    const res = await calendario(ventana(0, 30));
    assert.equal(res.body.reservas.length, MAX_CALENDARIO);
    assert.equal(res.body.limitada, true);
  });

  test('las canceladas no gastan el límite de lectura', async () => {
    instalar([
      ...muchas(MAX_CALENDARIO).map((fila) => ({
        ...fila,
        estado: 'cancelada',
        fecha_inicio: dia(1),
        fecha_fin: dia(2),
        fin_ocupacion: dia(2)
      })),
      alquiler(5000, {
        id: uuid(5000),
        fecha_inicio: dia(20),
        fecha_fin: dia(22),
        fin_ocupacion: dia(22)
      })
    ]);
    const res = await calendario(ventana(0, 30));
    assert.deepEqual(ids(res), [uuid(5000)]);
    assert.equal(res.body.limitada, false);
  });

  test('con una menos, no avisa', async () => {
    instalar(muchas(MAX_CALENDARIO - 1));
    const res = await calendario(ventana(0, 30));
    assert.equal(res.body.reservas.length, MAX_CALENDARIO - 1);
    assert.equal(res.body.limitada, false);
  });
});

describe('calendario: la consulta se valida', () => {
  test('los dos días son obligatorios, con su mensaje', async () => {
    const sinDesde = await calendario(`hasta=${dia(5)}`);
    assert.equal(sinDesde.status, 400);
    assert.equal(sinDesde.body.error, 'Elige el primer día del calendario (AAAA-MM-DD).');
    const sinHasta = await calendario(`desde=${dia(5)}`);
    assert.equal(sinHasta.status, 400);
    assert.equal(sinHasta.body.error, 'Elige el último día del calendario (AAAA-MM-DD).');
    assert.equal((await calendario('')).status, 400);
  });

  test('un día que no existe o mal escrito: 400', async () => {
    assert.equal((await calendario(`desde=2026-02-30&hasta=${dia(5)}`)).status, 400);
    assert.equal((await calendario(`desde=${dia(0)}&hasta=mañana`)).status, 400);
  });

  test('vacíos cuentan como que faltan', async () => {
    assert.equal((await calendario('desde=&hasta=')).status, 400);
  });

  test('el último día antes que el primero: 400; el mismo día vale', async () => {
    const res = await calendario(ventana(5, 4));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El último día del calendario no puede ser anterior al primero.');
    assert.equal((await calendario(ventana(5, 5))).status, 200);
  });

  test('100 días seguidos valen; 101, 400', async () => {
    assert.equal((await calendario(ventana(0, 99))).status, 200);
    const res = await calendario(ventana(0, 100));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El calendario enseña como mucho 100 días seguidos.');
  });

  test('un mueble_id que no es un uuid: 400; vacío cuenta como todas las piezas', async () => {
    const mal = await calendario(`${ventana(0, 5)}&mueble_id=x`);
    assert.equal(mal.status, 400);
    assert.equal(mal.body.error, 'La pieza del filtro no es válida.');
    assert.equal((await calendario(`${ventana(0, 5)}&mueble_id=`)).status, 200);
  });
});

describe('calendario: errores', () => {
  test('si falla la base de datos: 500 genérico y el detalle solo al log', async () => {
    const fake = instalar([alquiler(1)]);
    fake.fallos['reservas.select'] = { message: 'conexión perdida con 10.0.0.3' };
    const res = await calendario(ventana(0, 30));
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al cargar el calendario de reservas.' });
    assert.ok(console.error.mock.calls.some((c) => /conexión perdida/.test(c.arguments[1])));
  });
});
