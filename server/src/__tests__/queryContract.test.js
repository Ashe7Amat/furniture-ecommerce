// Test de CONTRATO de las consultas a Supabase de utils/pagos.js. A diferencia del resto de
// tests (que usan un doble en memoria), aquí se ejecuta el código real de pagos.js contra el
// cliente REAL de supabase-js, con un fetch falso que registra la petición HTTP exacta que
// saldría hacia PostgREST y responde como lo haría éste. Motivo: el doble en memoria no
// reproduce cómo la librería serializa cada filtro a la URL, y así se coló un fallo real:
// .contains('items', [objetos]) sale como "cs.{[object Object]}" y la base lo rechaza.
// Si una actualización de supabase-js cambiara la forma de estas peticiones, falla aquí.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const { procesarSesionPagada, idPedidoDeSesion } = require('../utils/pagos');
const { crearSesion } = require('./helpers/stripeFixtures');

let peticiones;

const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

// Responde como PostgREST para el flujo feliz de una compra de "mueble-1".
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const cabeceras =
    init.headers instanceof Headers ? init.headers : new Headers(init.headers || {});
  const peticion = {
    metodo: (init.method || 'GET').toUpperCase(),
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams),
    prefer: cabeceras.get('Prefer'),
    cuerpo: init.body ? JSON.parse(init.body) : null
  };
  peticiones.push(peticion);

  if (peticion.ruta === '/rest/v1/muebles' && peticion.metodo === 'GET') {
    return json(200, [
      { id: 'mueble-1', nombre: 'Sofá Lumina', precio_venta: 1250, precio_alquiler_dia: null }
    ]);
  }
  if (peticion.ruta === '/rest/v1/muebles' && peticion.metodo === 'PATCH')
    return json(200, [{ id: 'mueble-1' }]);
  if (peticion.ruta === '/rest/v1/pedidos' && peticion.metodo === 'POST') return json(201);
  if (peticion.ruta === '/rest/v1/pedidos' && peticion.metodo === 'GET') return json(200, []);
  return json(404, {
    message: `Petición no prevista en el test: ${peticion.metodo} ${peticion.ruta}`
  });
};

const de = (metodo, ruta) => peticiones.filter((p) => p.metodo === metodo && p.ruta === ruta);

beforeEach(async () => {
  peticiones = [];
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
  mock.method(email, 'enviarNotificacionVenta', async () => {});
  mock.method(email, 'enviarConfirmacionCliente', async () => {});
  mock.method(email, 'enviarAlertaAdmin', async () => {});
  mock.method(console, 'error', () => {});

  await procesarSesionPagada(crearSesion());
});

afterEach(() => mock.restoreAll());

describe('contrato de las consultas de pagos.js con supabase-js real', () => {
  test('hace exactamente las peticiones esperadas y en este orden', () => {
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      [
        'GET /rest/v1/pedidos', // ¿la sesión ya tiene pedido?
        'GET /rest/v1/muebles', // cargar las piezas
        'PATCH /rest/v1/muebles', // marcar como vendida (condicional)
        'POST /rest/v1/pedidos', // registrar el pedido
        'GET /rest/v1/pedidos' // detectar doble venta
      ]
    );
  });

  test('comprobar si la sesión ya tiene pedido: filtra por stripe_session_id con limit 1', () => {
    const { params } = de('GET', '/rest/v1/pedidos')[0];

    assert.equal(params.select, 'id');
    assert.equal(params.stripe_session_id, 'eq.cs_test_123');
    assert.equal(params.limit, '1');
  });

  test('cargar las piezas: una sola consulta con .in() y solo las columnas necesarias', () => {
    const { params } = de('GET', '/rest/v1/muebles')[0];

    assert.deepEqual(params.select.split(','), [
      'id',
      'nombre',
      'precio_venta',
      'precio_alquiler_dia'
    ]);
    assert.match(params.id, /^in\.\(.*mueble-1.*\)$/);
  });

  test('marcar la pieza: PATCH condicional (solo si sigue disponible) que devuelve las filas afectadas', () => {
    const patch = de('PATCH', '/rest/v1/muebles')[0];

    assert.equal(patch.params.id, 'eq.mueble-1');
    assert.equal(
      patch.params.estado,
      'eq.disponible',
      'la condición viaja en la propia petición: es atómica'
    );
    assert.equal(patch.params.select, 'id');
    assert.match(patch.prefer, /return=representation/);
    assert.deepEqual(patch.cuerpo, { estado: 'vendido', disponible: false });
  });

  test('registrar el pedido: INSERT con el id derivado de la sesión y los campos del pedido', () => {
    const { cuerpo } = de('POST', '/rest/v1/pedidos')[0];

    assert.equal(cuerpo.id, idPedidoDeSesion('cs_test_123'));
    assert.equal(cuerpo.stripe_session_id, 'cs_test_123');
    assert.equal(cuerpo.total, 1250);
    assert.equal(cuerpo.estado, 'procesando');
    assert.equal(cuerpo.metodo_entrega, 'domicilio');
    assert.equal(cuerpo.direccion_envio, 'Calle Falsa 123, Barcelona');
    assert.deepEqual(cuerpo.items, [
      {
        productId: 'mueble-1',
        nombre: 'Sofá Lumina',
        modalidad: 'compra',
        cantidad: 1,
        precio: 1250
      }
    ]);
  });

  test('detectar doble venta: el filtro jsonb sale como JSON válido, nunca como "[object Object]"', () => {
    const { params } = de('GET', '/rest/v1/pedidos')[1];

    assert.ok(!params.items.includes('[object Object]'), `filtro corrupto: ${params.items}`);
    assert.equal(params.items, 'cs.[{"productId":"mueble-1","modalidad":"compra"}]');
    assert.equal(params.id, `neq.${idPedidoDeSesion('cs_test_123')}`, 'excluye el propio pedido');
    assert.equal(params.estado, 'neq.cancelado');
    assert.equal(params.limit, '1');
  });
});
