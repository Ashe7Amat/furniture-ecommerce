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

describe('GET /api/categorias — jerarquía y estadísticas', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      categorias: [
        { id: 1, nombre: 'Mobiliario', categoria_padre_id: null },
        { id: 2, nombre: 'Sillas', categoria_padre_id: 1 },
        { id: 3, nombre: 'Mesas', categoria_padre_id: 1 },
        { id: 4, nombre: 'Decoración', categoria_padre_id: null }
      ],
      muebles: [
        { id: 'm1', categoria: 'Sillas', estado: 'disponible', precio_venta: 50 },
        { id: 'm2', categoria: 'Sillas', estado: 'vendido', precio_venta: 80 },
        { id: 'm3', categoria: 'Mesas', estado: 'alquilado', precio_venta: 120 },
        { id: 'm4', categoria: 'Decoración', estado: 'disponible', precio_venta: 20 }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('una categoría específica (con padre) suma solo sus propios muebles por nombre', async () => {
    const res = await request(app).get('/api/categorias');
    assert.equal(res.status, 200);
    const sillas = res.body.find((c) => c.nombre === 'Sillas');
    assert.equal(sillas.stats.totalProductos, 2);
    assert.equal(sillas.stats.disponibles, 1);
    assert.equal(sillas.stats.vendidos, 1);
    assert.equal(sillas.stats.alquilados, 0);
  });

  test('una categoría general (sin padre) suma los muebles de TODAS sus hijas', async () => {
    const res = await request(app).get('/api/categorias');
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

    const res = await request(app).get('/api/categorias');
    assert.equal(res.status, 200);
    assert.equal(res.body[0].stats.totalProductos, 0);
  });

  test('el valor total de venta se formatea como moneda en euros', async () => {
    const res = await request(app).get('/api/categorias');
    const sillas = res.body.find((c) => c.nombre === 'Sillas'); // 50 + 80 = 130
    assert.match(sillas.stats.valorTotalVenta, /130/);
    assert.match(sillas.stats.valorTotalVenta, /€/);
  });

  test('llegan ordenadas por nombre', async () => {
    const res = await request(app).get('/api/categorias');
    const nombres = res.body.map((c) => c.nombre);
    assert.deepEqual(
      nombres,
      [...nombres].sort((a, b) => a.localeCompare(b))
    );
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
    assert.doesNotMatch(res.body.error, /caído/); // no filtra el error interno
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
