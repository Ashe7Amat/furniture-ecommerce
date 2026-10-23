// Duplicar una pieza desde el inventario del panel (POST /api/muebles/:id/duplicar, 21 oct 2026),
// por la ruta HTTP y contra el doble de Supabase: la copia lleva los mismos datos menos las fotos,
// sale disponible y con la referencia siguiente de su categoría, y la original no cambia.
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
  { email: 'ana@test.com', nombre: 'Ana', rol: 'cliente' },
  process.env.JWT_SECRET
);

const CATEGORIAS = [
  { id: 20, nombre: 'Sillas y asientos', codigo: 'SIL', categoria_padre_id: 17 },
  { id: 21, nombre: 'Mesas y mobiliario', codigo: 'MES', categoria_padre_id: 17 },
  { id: 40, nombre: 'Taburetes', codigo: null, categoria_padre_id: 17 }
];

const pieza = (id, referencia, extra = {}) => ({
  id,
  nombre: `Pieza ${id}`,
  categoria: 'Sillas y asientos',
  categoria_id: 20,
  descripcion: `Descripción de ${id}`,
  precio_venta: 450,
  precio_alquiler_dia: 22.5,
  imagenes: [`https://img.test/${id}-1.jpg`, `https://img.test/${id}-2.jpg`],
  estado: 'disponible',
  disponible: true,
  referencia,
  created_at: '2026-10-01T10:00:00Z',
  ...extra
});

const MUEBLES = () => [
  pieza('s1', 'NAV-SIL-001'),
  pieza('s2', 'NAV-SIL-002', {
    nombre: 'Silla Thonet',
    descripcion: 'Madera curvada, restaurada.',
    precio_venta: 1250,
    precio_alquiler_dia: null,
    estado: 'vendido',
    disponible: false
  }),
  pieza('s7', 'NAV-SIL-007'),
  pieza('m1', 'NAV-MES-001', { categoria: 'Mesas y mobiliario', categoria_id: 21 }),
  pieza('m4', 'NAV-MES-004', { categoria: 'Mesas y mobiliario', categoria_id: 21 })
];

let fake;
afterEach(() => mock.restoreAll());
beforeEach(() => {
  fake = crearFakeSupabase({ categorias: CATEGORIAS, muebles: MUEBLES() });
  mock.method(supabase, 'from', fake.from);
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});

const duplicar = (id, token = tokenAdmin) =>
  request(app).post(`/api/muebles/${id}/duplicar`).set('Authorization', `Bearer ${token}`);
const copias = () => fake.tablas.muebles.filter((m) => m.nombre.endsWith(' (Copia)'));

describe('duplicar una pieza', () => {
  test('crea una pieza nueva con la referencia siguiente de su categoría (MAX + 1, no la de la original + 1)', async () => {
    const res = await duplicar('s2');

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].referencia, 'NAV-SIL-008');
    assert.equal(fake.tablas.muebles.length, 6);
    assert.equal(copias().length, 1);
  });

  test('la copia lleva los mismos datos, "(Copia)" en el nombre, sin fotos y disponible', async () => {
    const res = await duplicar('s2');
    const copia = res.body.data[0];

    assert.equal(copia.nombre, 'Silla Thonet (Copia)');
    assert.equal(copia.categoria, 'Sillas y asientos');
    assert.equal(copia.categoria_id, 20);
    assert.equal(copia.descripcion, 'Madera curvada, restaurada.');
    assert.equal(copia.precio_venta, 1250);
    assert.equal(copia.precio_alquiler_dia, null);
    assert.deepEqual(copia.imagenes, []);
    assert.equal(copia.estado, 'disponible');
    assert.equal(copia.disponible, true);
    assert.notEqual(copia.id, 's2');
  });

  test('la pieza original no cambia', async () => {
    const antes = structuredClone(fake.tablas.muebles.find((m) => m.id === 's2'));

    await duplicar('s2');

    assert.deepEqual(
      fake.tablas.muebles.find((m) => m.id === 's2'),
      antes
    );
    const escriturasEnLaOriginal = fake.escrituras.filter(
      (e) => e.tabla === 'muebles' && e.accion === 'update'
    );
    assert.deepEqual(escriturasEnLaOriginal, []);
  });

  test('cada categoría cuenta aparte, y duplicar dos veces da dos referencias seguidas', async () => {
    const mesa = await duplicar('m1');
    const otra = await duplicar('m1');

    assert.equal(mesa.body.data[0].referencia, 'NAV-MES-005');
    assert.equal(otra.body.data[0].referencia, 'NAV-MES-006');
    assert.equal(otra.body.data[0].nombre, 'Pieza m1 (Copia)');
  });

  test('una pieza antigua sin categoria_id: la copia la resuelve por el nombre de la categoría', async () => {
    fake.tablas.muebles.push(
      pieza('v1', null, { categoria: 'Mesas y mobiliario', categoria_id: null })
    );

    const res = await duplicar('v1');

    assert.equal(res.status, 201);
    assert.equal(res.body.data[0].categoria_id, 21);
    assert.equal(res.body.data[0].referencia, 'NAV-MES-005');
  });

  test('en una categoría sin código, la copia sale sin referencia', async () => {
    fake.tablas.muebles.push(pieza('t1', null, { categoria: 'Taburetes', categoria_id: 40 }));

    const res = await duplicar('t1');

    assert.equal(res.status, 201);
    assert.equal(res.body.data[0].referencia, null);
  });

  test('una pieza que no existe: 404 y no se crea nada', async () => {
    const res = await duplicar('no-existe');

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Mueble no encontrado.');
    assert.equal(fake.tablas.muebles.length, 5);
  });

  test('solo un administrador puede duplicar', async () => {
    const sinSesion = await request(app).post('/api/muebles/s1/duplicar');
    const cliente = await duplicar('s1', tokenCliente);

    assert.equal(sinSesion.status, 401);
    assert.equal(cliente.status, 403);
    assert.equal(fake.tablas.muebles.length, 5);
  });
});

describe('duplicar una pieza: errores', () => {
  test('si falla la lectura de la original: 500 con un mensaje para el panel', async () => {
    fake.fallos['muebles.select'] = { message: 'tiempo agotado' };

    const res = await duplicar('s1');

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al duplicar el mueble.');
  });

  test('si la referencia choca en todos los reintentos: 409 y se puede volver a intentar', async () => {
    fake.fallos['muebles.insert'] = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "muebles_referencia_key"'
    };

    const res = await duplicar('s1');

    assert.equal(res.status, 409);
    assert.equal(
      res.body.error,
      'No se pudo dar una referencia nueva a la copia porque se estaban creando otras piezas a la vez. Vuelve a intentarlo.'
    );
    assert.equal(fake.tablas.muebles.length, 5);
  });

  test('un choque que no es de la referencia es un 500', async () => {
    fake.fallos['muebles.insert'] = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "muebles_pkey"'
    };

    const res = await duplicar('s1');

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al duplicar el mueble.');
  });

  test('cualquier otro fallo al guardar la copia: 500', async () => {
    fake.fallos['muebles.insert'] = { message: 'conexión perdida' };

    const res = await duplicar('s1');

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al duplicar el mueble.');
  });
});
