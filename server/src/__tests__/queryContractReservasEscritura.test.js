// Test de CONTRATO de POST /api/reservas/sesion-pago con el cliente REAL de supabase-js y un fetch
// falso que responde como PostgREST (docs/reservas-diseno.md, 4.3, capa 2). Fija dos cosas que el
// doble en memoria da por supuestas:
//   - que supabase-js expone el 409 de PostgREST ante una violación de la exclusión como
//     error.code === '23P01' (y el de unicidad como '23505'), y que el servidor lo traduce a un 409
//     sin dejar salir el detalle de Postgres (que lleva el rango y la pieza en conflicto);
//   - cómo se serializan las escrituras: la limpieza de caducadas (4.6), la inserción y el paso 8.
// Si una actualización de supabase-js cambia la forma del error, esto falla en `npm test`.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
process.env.CLIENT_URL = 'https://tienda.example.com';

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const app = require('../index');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');
const {
  MENSAJE_FECHAS_OCUPADAS,
  MENSAJE_OTRA_RESERVA,
  CODIGO_OTRA_RESERVA
} = require('../utils/reservas');

const hoy = hoyEnMadrid();
const ANA = '00000000-0000-4000-8000-0000000000a1';
const SILLA = '00000000-0000-4000-8000-000000000001';
const RESERVA = '00000000-0000-4000-8000-0000000000f1';
const TOKEN = jwt.sign(
  { sub: ANA, email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'cliente' },
  process.env.JWT_SECRET
);

const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

// Lo que responde PostgREST cuando la inserción incumple la exclusión (HTTP 409, código de Postgres
// en el cuerpo). El detalle lleva datos de la otra reserva: nunca debe llegar al cliente.
const ERROR_EXCLUSION = {
  code: '23P01',
  details: `Key (mueble_id, rango_ocupado)=(${SILLA}, [2030-01-01,2030-01-05)) conflicts with existing key (mueble_id, rango_ocupado)=(${SILLA}, [2030-01-03,2030-01-08)).`,
  hint: null,
  message: 'conflicting key value violates exclusion constraint "reservas_sin_solape"'
};
const ERROR_UNICIDAD = {
  code: '23505',
  details: `Key (cliente_id)=(${ANA}) already exists.`,
  hint: null,
  message: 'duplicate key value violates unique constraint "reservas_una_pendiente_por_cliente"'
};

let peticiones;
let respuestaInsercion;
let provisionalesVivas; // lo que responde la consulta de provisionales vivas del cliente (expira_en=gte.)
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const metodo = (init.method || 'GET').toUpperCase();
  const cabeceras = new Headers(init.headers);
  peticiones.push({
    metodo,
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams),
    prefer: cabeceras.get('prefer'),
    cuerpo: init.body ? JSON.parse(init.body) : null
  });
  const unObjeto = (cabeceras.get('accept') || '').includes('vnd.pgrst.object');
  if (u.pathname === '/rest/v1/clientes') {
    return json(200, [{ id: ANA, email: 'ana@ejemplo.com', email_verificado: true }]);
  }
  if (u.pathname === '/rest/v1/muebles') {
    return json(200, [
      { id: SILLA, nombre: 'Silla', estado: 'disponible', precio_alquiler_dia: 25 }
    ]);
  }
  if (u.pathname === '/rest/v1/reservas') {
    if (metodo === 'GET') {
      return json(
        200,
        u.searchParams.get('expira_en')?.startsWith('gte.') ? provisionalesVivas : []
      );
    }
    if (metodo === 'POST') return respuestaInsercion(unObjeto);
    // PATCH: con .select() devuelve las filas cambiadas; sin él, nada.
    return u.searchParams.has('select') ? json(200, [{ id: RESERVA }]) : json(204);
  }
  return json(404, { message: `Petición no prevista: ${u.pathname}` });
};

const reservar = () =>
  request(app)
    .post('/api/reservas/sesion-pago')
    .set('Authorization', `Bearer ${TOKEN}`)
    .send({
      mueble_id: SILLA,
      fecha_inicio: sumarDias(hoy, 10),
      hora_entrega: '10:00',
      fecha_fin: sumarDias(hoy, 13),
      hora_recogida: '10:00',
      entrega: 'tienda',
      recogida: 'tienda',
      contacto: { nombre: 'Ana', telefono: '600123456' },
      acepta_condiciones: true
    });

const de = (metodo, ruta) => peticiones.filter((p) => p.metodo === metodo && p.ruta === ruta);
let crearSesion;

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  peticiones = [];
  provisionalesVivas = [];
  respuestaInsercion = (unObjeto) => json(201, unObjeto ? { id: RESERVA } : [{ id: RESERVA }]);
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
  crearSesion = mock.fn(async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/x' }));
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { create: crearSesion, expire: mock.fn(async () => ({})) } }
  }));
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('contrato de POST /api/reservas/sesion-pago con supabase-js real', () => {
  test('el 23P01 de PostgREST: se limpia y se reintenta una vez, y después es un 409 sin el detalle de Postgres', async () => {
    respuestaInsercion = () => json(409, ERROR_EXCLUSION);

    const res = await reservar();

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_FECHAS_OCUPADAS });
    assert.deepEqual(
      peticiones.filter((p) => p.ruta === '/rest/v1/reservas').map((p) => p.metodo),
      ['GET', 'PATCH', 'POST', 'PATCH', 'POST', 'GET']
    );
    assert.equal(crearSesion.mock.callCount(), 0);
    // Antes de decir "fechas ocupadas" se mira si chocó con una provisional suya que va a la vez.
    const { params } = de('GET', '/rest/v1/reservas').at(-1);
    assert.equal(params.select, 'id');
    assert.equal(params.cliente_id, `eq.${ANA}`);
    assert.equal(params.estado, 'eq.pendiente');
    assert.match(params.expira_en, /^gte\.\d{4}-\d\d-\d\dT/);
    assert.equal(params.limit, '1');
  });

  test('si el 23P01 es con una provisional suya que va a la vez (doble clic), 409 "vuelve a intentarlo"', async () => {
    respuestaInsercion = () => json(409, ERROR_EXCLUSION);
    provisionalesVivas = [{ id: RESERVA }];
    const res = await reservar();
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_OTRA_RESERVA, codigo: CODIGO_OTRA_RESERVA });
  });

  test('el 23505 del índice de una provisional por cliente es un 409 "vuelve a intentarlo"', async () => {
    respuestaInsercion = () => json(409, ERROR_UNICIDAD);
    const res = await reservar();
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_OTRA_RESERVA, codigo: CODIGO_OTRA_RESERVA });
    assert.equal(de('POST', '/rest/v1/reservas').length, 1, 'un 23505 no se reintenta');
  });

  test('las provisionales anteriores del cliente: por cliente_id y estado', async () => {
    await reservar();
    const [{ params }] = de('GET', '/rest/v1/reservas');
    assert.deepEqual(params.select.split(','), ['id', 'stripe_session_id']);
    assert.equal(params.cliente_id, `eq.${ANA}`);
    assert.equal(params.estado, 'eq.pendiente');
  });

  test('la limpieza de caducadas (4.6): solo las pendientes de la pieza con expira_en pasado', async () => {
    const antes = new Date().toISOString();
    await reservar();
    const [limpieza] = de('PATCH', '/rest/v1/reservas');
    assert.deepEqual(limpieza.cuerpo, { estado: 'expirada' });
    assert.equal(limpieza.params.mueble_id, `eq.${SILLA}`);
    assert.equal(limpieza.params.estado, 'eq.pendiente');
    const [operador, instante] = limpieza.params.expira_en.split(/\.(.*)/s);
    assert.equal(operador, 'lt');
    assert.ok(instante >= antes && instante <= new Date().toISOString(), instante);
  });

  test('la inserción pide solo el id de vuelta y lleva el cliente del token', async () => {
    await reservar();
    const [insercion] = de('POST', '/rest/v1/reservas');
    assert.equal(insercion.params.select, 'id');
    assert.match(insercion.prefer, /return=representation/);
    assert.equal(insercion.cuerpo.cliente_id, ANA);
    assert.equal(insercion.cuerpo.estado, 'pendiente');
    assert.equal(insercion.cuerpo.tipo, 'alquiler');
    assert.equal(
      'rango_ocupado' in insercion.cuerpo,
      false,
      'es una columna generada: escribirla falla'
    );
  });

  test('el paso 8: guarda la sesión solo si la reserva sigue pendiente, y lee lo que cambió', async () => {
    const res = await reservar();
    assert.equal(res.status, 200);
    const guardar = de('PATCH', '/rest/v1/reservas').find((p) => p.cuerpo.stripe_session_id);
    assert.deepEqual(guardar.cuerpo, { stripe_session_id: 'cs_test_1' });
    assert.equal(guardar.params.id, `eq.${RESERVA}`);
    assert.equal(guardar.params.estado, 'eq.pendiente');
    assert.equal(guardar.params.select, 'id');
  });
});
