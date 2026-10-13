// Test de CONTRATO de las consultas de los endpoints de reservas (controllers/reservasController.js)
// con el cliente REAL de supabase-js y un fetch falso que registra la petición exacta que saldría
// hacia PostgREST, como queryContract.test.js. El filtro de rangos (.overlaps) es nuevo en este
// proyecto, y el doble en memoria no comprueba cómo lo serializa la librería
// (docs/reservas-diseno.md, 7.1).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const app = require('../index');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
let peticiones;

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

// Responde como PostgREST: el daterange llega como texto canónico.
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  peticiones.push({
    metodo: (init.method || 'GET').toUpperCase(),
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams)
  });
  if (u.pathname === '/rest/v1/muebles') {
    // maybeSingle() pide una lista y se queda con la única fila.
    return json(200, [{ id: 'mueble-1', estado: 'disponible', precio_alquiler_dia: '25.00' }]);
  }
  if (u.pathname === '/rest/v1/reservas') {
    return json(200, [
      {
        tipo: 'alquiler',
        estado: 'confirmada',
        rango_ocupado: `[${sumarDias(hoy, 10)},${sumarDias(hoy, 15)})`,
        expira_en: null
      },
      {
        tipo: 'venta',
        estado: 'confirmada',
        rango_ocupado: `[${sumarDias(hoy, 40)},)`,
        expira_en: null
      }
    ]);
  }
  return json(404, { message: `Petición no prevista: ${u.pathname}` });
};

const de = (ruta) => peticiones.filter((p) => p.ruta === ruta);

beforeEach(() => {
  peticiones = [];
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
});

afterEach(() => mock.restoreAll());

describe('contrato de GET /api/muebles/:id/disponibilidad con supabase-js real', () => {
  test('lee la pieza y después sus reservas, y nada más', async () => {
    const res = await request(app).get('/api/muebles/mueble-1/disponibilidad');
    assert.equal(res.status, 200);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      ['GET /rest/v1/muebles', 'GET /rest/v1/reservas']
    );
  });

  test('la pieza: por id y solo tres columnas', async () => {
    await request(app).get('/api/muebles/mueble-1/disponibilidad');
    const { params } = de('/rest/v1/muebles')[0];
    assert.equal(params.id, 'eq.mueble-1');
    assert.deepEqual(params.select.split(','), ['id', 'estado', 'precio_alquiler_dia']);
  });

  test('las reservas: sin datos del cliente, solo las que ocupan, de hoy en adelante', async () => {
    await request(app).get('/api/muebles/mueble-1/disponibilidad');
    const { params } = de('/rest/v1/reservas')[0];
    assert.deepEqual(params.select.split(','), ['tipo', 'estado', 'rango_ocupado', 'expira_en']);
    assert.equal(params.mueble_id, 'eq.mueble-1');
    assert.equal(params.estado, 'in.(pendiente,confirmada,en_curso,devuelta)');
    // && con un rango abierto por arriba: "[hoy,)" en texto, como lo entiende Postgres.
    assert.equal(params.rango_ocupado, `ov.[${hoy},)`);
  });

  test('lee el rango en texto de PostgREST, también el de una venta sin fin', async () => {
    const res = await request(app).get('/api/muebles/mueble-1/disponibilidad');
    assert.deepEqual(res.body.ocupado, [
      { desde: sumarDias(hoy, 10), hasta: sumarDias(hoy, 15), tipo: 'reservado' },
      { desde: sumarDias(hoy, 40), hasta: null, tipo: 'vendido' }
    ]);
    assert.equal(res.body.precio_dia_centimos, 2500, 'el numeric llega como texto: "25.00"');
  });
});
