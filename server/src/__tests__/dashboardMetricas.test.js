// Métricas del dashboard: cálculos puros (utils/metricasDashboard.js) y el endpoint
// GET /api/admin/dashboard/metricas con la base de datos simulada.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-dashboard';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const {
  calcularMetricas,
  calcularTicketMedio,
  calcularVentasPorMes,
  calcularTopCategorias,
  calcularClientes
} = require('../utils/metricasDashboard');

// "Hoy" fijo para que los meses del gráfico no dependan del día en que se ejecute el test.
const AHORA = new Date('2026-10-22T10:00:00.000Z');

const MUEBLES = [
  { id: 'm-silla-1', categoria: 'Sillas' },
  { id: 'm-silla-2', categoria: 'Sillas' },
  { id: 'm-mesa-1', categoria: 'Mesas' },
  { id: 'm-sofa-1', categoria: 'Sofás' }
];
const linea = (productId, extra = {}) => ({
  productId,
  nombre: productId,
  modalidad: 'compra',
  cantidad: 1,
  precio: 10,
  ...extra
});
const PEDIDOS = [
  {
    id: 'p1',
    estado: 'entregado',
    total: 100,
    created_at: '2026-10-05T09:00:00.000Z',
    cliente_id: 'c1',
    items: [linea('m-silla-1'), linea('m-mesa-1')]
  },
  {
    id: 'p2',
    estado: 'procesando',
    total: 200,
    created_at: '2026-10-15T09:00:00.000Z',
    cliente_id: 'c1',
    items: [linea('m-silla-2')]
  },
  {
    id: 'p3',
    estado: 'enviado',
    total: 60,
    created_at: '2026-08-20T09:00:00.000Z',
    cliente_id: null,
    cliente_info: { email: 'Invitado@Test.com' },
    items: [linea('m-sofa-1')]
  },
  {
    // Cancelado: no cuenta en nada.
    id: 'p4',
    estado: 'cancelado',
    total: 999,
    created_at: '2026-10-10T09:00:00.000Z',
    cliente_id: 'c2',
    items: [linea('m-sofa-1'), linea('m-sofa-1')]
  },
  {
    // Fuera de la ventana de 6 meses.
    id: 'p5',
    estado: 'entregado',
    total: 40,
    created_at: '2026-03-31T09:00:00.000Z',
    cliente_id: 'c3',
    items: [linea('m-mesa-1'), linea('m-silla-1')]
  }
];
const CLIENTES = [
  { id: 'c1', rol: 'cliente', creado_en: '2026-10-02T09:00:00.000Z' },
  { id: 'c2', rol: 'cliente', creado_en: '2026-09-30T09:00:00.000Z' },
  { id: 'c3', rol: 'cliente', creado_en: '2026-10-20T09:00:00.000Z' },
  { id: 'a1', rol: 'admin', creado_en: '2026-10-01T09:00:00.000Z' }
];

describe('calcularTicketMedio', () => {
  test('suma de totales entre número de pedidos, sin contar los cancelados', () => {
    // (100 + 200 + 60 + 40) / 4 = 100
    assert.equal(calcularTicketMedio(PEDIDOS), 100);
  });

  test('redondea a dos decimales', () => {
    const pedidos = [{ total: 10 }, { total: 10 }, { total: 10.01 }];
    assert.equal(calcularTicketMedio(pedidos), 10);
    assert.equal(calcularTicketMedio([{ total: 1 }, { total: 2 }]), 1.5);
    assert.equal(calcularTicketMedio([{ total: 1 }, { total: 1 }, { total: 2 }]), 1.33);
  });

  test('sin pedidos (o solo cancelados) devuelve 0, no inventa nada', () => {
    assert.equal(calcularTicketMedio([]), 0);
    assert.equal(calcularTicketMedio(undefined), 0);
    assert.equal(calcularTicketMedio([{ estado: 'cancelado', total: 50 }]), 0);
  });

  test('un total que no es número cuenta como 0', () => {
    assert.equal(calcularTicketMedio([{ total: null }, { total: 20 }]), 10);
  });
});

describe('calcularVentasPorMes', () => {
  test('devuelve los últimos 6 meses, el actual incluido, en orden y con 0 donde no hay ventas', () => {
    assert.deepEqual(calcularVentasPorMes(PEDIDOS, AHORA), [
      { mes: 'May', total: 0 },
      { mes: 'Jun', total: 0 },
      { mes: 'Jul', total: 0 },
      { mes: 'Ago', total: 60 },
      { mes: 'Sep', total: 0 },
      { mes: 'Oct', total: 300 }
    ]);
  });

  test('cruza el cambio de año', () => {
    const ahora = new Date('2026-02-10T10:00:00.000Z');
    const pedidos = [
      { estado: 'entregado', total: 70, created_at: '2025-12-31T12:00:00.000Z' },
      { estado: 'entregado', total: 30, created_at: '2026-02-01T12:00:00.000Z' }
    ];
    assert.deepEqual(
      calcularVentasPorMes(pedidos, ahora).map((m) => m.mes),
      ['Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb']
    );
    const totales = calcularVentasPorMes(pedidos, ahora).map((m) => m.total);
    assert.deepEqual(totales, [0, 0, 0, 70, 0, 30]);
  });

  test('agrupa por el mes en hora de Madrid: el 31 a las 23:30 UTC ya es el mes siguiente', () => {
    const pedidos = [{ estado: 'entregado', total: 10, created_at: '2026-09-30T22:30:00.000Z' }];
    const meses = calcularVentasPorMes(pedidos, AHORA);
    assert.equal(meses.find((m) => m.mes === 'Sep').total, 0);
    assert.equal(meses.find((m) => m.mes === 'Oct').total, 10);
  });

  test('ignora fechas inválidas y sin pedidos devuelve 6 meses a 0', () => {
    const meses = calcularVentasPorMes(
      [{ estado: 'entregado', total: 5, created_at: 'no-es-fecha' }],
      AHORA
    );
    assert.equal(meses.length, 6);
    assert.ok(meses.every((m) => m.total === 0));
    assert.equal(calcularVentasPorMes(undefined, AHORA).length, 6);
  });
});

describe('calcularTopCategorias', () => {
  test('cuenta las piezas vendidas por categoría, de más a menos, sin cancelados', () => {
    assert.deepEqual(calcularTopCategorias(PEDIDOS, MUEBLES), [
      { categoria: 'Sillas', cantidad: 3 },
      { categoria: 'Mesas', cantidad: 2 },
      { categoria: 'Sofás', cantidad: 1 }
    ]);
  });

  test('se queda con las 5 primeras', () => {
    const muebles = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => ({
      id: `m-${c}`,
      categoria: c
    }));
    const pedidos = [
      {
        estado: 'entregado',
        items: muebles.map((m, i) => linea(m.id, { cantidad: 10 - i }))
      }
    ];
    const top = calcularTopCategorias(pedidos, muebles);
    assert.equal(top.length, 5);
    assert.deepEqual(
      top.map((c) => c.categoria),
      ['A', 'B', 'C', 'D', 'E']
    );
  });

  test('no cuenta alquileres, ni piezas que ya no existen o sin categoría', () => {
    const pedidos = [
      {
        estado: 'entregado',
        items: [
          linea('m-silla-1', { modalidad: 'alquiler' }),
          linea('m-borrada'),
          linea('m-sin-cat'),
          linea('m-mesa-1', { cantidad: undefined })
        ]
      },
      { estado: 'entregado', items: 'no-es-un-array' },
      { estado: 'entregado' }
    ];
    const muebles = [...MUEBLES, { id: 'm-sin-cat', categoria: null }];
    assert.deepEqual(calcularTopCategorias(pedidos, muebles), [
      { categoria: 'Mesas', cantidad: 1 }
    ]);
    assert.deepEqual(calcularTopCategorias(undefined, undefined), []);
  });
});

describe('calcularClientes', () => {
  test('nuevos este mes (sin administradores) y recurrentes (más de un pedido, sin cancelados)', () => {
    // c1 tiene 2 pedidos; c2 solo uno cancelado; el invitado y c3, uno cada uno.
    assert.deepEqual(calcularClientes(PEDIDOS, CLIENTES, AHORA), {
      nuevosEsteMes: 2,
      recurrentes: 1
    });
  });

  test('un invitado que repite se reconoce por su email, sin distinguir mayúsculas', () => {
    const pedidos = [
      { estado: 'entregado', cliente_info: { email: 'Ana@Test.com ' } },
      { estado: 'entregado', cliente_info: { email: 'ana@test.com' } },
      { estado: 'entregado', cliente_info: {} },
      { estado: 'entregado' }
    ];
    assert.deepEqual(calcularClientes(pedidos, [], AHORA), { nuevosEsteMes: 0, recurrentes: 1 });
  });

  test('sin datos, todo a 0', () => {
    assert.deepEqual(calcularClientes(undefined, undefined, AHORA), {
      nuevosEsteMes: 0,
      recurrentes: 0
    });
  });
});

describe('calcularMetricas', () => {
  test('junta todo, con los ingresos de alquiler a 0', () => {
    const metricas = calcularMetricas({
      pedidos: PEDIDOS,
      muebles: MUEBLES,
      clientes: CLIENTES,
      ahora: AHORA
    });
    assert.equal(metricas.ticketMedio, 100);
    assert.equal(metricas.ventasPorMes.length, 6);
    assert.equal(metricas.topCategorias[0].categoria, 'Sillas');
    assert.deepEqual(metricas.clientes, { nuevosEsteMes: 2, recurrentes: 1 });
    assert.equal(metricas.ingresosAlquiler, 0);
  });

  test('usa la fecha de hoy si no se le da otra', () => {
    const metricas = calcularMetricas({ pedidos: [], muebles: [], clientes: [] });
    assert.equal(metricas.ventasPorMes.length, 6);
  });
});

describe('GET /api/admin/dashboard/metricas', () => {
  const tokenAdmin = jwt.sign(
    { sub: 'a1', email: 'admin@nave5barcelona.com', rol: 'admin' },
    process.env.JWT_SECRET
  );
  const tokenCliente = jwt.sign(
    { sub: 'c1', email: 'c@test.com', rol: 'cliente' },
    process.env.JWT_SECRET
  );
  let fake;

  const instalar = (opciones = {}) => {
    fake = crearFakeSupabase({
      pedidos: PEDIDOS,
      muebles: MUEBLES,
      clientes: CLIENTES,
      ...opciones
    });
    mock.method(supabase, 'from', fake.from);
  };

  beforeEach(() => {
    mock.method(console, 'error', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
  });

  test('sin sesión responde 401 y no toca la base de datos', async () => {
    instalar();
    const res = await request(app).get('/api/admin/dashboard/metricas');
    assert.equal(res.status, 401);
  });

  test('un cliente que no es admin no lo ve', async () => {
    instalar();
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenCliente}`);
    assert.equal(res.status, 403);
  });

  test('el admin recibe las métricas calculadas y no se escribe nada', async () => {
    instalar();
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ticketMedio, 100);
    assert.equal(res.body.ventasPorMes.length, 6);
    assert.deepEqual(res.body.topCategorias[0], { categoria: 'Sillas', cantidad: 3 });
    assert.equal(typeof res.body.clientes.nuevosEsteMes, 'number');
    assert.equal(res.body.clientes.recurrentes, 1);
    assert.equal(res.body.ingresosAlquiler, 0);
    assert.deepEqual(fake.escrituras, []);
  });

  test('pide solo las columnas necesarias de clientes (nunca la contraseña)', async () => {
    instalar({ clientes: [{ ...CLIENTES[0], password: 'hash-secreto' }] });
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.ok(!JSON.stringify(res.body).includes('hash-secreto'));
  });

  test('lee más de 1000 filas, página a página', async () => {
    const muchos = Array.from({ length: 1001 }, (_, i) => ({
      id: `pedido-${String(i).padStart(4, '0')}`,
      estado: 'entregado',
      total: 10,
      created_at: '2026-10-05T09:00:00.000Z',
      cliente_id: null,
      items: []
    }));
    instalar({ pedidos: muchos });
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ticketMedio, 10);
  });

  test('si falla la base de datos, 500 genérico', async () => {
    instalar({ fallos: { 'pedidos.select': { code: 'XX000', message: 'detalle interno' } } });
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(res.body).includes('detalle interno'));
  });

  test('si el error no trae mensaje, también responde 500', async () => {
    instalar({ fallos: { 'muebles.select': {} } });
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 500);
  });

  test('sin filas devuelve ceros, no datos inventados', async () => {
    instalar({ pedidos: [], muebles: [], clientes: [] });
    const res = await request(app)
      .get('/api/admin/dashboard/metricas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ticketMedio, 0);
    assert.deepEqual(res.body.topCategorias, []);
    assert.deepEqual(res.body.clientes, { nuevosEsteMes: 0, recurrentes: 0 });
  });
});
