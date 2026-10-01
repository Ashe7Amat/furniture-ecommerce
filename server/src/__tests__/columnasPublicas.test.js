// H26: las lecturas públicas eligen sus columnas. Dos comprobaciones:
// - con el doble de Supabase: si la tabla tuviera columnas nuevas (aquí, `precio_compra` y
//   `proveedor`, que no existen), las rutas públicas no las devolverían;
// - con el cliente real de supabase-js (y un fetch falso): lo que llega a PostgREST en el parámetro
//   `select` es la lista explícita, no '*'.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const ID = '11111111-2222-4333-8444-555555555555';
const COLUMNAS_MUEBLE = [
  'categoria',
  'descripcion',
  'estado',
  'id',
  'imagenes',
  'nombre',
  'precio_alquiler_dia',
  'precio_venta'
];
const muebleConColumnasNuevas = {
  id: ID,
  nombre: 'Aparador de roble',
  categoria: 'Aparadores',
  descripcion: 'Restaurado',
  precio_venta: 450,
  precio_alquiler_dia: 20,
  imagenes: ['https://img.test/a.jpg'],
  estado: 'disponible',
  disponible: true,
  created_at: '2026-09-01T10:00:00Z',
  categoria_id: 7,
  precio_compra: 90, // columnas que no existen: hacen de "columna nueva"
  proveedor: 'Rastro de Sant Antoni'
};

afterEach(() => mock.restoreAll());

describe('con columnas nuevas en la tabla, las rutas públicas de muebles no las devuelven', () => {
  beforeEach(() => {
    mock.method(supabase, 'from', crearFakeSupabase({ muebles: [muebleConColumnasNuevas] }).from);
  });

  const soloLasPublicas = (mueble) => assert.deepEqual(Object.keys(mueble).sort(), COLUMNAS_MUEBLE);

  test('GET /api/muebles', async () => {
    const res = await request(app).get('/api/muebles');
    assert.equal(res.status, 200);
    soloLasPublicas(res.body[0]);
  });

  test('GET /api/muebles/buscar', async () => {
    const res = await request(app).get('/api/muebles/buscar?q=aparador');
    assert.equal(res.status, 200);
    soloLasPublicas(res.body[0]);
  });

  test('GET /api/muebles/:id', async () => {
    const res = await request(app).get(`/api/muebles/${ID}`);
    assert.equal(res.status, 200);
    soloLasPublicas(res.body);
    assert.equal(res.body.precio_compra, undefined);
  });
});

describe('contrato con supabase-js real: lo que se pide a PostgREST es la lista explícita', () => {
  let selects;
  beforeEach(() => {
    selects = [];
    const fetchFalso = async (url) => {
      const u = new URL(url);
      selects.push(`${u.pathname} ${u.searchParams.get('select')}`);
      const cuerpo = u.pathname.endsWith('/categorias') ? [] : [muebleConColumnasNuevas];
      return new Response(JSON.stringify(u.searchParams.get('id') ? cuerpo[0] : cuerpo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
      auth: { persistSession: false },
      global: { fetch: fetchFalso }
    });
    mock.method(supabase, 'from', (tabla) => real.from(tabla));
  });

  test('las tres lecturas públicas de muebles y la de categorías', async () => {
    await request(app).get('/api/muebles');
    await request(app).get('/api/muebles/buscar?q=aparador');
    await request(app).get(`/api/muebles/${ID}`);
    await request(app).get('/api/categorias');

    const listaMueble =
      'id,nombre,categoria,descripcion,precio_venta,precio_alquiler_dia,imagenes,estado';
    assert.deepEqual(selects, [
      `/rest/v1/muebles ${listaMueble}`,
      `/rest/v1/muebles ${listaMueble}`,
      `/rest/v1/muebles ${listaMueble}`,
      '/rest/v1/categorias id,nombre,imagen_url,categoria_padre_id'
    ]);
  });
});
