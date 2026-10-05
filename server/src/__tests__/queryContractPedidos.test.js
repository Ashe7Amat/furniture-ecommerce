// Test de CONTRATO del listado de pedidos del panel (H37) con el cliente REAL de supabase-js y un
// fetch falso que registra la petición HTTP que saldría hacia PostgREST (misma técnica que
// queryContract.test.js). El doble en memoria no dice cómo se traducen range() y el recuento a
// la URL y a las cabeceras: si una actualización de supabase-js lo cambiara, falla aquí.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const app = require('../index');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

let peticiones;

// Responde como PostgREST: el total va en Content-Range ("desde-hasta/total"), que es de donde
// supabase-js saca `count`. En la petición HEAD del recuento de pendientes no hay cuerpo.
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const cabeceras =
    init.headers instanceof Headers ? init.headers : new Headers(init.headers || {});
  const peticion = {
    metodo: (init.method || 'GET').toUpperCase(),
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams),
    prefer: cabeceras.get('Prefer'),
    range: cabeceras.get('Range')
  };
  peticiones.push(peticion);

  if (peticion.metodo === 'HEAD') {
    return new Response(null, { status: 200, headers: { 'Content-Range': '*/7' } });
  }
  return new Response(JSON.stringify([{ id: 'p1', estado: 'enviado' }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Range': '10-10/31' }
  });
};

beforeEach(() => {
  peticiones = [];
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
});

afterEach(() => mock.restoreAll());

describe('contrato de GET /api/pedidos (panel, H37) con supabase-js real', () => {
  test('la página pide offset y limit, el filtro de estado y el total exacto; luego cuenta los pendientes con HEAD', async () => {
    const res = await request(app)
      .get('/api/pedidos?page=2&limit=10&estado=enviado')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      ['GET /rest/v1/pedidos', 'HEAD /rest/v1/pedidos']
    );

    const [pagina, pendientes] = peticiones;
    assert.equal(
      pagina.params.select,
      'id,created_at,estado,total,items,cliente_info,direccion_envio'
    );
    assert.equal(pagina.params.order, 'created_at.desc');
    assert.equal(pagina.params.estado, 'eq.enviado');
    assert.equal(pagina.params.offset, '10');
    assert.equal(pagina.params.limit, '10');
    assert.match(pagina.prefer, /count=exact/);

    assert.equal(pendientes.params.estado, 'eq.procesando');
    assert.match(pendientes.prefer, /count=exact/);

    // Lo que llega al panel, con los recuentos sacados de Content-Range
    assert.equal(res.body.total, 31);
    assert.equal(res.body.pendientes, 7);
    assert.equal(res.body.totalPaginas, 4);
    assert.deepEqual(res.body.pedidos, [{ id: 'p1', estado: 'enviado' }]);
  });

  test('sin estado no se filtra por estado', async () => {
    await request(app).get('/api/pedidos').set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(peticiones[0].params.estado, undefined);
    assert.equal(peticiones[0].params.offset, '0');
    assert.equal(peticiones[0].params.limit, '20');
  });
});
