// Tests de categoriasController.js (tarea 5): CRUD, jerarquía (categoría general vs.
// específica) y cálculo de estadísticas por categoría. Sin test previo para este archivo.
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

let fake;
afterEach(() => mock.restoreAll());

// Datos comunes: dos categorías generales, dos específicas y cuatro muebles. Las categorías llevan
// una columna que no existe hoy (`nota_interna`): si una lectura pública la devolviera, es que no
// elige sus columnas (H26). "Sillas" lleva además su `codigo` (A5), que solo sale en la lectura
// del panel.
const tiendaDePrueba = () =>
  crearFakeSupabase({
    categorias: [
      {
        id: 1,
        nombre: 'Mobiliario',
        categoria_padre_id: null,
        imagen_url: null,
        nota_interna: 'x'
      },
      {
        id: 2,
        nombre: 'Sillas',
        categoria_padre_id: 1,
        imagen_url: 'https://img.test/s.jpg',
        nota_interna: 'x',
        codigo: 'SIL'
      },
      { id: 3, nombre: 'Mesas', categoria_padre_id: 1, imagen_url: null, nota_interna: 'x' },
      { id: 4, nombre: 'Decoración', categoria_padre_id: null, imagen_url: null, nota_interna: 'x' }
    ],
    muebles: [
      { id: 'm1', categoria: 'Sillas', estado: 'disponible', precio_venta: 50 },
      { id: 'm2', categoria: 'Sillas', estado: 'vendido', precio_venta: 80 },
      { id: 'm3', categoria: 'Mesas', estado: 'alquilado', precio_venta: 120 },
      { id: 'm4', categoria: 'Decoración', estado: 'disponible', precio_venta: 20 }
    ]
  });

describe('GET /api/categorias — pública, sin estadísticas (H26)', () => {
  let tablasLeidas;
  beforeEach(() => {
    fake = tiendaDePrueba();
    tablasLeidas = [];
    mock.method(supabase, 'from', (tabla) => {
      tablasLeidas.push(tabla);
      return fake.from(tabla);
    });
  });

  test('devuelve solo las cuatro columnas de la categoría: ni estadísticas ni columnas nuevas', async () => {
    const res = await request(app).get('/api/categorias');

    assert.equal(res.status, 200);
    for (const categoria of res.body) {
      assert.deepEqual(Object.keys(categoria).sort(), [
        'categoria_padre_id',
        'id',
        'imagen_url',
        'nombre'
      ]);
    }
    assert.deepEqual(
      res.body.find((c) => c.nombre === 'Sillas'),
      {
        id: 2,
        nombre: 'Sillas',
        categoria_padre_id: 1,
        imagen_url: 'https://img.test/s.jpg'
      }
    );
  });

  test('ya no lee los muebles (las estadísticas los recorrían todos en cada visita)', async () => {
    await request(app).get('/api/categorias');

    assert.deepEqual(tablasLeidas, ['categorias']);
  });

  test('llegan ordenadas por nombre', async () => {
    const res = await request(app).get('/api/categorias');
    const nombres = res.body.map((c) => c.nombre);
    assert.deepEqual(
      nombres,
      [...nombres].sort((a, b) => a.localeCompare(b))
    );
  });

  test('sigue siendo cacheable por la CDN (es pública)', async () => {
    const res = await request(app).get('/api/categorias');

    assert.match(res.headers['cache-control'], /^public, /);
  });

  test('un error de Supabase al leer categorías da 500 con mensaje genérico', async () => {
    fake = crearFakeSupabase({
      categorias: [],
      fallos: { 'categorias.select': { message: 'caído' } }
    });
    mock.method(supabase, 'from', fake.from);
    mock.method(console, 'error', () => {});

    const res = await request(app).get('/api/categorias');
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error al obtener las categorías.' });
  });
});

describe('GET /api/admin/categorias/con-stats — estadísticas, solo para el panel (H26)', () => {
  const URL_STATS = '/api/admin/categorias/con-stats';
  beforeEach(() => {
    fake = tiendaDePrueba();
    mock.method(supabase, 'from', fake.from);
  });

  test('sin sesión, 401; con sesión de cliente, 403: las estadísticas no son públicas', async () => {
    assert.equal((await request(app).get(URL_STATS)).status, 401);
    assert.equal((await conCliente(request(app).get(URL_STATS))).status, 403);
  });

  test('una categoría específica (con padre) suma solo sus propios muebles por nombre', async () => {
    const res = await conAdmin(request(app).get(URL_STATS));
    assert.equal(res.status, 200);
    const sillas = res.body.find((c) => c.nombre === 'Sillas');
    assert.equal(sillas.stats.totalProductos, 2);
    assert.equal(sillas.stats.disponibles, 1);
    assert.equal(sillas.stats.vendidos, 1);
    assert.equal(sillas.stats.alquilados, 0);
  });

  test('una categoría general (sin padre) suma los muebles de TODAS sus hijas', async () => {
    const res = await conAdmin(request(app).get(URL_STATS));
    const mobiliario = res.body.find((c) => c.nombre === 'Mobiliario');
    // Sillas (2) + Mesas (1) = 3, aunque "Mobiliario" en sí no tiene ningún mueble con ese nombre
    assert.equal(mobiliario.stats.totalProductos, 3);
    assert.equal(mobiliario.stats.disponibles, 1);
    assert.equal(mobiliario.stats.vendidos, 1);
    assert.equal(mobiliario.stats.alquilados, 1);
  });

  test('una categoría general sin hijas con muebles da estadísticas en cero, no un error', async () => {
    fake = crearFakeSupabase({
      categorias: [{ id: 9, nombre: 'Vacía', categoria_padre_id: null }],
      muebles: []
    });
    mock.method(supabase, 'from', fake.from);

    const res = await conAdmin(request(app).get(URL_STATS));
    assert.equal(res.status, 200);
    assert.equal(res.body[0].stats.totalProductos, 0);
  });

  test('el valor total de venta se formatea como moneda en euros', async () => {
    const res = await conAdmin(request(app).get(URL_STATS));
    const sillas = res.body.find((c) => c.nombre === 'Sillas'); // 50 + 80 = 130
    assert.match(sillas.stats.valorTotalVenta, /130/);
    assert.match(sillas.stats.valorTotalVenta, /€/);
  });

  test('cada categoría lleva sus cuatro columnas, su `codigo` (A5) y `stats`, nada más, y no se guarda en ninguna caché', async () => {
    const res = await conAdmin(request(app).get(URL_STATS));

    const sillas = res.body.find((c) => c.nombre === 'Sillas');
    assert.deepEqual(Object.keys(sillas).sort(), [
      'categoria_padre_id',
      'codigo',
      'id',
      'imagen_url',
      'nombre',
      'stats'
    ]);
    assert.equal(sillas.codigo, 'SIL');
    for (const categoria of res.body) {
      assert.equal('nota_interna' in categoria, false);
    }
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('un error de Supabase da 500 con mensaje genérico', async () => {
    fake = crearFakeSupabase({
      categorias: [],
      fallos: { 'muebles.select': { message: 'caído' } }
    });
    mock.method(supabase, 'from', fake.from);
    mock.method(console, 'error', () => {});

    const res = await conAdmin(request(app).get(URL_STATS));
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body.error, /caído/);
  });
});

describe('POST /api/categorias — crear', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ categorias: [] });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin token, 401', async () => {
    const res = await request(app).post('/api/categorias').field('nombre', 'Nueva');
    assert.equal(res.status, 401);
  });

  test('con token de cliente (no admin), 403', async () => {
    const res = await conCliente(request(app).post('/api/categorias')).field('nombre', 'Nueva');
    assert.equal(res.status, 403);
  });

  test('sin categoria_padre_id, se crea como categoría general (null)', async () => {
    const res = await conAdmin(request(app).post('/api/categorias')).field('nombre', 'Nueva');
    assert.equal(res.status, 201);
    assert.equal(res.body.data[0].categoria_padre_id, null);
  });

  test('categoria_padre_id llega como texto y se guarda como número', async () => {
    const res = await conAdmin(request(app).post('/api/categorias'))
      .field('nombre', 'Hija')
      .field('categoria_padre_id', '7');
    assert.equal(res.status, 201);
    assert.equal(res.body.data[0].categoria_padre_id, 7);
    assert.equal(typeof res.body.data[0].categoria_padre_id, 'number');
  });

  test('sin imagen (ni archivo ni imagen_url), usa la imagen por defecto', async () => {
    const res = await conAdmin(request(app).post('/api/categorias')).field('nombre', 'Sin foto');
    assert.equal(res.status, 201);
    assert.match(res.body.data[0].imagen_url, /^https:\/\/images\.unsplash\.com/);
  });

  test('con imagen_url en el body (sin archivo), usa esa URL tal cual', async () => {
    const res = await conAdmin(request(app).post('/api/categorias'))
      .field('nombre', 'Con URL')
      .field('imagen_url', 'https://ejemplo.com/foto.jpg');
    assert.equal(res.status, 201);
    assert.equal(res.body.data[0].imagen_url, 'https://ejemplo.com/foto.jpg');
  });
});

describe('PUT /api/categorias/:id — editar (actualización parcial)', () => {
  // Nota: id como texto a propósito -- el doble de Supabase compara con === (no simula la
  // coerción de tipos que hace PostgREST de verdad), y req.params.id llega siempre como texto.
  // El propio controlador tampoco lo convierte a número antes de la consulta.
  beforeEach(() => {
    fake = crearFakeSupabase({
      categorias: [
        {
          id: '1',
          nombre: 'Original',
          imagen_url: 'https://ejemplo.com/vieja.jpg',
          categoria_padre_id: 5
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('cambiar solo el nombre no toca imagen_url ni categoria_padre_id', async () => {
    const res = await conAdmin(request(app).put('/api/categorias/1')).field(
      'nombre',
      'Nuevo nombre'
    );
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.categorias[0].nombre, 'Nuevo nombre');
    assert.equal(fake.tablas.categorias[0].imagen_url, 'https://ejemplo.com/vieja.jpg');
    assert.equal(fake.tablas.categorias[0].categoria_padre_id, 5);
  });

  test('imagen_url vacía borra la imagen (null), no la deja como cadena vacía', async () => {
    const res = await conAdmin(request(app).put('/api/categorias/1')).field('imagen_url', '');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.categorias[0].imagen_url, null);
  });

  test('categoria_padre_id vacío convierte la categoría en general (null)', async () => {
    const res = await conAdmin(request(app).put('/api/categorias/1')).field(
      'categoria_padre_id',
      ''
    );
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.categorias[0].categoria_padre_id, null);
  });

  test('sin token, 401', async () => {
    const res = await request(app).put('/api/categorias/1').field('nombre', 'x');
    assert.equal(res.status, 401);
  });
});

describe('DELETE /api/categorias/:id — eliminar', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ categorias: [{ id: '1', nombre: 'A borrar' }] });
    mock.method(supabase, 'from', fake.from);
  });

  test('borra la categoría y responde con éxito', async () => {
    const res = await conAdmin(request(app).delete('/api/categorias/1'));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(fake.tablas.categorias.length, 0);
  });

  test('sin token, 401, y no borra nada', async () => {
    const res = await request(app).delete('/api/categorias/1');
    assert.equal(res.status, 401);
    assert.equal(fake.tablas.categorias.length, 1);
  });
});
