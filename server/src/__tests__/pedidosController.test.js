// Tests de pedidosController.js (tarea 5): obtenerMisPedidos y obtenerPedidos no tenían ningún
// test todavía (PATCH /estado ya está cubierto por validacionPedidos.test.js -- aquí solo se
// añade el caso de "pedido no encontrado" que faltaba ahí).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const tokenCliente = (email) =>
  jwt.sign({ email, nombre: 'Cliente', rol: 'cliente' }, process.env.JWT_SECRET);
const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

let fake;
afterEach(() => mock.restoreAll());

describe('GET /api/pedidos/mios — obtenerMisPedidos', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      pedidos: [
        {
          id: 'p1',
          cliente_info: { email: 'ana@example.com' },
          estado: 'entregado',
          created_at: '2026-01-01'
        },
        {
          id: 'p2',
          cliente_info: { email: 'ANA@EXAMPLE.COM' },
          estado: 'procesando',
          created_at: '2026-02-01'
        },
        {
          id: 'p3',
          cliente_info: { email: 'otro@example.com' },
          estado: 'enviado',
          created_at: '2026-01-15'
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin token, 401', async () => {
    const res = await request(app).get('/api/pedidos/mios');
    assert.equal(res.status, 401);
  });

  test('devuelve solo los pedidos del email logueado, comparado sin distinguir mayúsculas', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('ana@example.com')}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every((p) => p.id !== 'p3'));
  });

  test('más recientes primero', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('ana@example.com')}`);

    assert.deepEqual(
      res.body.map((p) => p.id),
      ['p2', 'p1']
    );
  });

  test('H36: devuelve solo id, fecha, estado, total y piezas; nunca cliente_info ni datos internos', async () => {
    fake.tablas.pedidos[0] = {
      ...fake.tablas.pedidos[0],
      total: 120,
      items: [{ productId: 'm1', nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 120 }],
      cliente_id: 'cliente-ana',
      stripe_session_id: 'cs_test_secreto',
      direccion_envio: 'Calle Falsa 123',
      metodo_entrega: 'domicilio'
    };

    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('ana@example.com')}`);

    assert.equal(res.status, 200);
    const permitidas = ['created_at', 'estado', 'id', 'items', 'total'];
    for (const pedido of res.body) {
      const otras = Object.keys(pedido).filter((columna) => !permitidas.includes(columna));
      assert.deepEqual(otras, [], `columnas de más en el pedido ${pedido.id}`);
    }
    assert.deepEqual(Object.keys(res.body.find((p) => p.id === 'p1')).sort(), permitidas);
    const p1 = res.body.find((p) => p.id === 'p1');
    assert.equal(p1.total, 120);
    assert.equal(p1.items[0].nombre, 'Silla');
    assert.ok(!JSON.stringify(res.body).includes('cs_test_secreto'));
  });

  test('un cliente sin pedidos recibe un array vacío, no un error', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('nadie@example.com')}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });
});

describe('GET /api/pedidos/mios — H17: el email de la cuenta no hace de patrón', () => {
  // El registro acepta emails con '_' y no verifica que el email sea de quien se registra (H18).
  // Sin escapar, "juan_perez@example.com" coincidía por ILIKE con "juan.perez@example.com".
  beforeEach(() => {
    fake = crearFakeSupabase({
      pedidos: [
        {
          id: 'ajeno',
          cliente_info: { email: 'juan.perez@example.com' },
          estado: 'entregado',
          created_at: '2026-01-01'
        },
        {
          id: 'propio',
          cliente_info: { email: 'juan_perez@example.com' },
          estado: 'procesando',
          created_at: '2026-02-01'
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('una cuenta con "_" en el email NO ve el pedido de otro email que solo cambia en ese carácter', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('juan_perez@example.com')}`);

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((p) => p.id),
      ['propio']
    );
  });

  test('la cuenta del otro email tampoco ve el pedido de la del "_"', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('juan.perez@example.com')}`);

    assert.deepEqual(
      res.body.map((p) => p.id),
      ['ajeno']
    );
  });

  test('con el email en otras mayúsculas, sigue viendo solo los suyos', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('JUAN_PEREZ@EXAMPLE.COM')}`);

    assert.deepEqual(
      res.body.map((p) => p.id),
      ['propio']
    );
  });
});

describe('GET /api/pedidos — obtenerPedidos (solo admin)', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      pedidos: [
        { id: 'p1', estado: 'entregado', created_at: '2026-01-01' },
        { id: 'p2', estado: 'procesando', created_at: '2026-03-01' }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin token, 401', async () => {
    const res = await request(app).get('/api/pedidos');
    assert.equal(res.status, 401);
  });

  test('con token de cliente (no admin), 403', async () => {
    const res = await request(app)
      .get('/api/pedidos')
      .set('Authorization', `Bearer ${tokenCliente('x@example.com')}`);
    assert.equal(res.status, 403);
  });

  // CAMBIADO A PROPÓSITO (5 oct 2026, H37): la respuesta pasa de ser la lista entera a una página
  // con su total y los pendientes.
  test('con token de admin, devuelve la primera página de pedidos, más recientes primero', async () => {
    const res = await request(app).get('/api/pedidos').set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.pedidos.map((p) => p.id),
      ['p2', 'p1']
    );
    assert.equal(res.body.total, 2);
    assert.equal(res.body.pagina, 1);
    assert.equal(res.body.porPagina, 20);
    assert.equal(res.body.totalPaginas, 1);
    assert.equal(res.body.pendientes, 1);
  });
});

describe('GET /api/pedidos — paginación (H37)', () => {
  // 45 pedidos: el 1 es el más antiguo y el 45 el más reciente; uno de cada tres, "procesando".
  const fecha = (n) => `2026-01-01T00:${String(n).padStart(2, '0')}:00Z`;
  const pedidos = Array.from({ length: 45 }, (_, i) => ({
    id: `p${i + 1}`,
    estado: (i + 1) % 3 === 0 ? 'procesando' : 'entregado',
    created_at: fecha(i + 1),
    total: 10,
    items: [],
    cliente_info: { nombre: 'Ana', email: 'ana@example.com' },
    direccion_envio: 'Calle Falsa 123',
    stripe_session_id: `cs_${i + 1}`,
    cliente_id: 'cliente-ana'
  }));
  const pedir = (query = '') =>
    request(app).get(`/api/pedidos${query}`).set('Authorization', `Bearer ${tokenAdmin}`);

  beforeEach(() => {
    fake = crearFakeSupabase({ pedidos });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin parámetros no carga más de 20: los 20 más recientes, con el total y los pendientes de todo', async () => {
    const res = await pedir();

    assert.equal(res.status, 200);
    assert.equal(res.body.pedidos.length, 20);
    assert.equal(res.body.pedidos[0].id, 'p45');
    assert.equal(res.body.pedidos[19].id, 'p26');
    assert.equal(res.body.total, 45);
    assert.equal(res.body.totalPaginas, 3);
    assert.equal(res.body.pendientes, 15, 'los "procesando" de toda la historia, no de la página');
  });

  test('?page=3 trae los que quedan', async () => {
    const res = await pedir('?page=3');

    assert.deepEqual(
      res.body.pedidos.map((p) => p.id),
      ['p5', 'p4', 'p3', 'p2', 'p1']
    );
    assert.equal(res.body.pagina, 3);
  });

  test('?limit cambia el tamaño de la página; más allá de la última, una lista vacía', async () => {
    const res = await pedir('?page=2&limit=40');
    assert.equal(res.body.pedidos.length, 5);
    assert.equal(res.body.totalPaginas, 2);

    const vacia = await pedir('?page=9');
    assert.equal(vacia.status, 200);
    assert.deepEqual(vacia.body.pedidos, []);
    assert.equal(vacia.body.total, 45);
  });

  test('?estado filtra en el servidor: el total es el de ese estado, los pendientes siguen siendo todos', async () => {
    const res = await pedir('?estado=procesando&limit=10');

    assert.equal(res.body.total, 15);
    assert.equal(res.body.totalPaginas, 2);
    assert.ok(res.body.pedidos.every((p) => p.estado === 'procesando'));
    assert.equal(res.body.pedidos[0].id, 'p45');
    assert.equal(res.body.pendientes, 15);
  });

  test('estado vacío ("Todos los estados") cuenta como sin filtro', async () => {
    const res = await pedir('?estado=');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 45);
  });

  test('solo las columnas que enseña el panel: sin stripe_session_id ni cliente_id (H36)', async () => {
    const res = await pedir('?limit=1');
    assert.deepEqual(Object.keys(res.body.pedidos[0]).sort(), [
      'cliente_info',
      'created_at',
      'direccion_envio',
      'estado',
      'id',
      'items',
      'total'
    ]);
  });

  test('parámetros no válidos: 400 con un mensaje claro, sin consultar la base de datos', async () => {
    let consultas = 0;
    const original = fake.from;
    mock.method(supabase, 'from', (tabla) => {
      consultas++;
      return original(tabla);
    });

    const casos = [
      ['?page=0', /página/],
      ['?page=abc', /página/],
      ['?page=1.5', /página/],
      ['?limit=0', /límite/],
      ['?limit=101', /límite/],
      ['?estado=perdido', /Estado no válido/]
    ];
    for (const [query, mensaje] of casos) {
      const res = await pedir(query);
      assert.equal(res.status, 400, query);
      assert.match(res.body.error, mensaje, query);
    }
    assert.equal(consultas, 0);
  });

  test('si falla la cuenta de pendientes, 500 genérico', async () => {
    fake = crearFakeSupabase({
      pedidos,
      fallos: {
        'pedidos.select': (consulta) => (consulta.usa.has('range') ? null : { message: 'caída' })
      }
    });
    mock.method(supabase, 'from', fake.from);
    mock.method(console, 'error', () => {});

    const res = await pedir();
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body.error, /caída/);
  });
});

describe('PATCH /api/pedidos/:id/estado — caso no cubierto: pedido inexistente', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ pedidos: [{ id: 'pedido-1', estado: 'procesando' }] });
    mock.method(supabase, 'from', fake.from);
  });

  test('un id que no existe da 404, no 500 ni un 200 vacío', async () => {
    const res = await request(app)
      .patch('/api/pedidos/no-existe/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'enviado' });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Pedido no encontrado.');
  });
});
