// Migración A (ver docs/tarea3-diseno.md): doble escritura de muebles.categoria_id junto a
// muebles.categoria (texto) durante la transición. crearMueble/editarMueble deben escribir
// categoria_id cuando el body lo manda tal cual, o resolverlo desde categorias.nombre cuando
// solo llega el texto -- sin bloquear la operación si no hay ninguna categoría real con ese
// nombre (categoria sigue siendo la fuente de verdad hasta que se cierre la migración).
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
const conAuth = (req) => req.set('Authorization', `Bearer ${tokenAdmin}`);

const CATEGORIAS = [
  { id: 7, nombre: 'Sofás' },
  { id: 9, nombre: 'Sillas' }
];

let fake;
afterEach(() => mock.restoreAll());

describe('POST /api/muebles — doble escritura de categoria_id', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ categorias: CATEGORIAS });
    mock.method(supabase, 'from', fake.from);
  });

  test('con categoria_id explícito en el body, se guarda tal cual (no se resuelve por nombre)', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá Lumina')
      .field('categoria', 'Sofás')
      .field('categoria_id', '9'); // deliberadamente distinto del real (7), para comprobar que no se corrige
    assert.equal(res.status, 201);
    const insertado = fake.escrituras.find(
      (e) => e.tabla === 'muebles' && e.accion === 'insert'
    ).fila;
    assert.equal(insertado.categoria_id, 9);
  });

  test('con solo categoria (texto), se resuelve a categoria_id vía categorias.nombre', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá Lumina')
      .field('categoria', 'Sofás');
    assert.equal(res.status, 201);
    const insertado = fake.escrituras.find(
      (e) => e.tabla === 'muebles' && e.accion === 'insert'
    ).fila;
    assert.equal(insertado.categoria_id, 7);
  });

  test('con una categoria (texto) que no coincide con ninguna categoría real, categoria_id queda null sin bloquear la creación', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Pieza rara')
      .field('categoria', 'Categoría que no existe');
    assert.equal(res.status, 201);
    const insertado = fake.escrituras.find(
      (e) => e.tabla === 'muebles' && e.accion === 'insert'
    ).fila;
    assert.equal(insertado.categoria_id, null);
    assert.equal(insertado.categoria, 'Categoría que no existe'); // el texto sigue siendo la fuente de verdad
  });
});

describe('PUT /api/muebles/:id — doble escritura de categoria_id', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      categorias: CATEGORIAS,
      muebles: [
        {
          id: 'mueble-1',
          nombre: 'Sofá',
          categoria: 'Sofás',
          categoria_id: 7,
          estado: 'disponible'
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('cambiando solo categoria_id, se actualiza y categoria (texto) no se toca', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field('categoria_id', '9');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].categoria_id, 9);
    assert.equal(fake.tablas.muebles[0].categoria, 'Sofás'); // no se toca
  });

  test('cambiando solo categoria (texto), se resuelve y actualiza categoria_id también', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field(
      'categoria',
      'Sillas'
    );
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].categoria, 'Sillas');
    assert.equal(fake.tablas.muebles[0].categoria_id, 9);
  });

  test('sin mandar categoria ni categoria_id, no se toca categoria_id en absoluto', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field('estado', 'vendido');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].categoria_id, 7); // sigue como estaba
    assert.equal(fake.tablas.muebles[0].estado, 'vendido');
  });
});
