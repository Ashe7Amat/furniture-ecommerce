// Tests de los endpoints de lectura de mueblesController.js que no tenían ningún test todavía
// (tarea 5): listado del catálogo, ficha por id (incluido "no encontrado"), y búsqueda por
// nombre. Crear/editar (Zod, categoria_id) ya están cubiertos en otros archivos; "crear sin
// imagen" y "editar sin cambios" también ya estaban cubiertos por validacionMuebles.test.js
// antes de esta tarea (ninguno de sus tests adjunta un archivo, y su PUT con body vacío es
// justo ese caso), así que no se duplican aquí.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

let fake;
afterEach(() => mock.restoreAll());

describe('GET /api/muebles — obtenerMuebles', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        { id: 'm1', nombre: 'Silla', created_at: '2026-01-01' },
        { id: 'm2', nombre: 'Mesa', created_at: '2026-03-01' },
        { id: 'm3', nombre: 'Armario', created_at: '2026-02-01' }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin ?limit, devuelve todos, más recientes primero', async () => {
    const res = await request(app).get('/api/muebles');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((m) => m.id),
      ['m2', 'm3', 'm1']
    );
  });

  test('con ?limit=2, devuelve solo los 2 más recientes', async () => {
    const res = await request(app).get('/api/muebles?limit=2');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((m) => m.id),
      ['m2', 'm3']
    );
  });

  test('un ?limit no numérico se ignora (no rompe, devuelve todos)', async () => {
    const res = await request(app).get('/api/muebles?limit=no-es-un-numero');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 3);
  });

  test('lleva cabecera de caché HTTP', async () => {
    const res = await request(app).get('/api/muebles');
    assert.match(res.headers['cache-control'], /max-age/);
  });
});

describe('GET /api/muebles/:id — obtenerMueblePorId', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ muebles: [{ id: 'm1', nombre: 'Silla' }] });
    mock.method(supabase, 'from', fake.from);
  });

  test('un id que existe devuelve el mueble', async () => {
    const res = await request(app).get('/api/muebles/m1');
    assert.equal(res.status, 200);
    assert.equal(res.body.nombre, 'Silla');
  });

  test('un id que no existe da 404 con mensaje claro', async () => {
    const res = await request(app).get('/api/muebles/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Mueble no encontrado.');
  });
});

describe('GET /api/muebles/buscar — buscarMuebles', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        { id: 'm1', nombre: 'Silla de madera' },
        { id: 'm2', nombre: 'Mesa de centro' },
        { id: 'm3', nombre: 'SILLÓN vintage' }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin término de búsqueda, devuelve un array vacío (no el catálogo entero)', async () => {
    const res = await request(app).get('/api/muebles/buscar');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('busca por coincidencia parcial del nombre, sin distinguir mayúsculas', async () => {
    const res = await request(app).get('/api/muebles/buscar?q=sill');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((m) => m.id).sort(), ['m1', 'm3']);
  });

  test('sin ninguna coincidencia, array vacío', async () => {
    const res = await request(app).get('/api/muebles/buscar?q=inexistente');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('los "_", "%" y "*" del término se buscan literales, no como comodines', async () => {
    // Sin escapar, "sill_" y "s%a" coincidían con "Silla de madera" y con "SILLÓN vintage".
    for (const termino of ['sill_', 's%a', 's*a']) {
      const res = await request(app).get(`/api/muebles/buscar?q=${encodeURIComponent(termino)}`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, [], `"${termino}" no debería coincidir con nada`);
    }
  });
});
