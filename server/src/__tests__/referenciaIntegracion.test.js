// A7: las referencias de los muebles de punta a punta, por las rutas HTTP (crear, editar, leer) y
// con el código de la categoría, contra el doble de Supabase. Lo unitario de utils/referencia.js y
// los reintentos por colisión están en referencia.test.js.
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
const conAdmin = (req) => req.set('Authorization', `Bearer ${tokenAdmin}`);

// Como en la base real (ver docs/mejoras-tecnicas.md): específicas con código, colgando de una
// general. "Taburetes" es una específica nueva, aún sin código. Ids como texto a propósito, como en
// categoriasController.test.js: el doble compara con === (no convierte tipos como PostgREST) y
// PUT /api/categorias/:id los recibe siempre como texto.
const categoriasDePrueba = () => [
  { id: '17', nombre: 'Mobiliario', codigo: 'MOB', categoria_padre_id: null },
  { id: '20', nombre: 'Sillas y asientos', codigo: 'SIL', categoria_padre_id: 17 },
  { id: '21', nombre: 'Mesas y mobiliario', codigo: 'MES', categoria_padre_id: 17 },
  { id: '40', nombre: 'Taburetes', codigo: null, categoria_padre_id: 17 }
];

let fake;
afterEach(() => mock.restoreAll());
beforeEach(() => {
  fake = crearFakeSupabase({ categorias: categoriasDePrueba() });
  mock.method(supabase, 'from', fake.from);
  mock.method(console, 'warn', () => {}); // el aviso de "categoría sin código" es esperado
});

const crearMueble = (nombre, categoria, campos = {}) => {
  let peticion = conAdmin(request(app).post('/api/muebles'))
    .field('nombre', nombre)
    .field('categoria', categoria);
  for (const [campo, valor] of Object.entries(campos)) peticion = peticion.field(campo, valor);
  return peticion;
};
const referenciaDe = (nombre) => fake.tablas.muebles.find((m) => m.nombre === nombre).referencia;

describe('crear muebles (A7)', () => {
  test('el primero de una categoría con código se lleva NAV-COD-001', async () => {
    const res = await crearMueble('Silla Tolix', 'Sillas y asientos');
    assert.equal(res.status, 201);
    assert.equal(res.body.data[0].referencia, 'NAV-SIL-001');
  });

  test('dos seguidos en la misma categoría: 001 y 002; en otra categoría se cuenta aparte', async () => {
    await crearMueble('Silla Tolix', 'Sillas y asientos');
    await crearMueble('Silla Thonet', 'Sillas y asientos');
    await crearMueble('Mesa de roble', 'Mesas y mobiliario');

    assert.equal(referenciaDe('Silla Tolix'), 'NAV-SIL-001');
    assert.equal(referenciaDe('Silla Thonet'), 'NAV-SIL-002');
    assert.equal(referenciaDe('Mesa de roble'), 'NAV-MES-001');
  });

  test('una referencia mandada en la petición se ignora: la pone siempre el servidor', async () => {
    const res = await crearMueble('Silla Tolix', 'Sillas y asientos', {
      referencia: 'NAV-XXX-999'
    });
    assert.equal(res.status, 201);
    assert.equal(referenciaDe('Silla Tolix'), 'NAV-SIL-001');
  });

  test('en una categoría sin código, el mueble se crea sin referencia', async () => {
    const res = await crearMueble('Taburete alto', 'Taburetes');
    assert.equal(res.status, 201);
    assert.equal(referenciaDe('Taburete alto'), null);
  });

  test('si después la categoría recibe un código, sus muebles nuevos empiezan en 001', async () => {
    await crearMueble('Taburete alto', 'Taburetes');
    const res = await conAdmin(request(app).put('/api/categorias/40')).field('codigo', 'tab');
    assert.equal(res.status, 200);
    await crearMueble('Taburete bajo', 'Taburetes');

    assert.equal(referenciaDe('Taburete alto'), null);
    assert.equal(referenciaDe('Taburete bajo'), 'NAV-TAB-001');
  });

  test('cambiar el código de una categoría no toca las referencias ya dadas', async () => {
    await crearMueble('Silla Tolix', 'Sillas y asientos');
    await conAdmin(request(app).put('/api/categorias/20')).field('codigo', 'ASI');
    await crearMueble('Silla Thonet', 'Sillas y asientos');

    assert.equal(referenciaDe('Silla Tolix'), 'NAV-SIL-001');
    assert.equal(referenciaDe('Silla Thonet'), 'NAV-ASI-001');
  });
});

describe('editar muebles (A7)', () => {
  test('cambiar de categoría no cambia la referencia', async () => {
    await crearMueble('Silla Tolix', 'Sillas y asientos');
    const id = fake.tablas.muebles[0].id;

    const res = await conAdmin(request(app).put(`/api/muebles/${id}`))
      .field('categoria', 'Mesas y mobiliario')
      .field('categoria_id', '21');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].categoria_id, 21);
    assert.equal(fake.tablas.muebles[0].referencia, 'NAV-SIL-001');
  });

  test('una referencia mandada al editar se ignora: no es editable', async () => {
    await crearMueble('Silla Tolix', 'Sillas y asientos');
    const id = fake.tablas.muebles[0].id;

    const res = await conAdmin(request(app).put(`/api/muebles/${id}`))
      .field('nombre', 'Silla Tolix negra')
      .field('referencia', 'NAV-SIL-999');
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].nombre, 'Silla Tolix negra');
    assert.equal(fake.tablas.muebles[0].referencia, 'NAV-SIL-001');
  });
});

describe('leer las referencias (A7)', () => {
  beforeEach(async () => {
    await crearMueble('Silla Tolix', 'Sillas y asientos');
    await crearMueble('Taburete alto', 'Taburetes');
  });

  test('el catálogo público (A6) y el panel (A5) devuelven la referencia, o null si no tiene', async () => {
    const publico = await request(app).get('/api/muebles');
    const panel = await conAdmin(request(app).get('/api/admin/muebles'));

    for (const res of [publico, panel]) {
      assert.equal(res.status, 200);
      const porNombre = Object.fromEntries(res.body.map((m) => [m.nombre, m.referencia]));
      assert.deepEqual(porNombre, { 'Silla Tolix': 'NAV-SIL-001', 'Taburete alto': null });
    }
  });

  test('la ficha pública de un mueble lleva su referencia', async () => {
    const id = fake.tablas.muebles.find((m) => m.nombre === 'Silla Tolix').id;
    const res = await request(app).get(`/api/muebles/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.referencia, 'NAV-SIL-001');
  });
});
