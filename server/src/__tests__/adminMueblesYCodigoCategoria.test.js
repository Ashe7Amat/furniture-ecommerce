// A5: lo que el panel necesita para gestionar las referencias.
// - GET /api/admin/muebles: el inventario del panel, solo para administradores, con la referencia
//   de cada mueble y los precios reales, sin caché.
// - categorias.codigo: el código de 3 letras se crea, se edita y se valida (schemas/categorias.js),
//   y si ya lo usa otra categoría se responde 400 con un mensaje claro.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const tokenCliente = jwt.sign(
  { email: 'cliente@test.com', nombre: 'Cliente', rol: 'cliente' },
  process.env.JWT_SECRET
);
const conAdmin = (req) => req.set('Authorization', `Bearer ${tokenAdmin}`);
const conCliente = (req) => req.set('Authorization', `Bearer ${tokenCliente}`);

// El mensaje que da Postgres al chocar con el índice único de categorias.codigo.
const CODIGO_REPETIDO = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "categorias_codigo_key"'
};

let fake;
afterEach(() => mock.restoreAll());

describe('GET /api/admin/muebles — el inventario del panel (A5)', () => {
  const URL_ADMIN = '/api/admin/muebles';
  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'm1',
          nombre: 'Silla Tolix',
          categoria: 'Sillas',
          descripcion: 'Metal',
          precio_venta: 120,
          precio_alquiler_dia: 8,
          imagenes: [],
          estado: 'disponible',
          referencia: 'NAV-SIL-001',
          created_at: '2026-10-01T10:00:00Z',
          nota_interna: 'no sale'
        },
        {
          id: 'm2',
          nombre: 'Mesa de roble',
          categoria: 'Mesas',
          descripcion: 'Roble',
          precio_venta: 900,
          precio_alquiler_dia: null,
          imagenes: [],
          estado: 'vendido',
          referencia: null,
          created_at: '2026-10-02T10:00:00Z'
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin sesión, 401; con sesión de cliente, 403', async () => {
    assert.equal((await request(app).get(URL_ADMIN)).status, 401);
    assert.equal((await conCliente(request(app).get(URL_ADMIN))).status, 403);
  });

  test('devuelve los precios reales y la referencia, del más reciente al más antiguo', async () => {
    const res = await conAdmin(request(app).get(URL_ADMIN));
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((m) => m.id),
      ['m2', 'm1']
    );
    const silla = res.body.find((m) => m.id === 'm1');
    assert.equal(silla.referencia, 'NAV-SIL-001');
    assert.equal(silla.precio_venta, 120);
    assert.equal(silla.precio_alquiler_dia, 8);
    assert.equal(res.body.find((m) => m.id === 'm2').referencia, null);
  });

  test('elige sus columnas: las públicas más la referencia, nada más (H26)', async () => {
    const res = await conAdmin(request(app).get(URL_ADMIN));
    assert.deepEqual(Object.keys(res.body[1]).sort(), [
      'categoria',
      'descripcion',
      'estado',
      'id',
      'imagenes',
      'nombre',
      'precio_alquiler_dia',
      'precio_venta',
      'referencia'
    ]);
  });

  test('no se guarda en ninguna caché', async () => {
    const res = await conAdmin(request(app).get(URL_ADMIN));
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('un error de Supabase da 500 con mensaje genérico', async () => {
    fake.fallos['muebles.select'] = { message: 'caído' };
    mock.method(console, 'error', () => {});
    const res = await conAdmin(request(app).get(URL_ADMIN));
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body.error, /caído/);
  });
});

describe('POST /api/categorias — código de la categoría (A5)', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ categorias: [] });
    mock.method(supabase, 'from', fake.from);
  });
  const crear = (codigo) => {
    const peticion = conAdmin(request(app).post('/api/categorias')).field('nombre', 'Sofás');
    return codigo === undefined ? peticion : peticion.field('codigo', codigo);
  };

  test('se guarda en mayúsculas y sin espacios', async () => {
    const res = await crear(' sof ');
    assert.equal(res.status, 201);
    assert.equal(fake.tablas.categorias[0].codigo, 'SOF');
  });

  test('sin código, o con el campo vacío, la categoría se crea sin código (null)', async () => {
    assert.equal((await crear()).status, 201);
    assert.equal((await crear('')).status, 201);
    assert.deepEqual(
      fake.tablas.categorias.map((c) => c.codigo),
      [null, null]
    );
  });

  for (const malo of ['SO', 'SOFA', 'S0F', 'SÑF', 'S-F']) {
    test(`"${malo}" no es un código válido: 400 y no se crea nada`, async () => {
      const res = await crear(malo);
      assert.equal(res.status, 400);
      assert.match(res.body.error, /3 letras/);
      assert.equal(fake.tablas.categorias.length, 0);
    });
  }

  test('si otra categoría ya usa el código, 400 con un mensaje claro', async () => {
    fake.fallos['categorias.insert'] = CODIGO_REPETIDO;
    const res = await crear('SIL');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Ese código ya lo usa otra categoría.');
  });

  test('un 23505 de otro índice sigue siendo el 500 genérico', async () => {
    fake.fallos['categorias.insert'] = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "categorias_pkey"'
    };
    mock.method(console, 'error', () => {});
    const res = await crear('SIL');
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al crear la categoría.');
  });
});

describe('PUT /api/categorias/:id — código de la categoría (A5)', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      categorias: [{ id: '1', nombre: 'Sillas', codigo: 'SIL', categoria_padre_id: 5 }]
    });
    mock.method(supabase, 'from', fake.from);
  });
  const editar = () => conAdmin(request(app).put('/api/categorias/1'));

  test('sin el campo, el código no se toca', async () => {
    const res = await editar().field('nombre', 'Sillas y taburetes');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.categorias[0].codigo, 'SIL');
  });

  test('se cambia, en mayúsculas', async () => {
    const res = await editar().field('codigo', 'tab');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.categorias[0].codigo, 'TAB');
  });

  test('vacío, la categoría se queda sin código (null)', async () => {
    const res = await editar().field('codigo', '');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.categorias[0].codigo, null);
  });

  test('un código no válido da 400 y no cambia nada', async () => {
    const res = await editar().field('codigo', 'SILLA');
    assert.equal(res.status, 400);
    assert.equal(fake.tablas.categorias[0].codigo, 'SIL');
  });

  test('si otra categoría ya usa el código, 400 con un mensaje claro', async () => {
    fake.fallos['categorias.update'] = CODIGO_REPETIDO;
    const res = await editar().field('codigo', 'MES');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Ese código ya lo usa otra categoría.');
  });
});
