// Test de CONTRATO de "Mis reservas" con el cliente REAL de supabase-js y un fetch falso que responde
// como PostgREST (mismo patrón que queryContractReservasEscritura.test.js). Fija lo que el doble en
// memoria da por supuesto:
//   - qué filas pide la lista (solo las de la cuenta, solo alquileres, sin datos internos);
//   - que la solicitud de cancelación solo vale si la fila sigue como se leyó: el PATCH lleva
//     updated_at=eq.<lo leído> tal cual (con su "+00:00", que en la URL tiene que ir codificado o
//     PostgREST lo leería como un espacio), y que si no cambia ninguna fila se vuelve a leer.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const app = require('../index');

const ANA = '00000000-0000-4000-8000-0000000000a1';
const SILLA = '00000000-0000-4000-8000-000000000001';
const RESERVA = '00000000-0000-4000-8000-0000000000f1';
const TOKEN = jwt.sign(
  { sub: ANA, email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'cliente' },
  process.env.JWT_SECRET
);
// Como lo devuelve PostgREST: microsegundos y la zona con "+".
const LEIDO = '2026-10-13T21:30:00.123456+00:00';
const RELEIDO = '2026-10-13T21:30:01.654321+00:00';

const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

const fila = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SILLA,
  cliente_id: ANA,
  tipo: 'alquiler',
  estado: 'confirmada',
  conflicto_en: null,
  pedido_id: null,
  fecha_inicio: '2030-01-10',
  hora_entrega: '10:00:00',
  fecha_fin: '2030-01-13',
  hora_recogida: '10:00:00',
  datos_contacto: { nombre: 'Ana', email: 'ana@ejemplo.com', telefono: '600' },
  importe_total: 75,
  historial: [],
  updated_at: LEIDO,
  ...cambios
});

let peticiones;
let lecturasReserva; // lo que devuelve cada GET /reservas, en orden
let filasCambiadas; // lo que devuelve cada PATCH /reservas, en orden
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const metodo = (init.method || 'GET').toUpperCase();
  peticiones.push({
    metodo,
    ruta: u.pathname,
    url,
    params: Object.fromEntries(u.searchParams),
    cuerpo: init.body ? JSON.parse(init.body) : null
  });
  if (u.pathname === '/rest/v1/clientes') {
    return json(200, [{ id: ANA, email: 'ana@ejemplo.com', email_verificado: true }]);
  }
  if (u.pathname === '/rest/v1/muebles') {
    return json(200, [{ id: SILLA, nombre: 'Silla', imagenes: ['https://x/silla.webp'] }]);
  }
  if (u.pathname === '/rest/v1/reservas') {
    if (metodo === 'GET') return json(200, lecturasReserva.shift() ?? []);
    if (metodo === 'PATCH') return json(200, filasCambiadas.shift() ?? []);
  }
  return json(404, { message: `Petición no prevista: ${metodo} ${u.pathname}` });
};

const de = (metodo, ruta) => peticiones.filter((p) => p.metodo === metodo && p.ruta === ruta);

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  peticiones = [];
  lecturasReserva = [];
  filasCambiadas = [];
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
  mock.method(email, 'enviarAlertaAdmin', async () => {});
  mock.method(console, 'error', () => {});
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('contrato de GET /api/reservas/mias', () => {
  test('las de la cuenta, solo alquileres, ordenadas y sin columnas de más', async () => {
    lecturasReserva = [
      [{ ...fila(), stripe_payment_intent_id: 'pi_1', precio_desglose: { dias: 3 } }]
    ];

    const res = await request(app)
      .get('/api/reservas/mias')
      .set('Authorization', `Bearer ${TOKEN}`);

    assert.equal(res.status, 200);
    const [lista] = de('GET', '/rest/v1/reservas');
    assert.equal(lista.params.cliente_id, `eq.${ANA}`);
    assert.equal(lista.params.tipo, 'eq.alquiler');
    assert.equal(lista.params.order, 'fecha_inicio.desc');
    assert.deepEqual(lista.params.select.split(','), [
      'id',
      'pedido_id',
      'mueble_id',
      'estado',
      'fecha_inicio',
      'hora_entrega',
      'fecha_fin',
      'hora_recogida',
      'modo_entrega',
      'modo_devolucion',
      'direccion_entrega',
      'importe_total',
      'precio_desglose',
      'stripe_payment_intent_id',
      'expira_en',
      'conflicto_en',
      'historial'
    ]);
    const [piezas] = de('GET', '/rest/v1/muebles');
    assert.equal(piezas.params.id, `in.(${SILLA})`);
    assert.equal(piezas.params.select, 'id,nombre,imagenes');
    assert.equal(res.body[0].hora_entrega, '10:00');
  });
});

describe('contrato de POST /api/reservas/:id/solicitar-cancelacion', () => {
  const pedir = () =>
    request(app)
      .post(`/api/reservas/${RESERVA}/solicitar-cancelacion`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ motivo: 'Cambio de planes' });

  test('el PATCH solo vale si la fila sigue como se leyó, con el updated_at tal cual', async () => {
    lecturasReserva = [[fila()]];
    filasCambiadas = [[fila()]];

    const res = await pedir();

    assert.equal(res.status, 200);
    const [lectura] = de('GET', '/rest/v1/reservas');
    assert.equal(lectura.params.id, `eq.${RESERVA}`);
    const [cambio] = de('PATCH', '/rest/v1/reservas');
    assert.equal(cambio.params.id, `eq.${RESERVA}`);
    assert.equal(cambio.params.updated_at, `eq.${LEIDO}`);
    assert.ok(cambio.url.includes('%2B00%3A00'), 'el "+" va codificado en la URL');
    assert.deepEqual(Object.keys(cambio.cuerpo), ['historial']);
    assert.equal(cambio.cuerpo.historial[0].tipo, 'cancelacion_solicitada');
    assert.equal(cambio.cuerpo.historial[0].detalle, 'Cambio de planes');
  });

  test('si otra escritura la cambió entre medias (0 filas), vuelve a leer y decide con la fila nueva', async () => {
    lecturasReserva = [[fila()], [fila({ updated_at: RELEIDO })]];
    filasCambiadas = [[], [fila({ updated_at: RELEIDO })]];

    const res = await pedir();

    assert.equal(res.status, 200);
    const cambios = de('PATCH', '/rest/v1/reservas');
    assert.deepEqual(
      cambios.map((c) => c.params.updated_at),
      [`eq.${LEIDO}`, `eq.${RELEIDO}`]
    );
  });

  test('si la fila nueva ya tiene la solicitud (la otra escritura era la misma petición), 409', async () => {
    lecturasReserva = [
      [fila()],
      [fila({ updated_at: RELEIDO, historial: [{ tipo: 'cancelacion_solicitada' }] })]
    ];
    filasCambiadas = [[]];

    const res = await pedir();

    assert.equal(res.status, 409);
    assert.equal(de('PATCH', '/rest/v1/reservas').length, 1);
  });

  test('si siempre cambia entre medias, se rinde con un 409 que pide recargar', async () => {
    lecturasReserva = [[fila()], [fila()], [fila()]];
    filasCambiadas = [[], [], []];

    const res = await pedir();

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: 'La reserva ha cambiado mientras la guardábamos. Recarga y vuelve a intentarlo.'
    });
    assert.equal(de('PATCH', '/rest/v1/reservas').length, 3);
  });
});
