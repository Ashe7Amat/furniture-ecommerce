// Panel de reservas (docs/reservas-diseno.md, 8.1 y 8.7; bloque R-d, commit 14): el acceso (sesión
// de administrador e interruptor RESERVAS_ACTIVAS), las vistas de GET /api/admin/reservas y la
// etiqueta y las acciones de cada reserva. Las acciones están en adminReservasAcciones.test.js y las
// altas en adminReservasAltas.test.js. Supabase es el doble en memoria; las fechas van relativas a hoy
// en Madrid, porque los endpoints usan el reloj de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { situacion, presentar, MAX_TODAS } = require('../utils/adminReservas');
const { idPedidoDeSesion } = require('../utils/pagos');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const MESA = uuid(2);
const ANA = uuid(900);
const PEDIDO = 'a1b2c3d4-0000-4000-8000-000000000001';

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const TOKEN_CLIENTE = jwt.sign(
  { sub: ANA, email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'cliente' },
  process.env.JWT_SECRET
);

const MUEBLES = () => [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' },
  { id: MESA, nombre: 'Mesa de comedor', referencia: null, estado: 'disponible' }
];
const CONTACTO_ANA = {
  nombre: 'Ana Martínez',
  email: 'ana@ejemplo.com',
  telefono: '600123456',
  direccion: 'Calle Mayor 15, 08001 Barcelona',
  notas: 'Portero automático'
};

// Filas del calendario, como las dejan la web, el panel o una compra.
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
  cliente_id: ANA,
  pedido_id: PEDIDO,
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: CONTACTO_ANA.direccion,
  datos_contacto: CONTACTO_ANA,
  importe_total: 120.5,
  stripe_payment_intent_id: 'pi_123',
  historial: [{ fecha: '2026-10-01T10:00:00.000Z', tipo: 'creada', por: 'cliente' }],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});
const bloqueo = (cambios = {}) => ({
  id: uuid(201),
  mueble_id: SOFA,
  tipo: 'bloqueo',
  estado: 'confirmada',
  origen: 'manual',
  fecha_inicio: dia(20),
  fecha_fin: dia(25),
  fin_ocupacion: dia(25),
  dias_margen: 0,
  motivo: 'Exposición en la tienda',
  historial: [],
  created_at: '2026-10-02T10:00:00.000Z',
  ...cambios
});
const venta = (cambios = {}) => ({
  id: uuid(301),
  mueble_id: SOFA,
  tipo: 'venta',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(-3),
  dias_margen: 0,
  stripe_session_id: 'cs_otra',
  historial: [],
  created_at: '2026-10-03T10:00:00.000Z',
  ...cambios
});

let fake;
const instalar = ({ reservas = [], muebles = MUEBLES() } = {}) => {
  fake = crearFakeSupabase({ muebles, reservas });
  mock.method(supabase, 'from', fake.from);
};

let registroErrores;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  registroErrores = mock.method(console, 'error', () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

const comoAdmin = (peticion) => peticion.set('Authorization', `Bearer ${TOKEN_ADMIN}`);
const lista = (consulta = '') => comoAdmin(request(app).get(`/api/admin/reservas${consulta}`));
const ids = (res) => res.body.reservas.map((r) => r.id);

describe('acceso al panel de reservas', () => {
  const rutas = [
    ['get', '/api/admin/reservas'],
    ['post', '/api/admin/reservas/bloqueos'],
    ['post', '/api/admin/reservas/alquileres'],
    ['post', '/api/admin/reservas/ventas'],
    ['post', `/api/admin/reservas/${uuid(101)}/entregar`]
  ];

  test('sin sesión: 401 en todas las rutas', async () => {
    for (const [metodo, ruta] of rutas) {
      const res = await request(app)[metodo](ruta);
      assert.equal(res.status, 401, ruta);
    }
  });

  test('con sesión de cliente: 403 en todas las rutas', async () => {
    for (const [metodo, ruta] of rutas) {
      const res = await request(app)[metodo](ruta).set('Authorization', `Bearer ${TOKEN_CLIENTE}`);
      assert.equal(res.status, 403, ruta);
      assert.deepEqual(res.body, { error: 'No tienes permisos de administrador para hacer esto.' });
    }
  });

  test('con el interruptor apagado: 403 con su mensaje y sin tocar la base de datos', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    for (const [metodo, ruta] of rutas) {
      const res = await comoAdmin(request(app)[metodo](ruta)).send({});
      assert.equal(res.status, 403, ruta);
      assert.deepEqual(res.body, { error: 'Las reservas por fechas todavía no están activadas.' });
    }
    assert.equal(from.mock.callCount(), 0);
  });

  test('solo "true" lo enciende', async () => {
    process.env.RESERVAS_ACTIVAS = '1';
    assert.equal((await lista()).status, 403);
    process.env.RESERVAS_ACTIVAS = 'TRUE';
    assert.equal((await lista()).status, 403);
  });

  test('apagado y sin sesión: primero la sesión (401)', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    assert.equal((await request(app).get('/api/admin/reservas')).status, 401);
  });
});

describe('GET /api/admin/reservas: la consulta', () => {
  test('sin vista, las próximas; responde hoy (Madrid) y sin caché', async () => {
    instalar({ reservas: [alquiler()] });
    const res = await lista();
    assert.equal(res.status, 200);
    assert.equal(res.body.hoy, hoy);
    assert.deepEqual(ids(res), [uuid(101)]);
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('una vista que no existe: 400', async () => {
    const res = await lista('?vista=pendientes');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Esa vista de la lista de reservas no existe.' });
  });

  test('un mueble_id que no es un uuid: 400; vacío, sin filtro', async () => {
    instalar({ reservas: [alquiler()] });
    const mal = await lista('?mueble_id=sofa');
    assert.equal(mal.status, 400);
    assert.deepEqual(mal.body, { error: 'La pieza del filtro no es válida.' });
    const vacio = await lista('?vista=todas&mueble_id=');
    assert.equal(vacio.status, 200);
    assert.equal(vacio.body.reservas.length, 1);
  });

  test('con mueble_id, solo las de esa pieza (en cualquier vista)', async () => {
    instalar({
      reservas: [alquiler(), alquiler({ id: uuid(102), mueble_id: MESA })]
    });
    for (const vista of ['proximas', 'todas']) {
      const res = await lista(`?vista=${vista}&mueble_id=${MESA}`);
      assert.deepEqual(ids(res), [uuid(102)], vista);
    }
  });

  test('si falla la base de datos: 500 genérico, y el detalle solo al log', async () => {
    fake.fallos['reservas.select'] = { message: 'conexión perdida con 10.0.0.3' };
    const res = await lista();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al cargar las reservas.' });
    assert.ok(registroErrores.mock.calls.some((c) => /conexión perdida/.test(c.arguments[1])));
  });

  test('si falla la lectura de las piezas, también', async () => {
    instalar({ reservas: [alquiler()] });
    fake.fallos['muebles.select'] = { message: 'conexión perdida' };
    const res = await lista();
    assert.equal(res.status, 500);
  });
});

describe('GET /api/admin/reservas: cada vista', () => {
  test('próximas: lo que ocupa de hoy en adelante, por fecha de inicio', async () => {
    instalar({
      reservas: [
        alquiler({
          id: uuid(1),
          fecha_inicio: dia(10),
          fecha_fin: dia(12),
          fin_ocupacion: dia(12)
        }),
        bloqueo({ id: uuid(2) }),
        // Una venta con entrega diferida (empieza más adelante): sí.
        venta({ id: uuid(3), mueble_id: MESA, fecha_inicio: dia(40) }),
        // Una venta de hoy: sí.
        venta({ id: uuid(4), mueble_id: uuid(3), fecha_inicio: hoy }),
        // Una provisional en plazo: alguien la está pagando.
        alquiler({
          id: uuid(5),
          mueble_id: MESA,
          estado: 'pendiente',
          pedido_id: null,
          expira_en: new Date(Date.now() + 20 * 60_000).toISOString()
        }),
        // Devuelta ayer: su margen todavía ocupa hoy.
        alquiler({
          id: uuid(6),
          mueble_id: uuid(4),
          estado: 'devuelta',
          fecha_inicio: dia(-6),
          fecha_fin: dia(-1),
          fin_ocupacion: dia(-1),
          entregada_en: '2026-01-01T10:00:00.000Z',
          devuelta_en: '2026-01-01T10:00:00.000Z'
        }),
        // En curso desde hace días, con la recogida para mañana.
        alquiler({
          id: uuid(7),
          mueble_id: uuid(5),
          estado: 'en_curso',
          fecha_inicio: dia(-4),
          fecha_fin: dia(1),
          fin_ocupacion: dia(1),
          entregada_en: '2026-01-01T10:00:00.000Z'
        })
      ]
    });
    const res = await lista('?vista=proximas');
    assert.deepEqual(ids(res), [uuid(6), uuid(7), uuid(4), uuid(5), uuid(1), uuid(2), uuid(3)]);
  });

  test('próximas: un retraso que nadie ha ampliado sale aunque su ocupación ya haya pasado', async () => {
    instalar({
      reservas: [
        alquiler({
          estado: 'en_curso',
          fecha_inicio: dia(-10),
          fecha_fin: dia(-5),
          fin_ocupacion: dia(-5),
          entregada_en: '2026-01-01T10:00:00.000Z'
        })
      ]
    });
    const res = await lista('?vista=proximas');
    assert.deepEqual(ids(res), [uuid(101)]);
    assert.equal(res.body.reservas[0].etiqueta, 'Retrasada');
  });

  test('próximas: ni ventas que empezaron antes de hoy, ni canceladas, expiradas, caducadas o pasadas', async () => {
    instalar({
      reservas: [
        venta(),
        alquiler({ id: uuid(1), estado: 'cancelada' }),
        alquiler({ id: uuid(2), mueble_id: MESA, estado: 'expirada', pedido_id: null }),
        // Pendiente con el plazo vencido: no ocupa (la limpieza la marcará expirada al escribir).
        alquiler({
          id: uuid(3),
          mueble_id: uuid(3),
          estado: 'pendiente',
          expira_en: new Date(Date.now() - 60_000).toISOString()
        }),
        // Devuelta hace tiempo: su ocupación, margen incluido, acabó ayer.
        alquiler({
          id: uuid(4),
          mueble_id: uuid(4),
          estado: 'devuelta',
          fecha_inicio: dia(-10),
          fecha_fin: dia(-3),
          fin_ocupacion: dia(-3),
          entregada_en: '2026-01-01T10:00:00.000Z',
          devuelta_en: '2026-01-01T10:00:00.000Z'
        }),
        bloqueo({ id: uuid(5), estado: 'cancelada' }),
        bloqueo({ id: uuid(6), fecha_inicio: dia(-9), fecha_fin: hoy, fin_ocupacion: hoy })
      ]
    });
    const res = await lista('?vista=proximas');
    assert.deepEqual(ids(res), []);
  });

  test('entregas: alquileres confirmados para hoy y mañana, y los que se quedaron sin entregar', async () => {
    instalar({
      reservas: [
        alquiler({ id: uuid(1), fecha_inicio: dia(1), fecha_fin: dia(4), fin_ocupacion: dia(4) }),
        alquiler({
          id: uuid(2),
          mueble_id: MESA,
          fecha_inicio: hoy,
          fecha_fin: dia(3),
          fin_ocupacion: dia(3)
        }),
        alquiler({
          id: uuid(3),
          mueble_id: uuid(3),
          fecha_inicio: dia(-2),
          fecha_fin: dia(3),
          fin_ocupacion: dia(3)
        }),
        // Pasado mañana: todavía no.
        alquiler({ id: uuid(4), mueble_id: uuid(4), fecha_inicio: dia(2) }),
        // Ya entregada, o no es un alquiler: no.
        alquiler({
          id: uuid(5),
          mueble_id: uuid(5),
          estado: 'en_curso',
          fecha_inicio: hoy,
          entregada_en: '2026-01-01T10:00:00.000Z'
        }),
        bloqueo({ id: uuid(6), mueble_id: uuid(6), fecha_inicio: hoy })
      ]
    });
    const res = await lista('?vista=entregas');
    assert.deepEqual(ids(res), [uuid(3), uuid(2), uuid(1)]);
  });

  test('recogidas: alquileres entregados con la recogida hoy o mañana', async () => {
    const enCurso = (n, mueble, fechaFin) =>
      alquiler({
        id: uuid(n),
        mueble_id: mueble,
        estado: 'en_curso',
        fecha_inicio: dia(-5),
        fecha_fin: fechaFin,
        fin_ocupacion: fechaFin,
        entregada_en: '2026-01-01T10:00:00.000Z'
      });
    instalar({
      reservas: [
        enCurso(1, SOFA, dia(1)),
        enCurso(2, MESA, hoy),
        enCurso(3, uuid(3), dia(2)),
        // Retrasada: va en su vista.
        enCurso(4, uuid(4), dia(-1)),
        // Sin entregar todavía: no.
        alquiler({ id: uuid(5), mueble_id: uuid(5), fecha_inicio: dia(-1), fecha_fin: hoy })
      ]
    });
    const res = await lista('?vista=recogidas');
    assert.deepEqual(ids(res), [uuid(2), uuid(1)]);
  });

  test('recogidas: cuenta la recogida prevista (fin_ocupacion), no la pactada', async () => {
    const enCurso = (n, mueble, fechaFin, finOcupacion) =>
      alquiler({
        id: uuid(n),
        mueble_id: mueble,
        estado: 'en_curso',
        fecha_inicio: dia(-9),
        fecha_fin: fechaFin,
        fin_ocupacion: finOcupacion,
        entregada_en: '2026-01-01T10:00:00.000Z'
      });
    instalar({
      reservas: [
        // Retrasada y ampliada hasta mañana: se recoge mañana.
        enCurso(1, SOFA, dia(-2), dia(1)),
        // Pactada para hoy, pero ampliada a dentro de una semana: no es para hoy ni mañana.
        enCurso(2, MESA, hoy, dia(7)),
        // Retrasada sin ampliar: va en las retrasadas.
        enCurso(3, uuid(3), dia(-1), dia(-1))
      ]
    });
    const res = await lista('?vista=recogidas');
    assert.deepEqual(ids(res), [uuid(1)]);
  });

  test('retrasadas: entregadas con la recogida pactada ya pasada, con retrasada y su etiqueta', async () => {
    instalar({
      reservas: [
        alquiler({
          id: uuid(1),
          estado: 'en_curso',
          fecha_inicio: dia(-9),
          fecha_fin: dia(-1),
          // Ampliada: sigue retrasada respecto a lo pactado.
          fin_ocupacion: dia(2),
          entregada_en: '2026-01-01T10:00:00.000Z'
        }),
        alquiler({
          id: uuid(2),
          mueble_id: MESA,
          estado: 'en_curso',
          fecha_inicio: dia(-9),
          fecha_fin: dia(-4),
          fin_ocupacion: dia(-4),
          entregada_en: '2026-01-01T10:00:00.000Z'
        }),
        alquiler({
          id: uuid(3),
          mueble_id: uuid(3),
          estado: 'en_curso',
          fecha_inicio: dia(-9),
          fecha_fin: hoy,
          fin_ocupacion: hoy,
          entregada_en: '2026-01-01T10:00:00.000Z'
        })
      ]
    });
    const res = await lista('?vista=retrasadas');
    assert.deepEqual(ids(res), [uuid(2), uuid(1)]);
    for (const reserva of res.body.reservas) {
      assert.equal(reserva.retrasada, true);
      assert.equal(reserva.etiqueta, 'Retrasada');
      assert.deepEqual(reserva.acciones, ['recoger', 'ampliar']);
    }
  });

  test('en conflicto: las pagadas que no se pudieron confirmar, las más recientes primero', async () => {
    instalar({
      reservas: [
        alquiler({ id: uuid(1), estado: 'expirada', conflicto_en: '2026-10-10T10:00:00.000Z' }),
        alquiler({
          id: uuid(2),
          mueble_id: MESA,
          estado: 'cancelada',
          conflicto_en: '2026-10-11T10:00:00.000Z'
        }),
        alquiler({ id: uuid(3), mueble_id: uuid(3) })
      ]
    });
    const res = await lista('?vista=conflicto');
    assert.deepEqual(ids(res), [uuid(2), uuid(1)]);
    for (const reserva of res.body.reservas) {
      assert.equal(reserva.en_conflicto, true);
      assert.equal(reserva.etiqueta, 'No se pudo confirmar');
      assert.deepEqual(reserva.acciones, []);
    }
  });

  test('reembolsos: solo los que se quedaron a medias (8.6)', async () => {
    const cancelada = (n, cambios) =>
      alquiler({ id: uuid(n), mueble_id: uuid(n), estado: 'cancelada', ...cambios });
    instalar({
      reservas: [
        cancelada(1, {
          reembolso_solicitado_en: '2026-10-11T10:00:00.000Z',
          reembolso_importe: 60
        }),
        cancelada(2, {
          reembolso_solicitado_en: '2026-10-11T09:00:00.000Z',
          reembolso_importe: 60,
          stripe_refund_id: 're_hecho'
        }),
        cancelada(3, {}),
        // Dado por reembolsado desde el panel (se devolvió en el Dashboard de Stripe).
        cancelada(4, {
          reembolso_solicitado_en: '2026-10-11T08:00:00.000Z',
          reembolso_importe: 60,
          historial: [{ tipo: 'reembolso_dado_por_hecho', por: 'admin' }]
        })
      ]
    });
    const res = await lista('?vista=reembolsos');
    assert.deepEqual(ids(res), [uuid(1)]);
    const [reserva] = res.body.reservas;
    assert.equal(reserva.reembolso_a_medias, true);
    assert.deepEqual(reserva.reembolso, {
      solicitado_en: '2026-10-11T10:00:00.000Z',
      importe: 60,
      stripe_refund_id: null
    });
    assert.equal(reserva.etiqueta, 'Cancelada · reembolso a medias');
    assert.deepEqual(reserva.acciones, ['reintentar-reembolso', 'dar-por-reembolsado']);
  });

  test('legacy: contratos antiguos que no están cancelados', async () => {
    instalar({
      reservas: [
        alquiler({ id: uuid(1), origen: 'legacy', fecha_inicio: dia(-90), fecha_fin: dia(30) }),
        alquiler({ id: uuid(2), mueble_id: MESA, origen: 'legacy', estado: 'cancelada' }),
        alquiler({ id: uuid(3), mueble_id: uuid(3), origen: 'manual' })
      ]
    });
    const res = await lista('?vista=legacy');
    assert.deepEqual(ids(res), [uuid(1)]);
  });

  test(`todas: cualquier fila, las más recientes primero, como mucho ${MAX_TODAS}`, async () => {
    const reservas = Array.from({ length: MAX_TODAS + 5 }, (_, i) =>
      bloqueo({
        id: uuid(1000 + i),
        mueble_id: uuid(5000 + i),
        estado: i % 2 ? 'cancelada' : 'confirmada',
        created_at: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString()
      })
    );
    instalar({ reservas: [...reservas, venta()] });
    const res = await lista('?vista=todas');
    assert.equal(res.body.reservas.length, MAX_TODAS);
    assert.equal(res.body.reservas[0].id, uuid(301), 'la venta es la más reciente');
    assert.equal(res.body.reservas[1].id, uuid(1000 + MAX_TODAS + 4));
  });
});

describe('cada reserva de la lista', () => {
  test('todos los campos de un alquiler web, sin datos de Stripe ni el historial', async () => {
    instalar({ reservas: [alquiler()] });
    const res = await lista();
    assert.deepEqual(res.body.reservas[0], {
      id: uuid(101),
      referencia: 'A1B2C3D4',
      tipo: 'alquiler',
      estado: 'confirmada',
      origen: 'web',
      etiqueta: 'Confirmada',
      retrasada: false,
      en_conflicto: false,
      cancelacion_solicitada: false,
      pieza: { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' },
      fecha_inicio: dia(5),
      hora_entrega: '10:00',
      fecha_fin: dia(8),
      hora_recogida: '18:30',
      fin_ocupacion: dia(8),
      dias_margen: 2,
      modo_entrega: 'domicilio',
      modo_devolucion: 'tienda',
      direccion_entrega: CONTACTO_ANA.direccion,
      contacto: CONTACTO_ANA,
      importe_total: 120.5,
      pagado: true,
      reembolso: null,
      reembolso_a_medias: false,
      motivo: null,
      motivo_cancelacion: null,
      entregada_en: null,
      devuelta_en: null,
      created_at: '2026-10-01T10:00:00.000Z',
      acciones: ['entregar', 'cancelar']
    });
  });

  test('una compra de la web se nombra por su pedido, como en sus emails; una venta del panel, por la suya', async () => {
    instalar({
      reservas: [
        venta({ stripe_session_id: 'cs_compra_1' }),
        venta({
          id: 'fe0da000-0000-4000-8000-000000000009',
          mueble_id: MESA,
          origen: 'manual',
          stripe_session_id: null
        })
      ]
    });
    const res = await lista('?vista=todas');
    const porId = Object.fromEntries(res.body.reservas.map((r) => [r.id, r.referencia]));
    assert.equal(porId[uuid(301)], idPedidoDeSesion('cs_compra_1').slice(0, 8).toUpperCase());
    assert.equal(porId['fe0da000-0000-4000-8000-000000000009'], 'FE0DA000');
    assert.ok(!JSON.stringify(res.body).includes('cs_compra_1'), 'la sesión de Stripe no sale');
  });

  test('un bloqueo: sin horas, sin contacto y sin importe; la referencia es la suya', async () => {
    instalar({ reservas: [bloqueo({ id: 'b10c0000-0000-4000-8000-000000000001' })] });
    const [reserva] = (await lista()).body.reservas;
    assert.equal(reserva.referencia, 'B10C0000');
    assert.equal(reserva.hora_entrega, null);
    assert.equal(reserva.contacto, null);
    assert.equal(reserva.importe_total, null);
    assert.equal(reserva.pagado, false);
    assert.equal(reserva.motivo, 'Exposición en la tienda');
    assert.equal(reserva.pieza.referencia, 'NAV-SOF-001');
  });

  test('la solicitud de cancelación del cliente sale marcada', async () => {
    instalar({
      reservas: [
        alquiler({
          historial: [
            { tipo: 'creada', por: 'cliente' },
            { tipo: 'cancelacion_solicitada', detalle: 'Cambio de planes', por: 'cliente' }
          ]
        })
      ]
    });
    const [reserva] = (await lista()).body.reservas;
    assert.equal(reserva.cancelacion_solicitada, true);
    assert.deepEqual(reserva.acciones, ['entregar', 'cancelar']);
  });

  test('un contacto a medias: lo que falta, null', async () => {
    instalar({ reservas: [alquiler({ datos_contacto: { nombre: 'Luis' } })] });
    const [reserva] = (await lista()).body.reservas;
    assert.deepEqual(reserva.contacto, {
      nombre: 'Luis',
      email: null,
      telefono: null,
      direccion: null,
      notas: null
    });
  });

  test('una pieza que ya no está en el catálogo', async () => {
    instalar({ reservas: [alquiler({ mueble_id: uuid(77) })] });
    const [reserva] = (await lista()).body.reservas;
    assert.deepEqual(reserva.pieza, {
      id: uuid(77),
      nombre: '(pieza eliminada)',
      referencia: null
    });
  });

  test('las piezas se leen con una sola consulta aparte', async () => {
    instalar({
      reservas: [
        alquiler(),
        bloqueo({ mueble_id: SOFA }),
        alquiler({ id: uuid(2), mueble_id: MESA })
      ]
    });
    const desde = mock.method(fake, 'from');
    mock.method(supabase, 'from', (tabla) => desde(tabla));
    await lista('?vista=todas');
    assert.deepEqual(
      desde.mock.calls.map((c) => c.arguments[0]),
      ['reservas', 'muebles']
    );
  });

  test('sin reservas no se leen piezas', async () => {
    const desde = mock.method(fake, 'from');
    mock.method(supabase, 'from', (tabla) => desde(tabla));
    const res = await lista('?vista=entregas');
    assert.deepEqual(res.body.reservas, []);
    assert.deepEqual(
      desde.mock.calls.map((c) => c.arguments[0]),
      ['reservas']
    );
  });
});

// 8.7, una prueba por fila de la tabla (sin la fianza, que llega con R-e).
describe('etiqueta y acciones de cada combinación', () => {
  const ahora = new Date();
  const contexto = { hoy, ahora };
  const casos = [
    [
      'alquiler pendiente en plazo',
      alquiler({ estado: 'pendiente', expira_en: new Date(Date.now() + 60_000).toISOString() }),
      'Esperando pago',
      []
    ],
    [
      'alquiler pendiente con el plazo vencido',
      alquiler({ estado: 'pendiente', expira_en: new Date(Date.now() - 60_000).toISOString() }),
      'No pagada',
      []
    ],
    ['alquiler expirado', alquiler({ estado: 'expirada' }), 'No pagada', []],
    [
      'cualquiera con conflicto_en',
      alquiler({ estado: 'expirada', conflicto_en: '2026-10-10T10:00:00.000Z' }),
      'No se pudo confirmar',
      []
    ],
    ['alquiler confirmado', alquiler(), 'Confirmada', ['entregar', 'cancelar']],
    [
      'alquiler entregado a tiempo',
      alquiler({ estado: 'en_curso', fecha_inicio: dia(-2), fecha_fin: hoy }),
      'Entregada',
      ['recoger', 'ampliar']
    ],
    [
      'alquiler entregado y retrasado',
      alquiler({ estado: 'en_curso', fecha_inicio: dia(-5), fecha_fin: dia(-1) }),
      'Retrasada',
      ['recoger', 'ampliar']
    ],
    ['alquiler devuelto', alquiler({ estado: 'devuelta' }), 'Devuelta', []],
    ['alquiler cancelado', alquiler({ estado: 'cancelada' }), 'Cancelada', []],
    [
      'alquiler cancelado con el reembolso hecho',
      alquiler({
        estado: 'cancelada',
        reembolso_solicitado_en: '2026-10-10T10:00:00.000Z',
        stripe_refund_id: 're_1'
      }),
      'Cancelada',
      []
    ],
    [
      'alquiler cancelado con el reembolso a medias',
      alquiler({ estado: 'cancelada', reembolso_solicitado_en: '2026-10-10T10:00:00.000Z' }),
      'Cancelada · reembolso a medias',
      ['reintentar-reembolso', 'dar-por-reembolsado']
    ],
    [
      'alquiler cancelado con el reembolso a medias y conflicto_en',
      alquiler({
        estado: 'cancelada',
        reembolso_solicitado_en: '2026-10-10T10:00:00.000Z',
        conflicto_en: '2026-10-11T10:00:00.000Z'
      }),
      'Cancelada · reembolso a medias',
      ['reintentar-reembolso', 'dar-por-reembolsado']
    ],
    [
      'alquiler cancelado con el reembolso dado por hecho desde el panel',
      alquiler({
        estado: 'cancelada',
        reembolso_solicitado_en: '2026-10-10T10:00:00.000Z',
        historial: [{ tipo: 'reembolso_dado_por_hecho', por: 'admin' }]
      }),
      'Cancelada',
      []
    ],
    ['bloqueo activo', bloqueo(), 'Bloqueo', ['levantar-bloqueo']],
    ['bloqueo levantado', bloqueo({ estado: 'cancelada' }), 'Bloqueo levantado', []],
    ['venta', venta(), 'Venta', ['cancelar']],
    ['venta cancelada', venta({ estado: 'cancelada' }), 'Venta cancelada', []]
  ];
  for (const [nombre, fila, etiqueta, acciones] of casos) {
    test(`${nombre}: «${etiqueta}»`, () => {
      assert.deepEqual(situacion(fila, contexto), { etiqueta, acciones });
      const item = presentar(fila, undefined, contexto);
      assert.equal(item.etiqueta, etiqueta);
      assert.deepEqual(item.acciones, acciones);
    });
  }

  test('la fianza no cambia nada todavía (R-e)', () => {
    assert.deepEqual(situacion(alquiler({ fianza_estado: 'garantizada' }), contexto), {
      etiqueta: 'Confirmada',
      acciones: ['entregar', 'cancelar']
    });
  });

  test('retrasada solo cuenta para alquileres entregados', () => {
    const pasado = { fecha_inicio: dia(-9), fecha_fin: dia(-1) };
    assert.equal(
      presentar(alquiler({ estado: 'en_curso', ...pasado }), undefined, contexto).retrasada,
      true
    );
    assert.equal(presentar(alquiler(pasado), undefined, contexto).retrasada, false);
    assert.equal(
      presentar(alquiler({ estado: 'devuelta', ...pasado }), undefined, contexto).retrasada,
      false
    );
    assert.equal(presentar(bloqueo(pasado), undefined, contexto).retrasada, false);
  });
});
