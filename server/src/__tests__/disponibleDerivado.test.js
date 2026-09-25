// `disponible` es una columna derivada: la calcula la base de datos a partir de `estado` con el
// trigger trg_sync_disponible_desde_estado (BEFORE INSERT OR UPDATE ON muebles), que hace
//   NEW.disponible := (COALESCE(NEW.estado, 'disponible') = 'disponible');
// y pisa cualquier valor que mande la aplicación (definición comprobada en producción el
// 25 sep 2026, ver docs/tarea3-diseno.md). Por eso la aplicación ya no lo escribe nunca.
// Aquí se comprueban las dos cosas: que el doble en memoria se comporta como ese trigger, y que
// crear, editar y vender una pieza no mandan `disponible` y aun así queda bien.
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

const SOFA = {
  id: 'mueble-1',
  nombre: 'Sofá',
  categoria: 'Sofás',
  estado: 'disponible',
  disponible: true
};

let fake;
beforeEach(() => {
  fake = crearFakeSupabase({ muebles: [SOFA] });
  mock.method(supabase, 'from', fake.from);
});
afterEach(() => mock.restoreAll());

describe('el doble en memoria emula el trigger de disponible', () => {
  test('al insertar, disponible sale de estado y pisa lo que se mande', async () => {
    const { data } = await fake
      .from('muebles')
      .insert([
        { nombre: 'a', estado: 'vendido', disponible: true },
        { nombre: 'b', estado: 'disponible', disponible: false },
        { nombre: 'c', estado: 'alquilado' }
      ])
      .select();

    assert.deepEqual(
      data.map((f) => f.disponible),
      [false, true, false]
    );
  });

  test('sin estado cuenta como disponible (el COALESCE del trigger)', async () => {
    const { data } = await fake
      .from('muebles')
      .insert([{ nombre: 'a' }, { nombre: 'b', estado: null }])
      .select();

    assert.deepEqual(
      data.map((f) => f.disponible),
      [true, true]
    );
  });

  test('al actualizar se recalcula, aunque no se toque estado', async () => {
    await fake.from('muebles').update({ estado: 'vendido' }).eq('id', 'mueble-1');
    assert.equal(fake.tablas.muebles[0].disponible, false);

    await fake.from('muebles').update({ disponible: true }).eq('id', 'mueble-1');
    assert.equal(fake.tablas.muebles[0].disponible, false, 'el trigger pisa el valor mandado');
  });

  test('las filas iniciales no pasan por el trigger, como las que ya están en la base de datos', () => {
    const incoherente = crearFakeSupabase({
      muebles: [{ id: 'x', estado: 'vendido', disponible: true }]
    });
    assert.equal(incoherente.tablas.muebles[0].disponible, true);
  });
});

describe('crear, editar y vender una pieza no escriben disponible', () => {
  test('crear: no se manda disponible aunque venga en el formulario, y queda disponible', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Mesa')
      .field('categoria', 'Mesas')
      .field('disponible', 'false');

    assert.equal(res.status, 201);
    const { fila, enviado } = fake.escrituras.find(
      (e) => e.tabla === 'muebles' && e.accion === 'insert'
    );
    assert.equal('disponible' in enviado, false);
    assert.equal(fila.disponible, true);
  });

  test('editar: un disponible suelto no se manda y la pieza sigue disponible', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field(
      'disponible',
      'false'
    );

    assert.equal(res.status, 200);
    const actualizacion = fake.escrituras.find((e) => e.tabla === 'muebles');
    assert.equal('disponible' in actualizacion.datos, false);
    assert.equal(fake.tablas.muebles[0].disponible, true);
  });

  test('editar: al pasar a vendido solo se manda estado, y deja de estar disponible', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field('estado', 'vendido');

    assert.equal(res.status, 200);
    const actualizacion = fake.escrituras.find((e) => e.tabla === 'muebles');
    assert.deepEqual(actualizacion.datos, { estado: 'vendido' });
    assert.equal(fake.tablas.muebles[0].disponible, false);
  });
});
