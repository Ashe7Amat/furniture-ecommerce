// Test de CONTRATO de la compra frente al calendario (docs/reservas-diseno.md, 6.7) con el cliente
// REAL de supabase-js y un fetch falso que responde como PostgREST, como queryContract.test.js. Fija
// lo que el doble en memoria da por supuesto:
//   - cómo sale la comprobación previa de crear-sesion-pago (la misma definición que la ficha);
//   - que el 409 de PostgREST con 23P01 al insertar la venta se traduce en "¿de quién es la venta
//     de la pieza?": de esta sesión, de otra (doble venta) o de nadie (conflicto); y que un 23503
//     (pieza borrada) no impide el pedido;
//   - cómo se cancela la venta cuando el administrador vuelve a poner la pieza a la venta, y que
//     borrar una pieza con calendario da 409.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad
process.env.CLIENT_URL = 'https://tienda.example.com';
process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const { createClient } = require('@supabase/supabase-js');
const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const stripeUtil = require('../utils/stripe');
const { procesarSesionPagada } = require('../utils/pagos');
const { crearSesion } = require('./helpers/stripeFixtures');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();

const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

const ERROR_EXCLUSION = {
  code: '23P01',
  details: 'Key (mueble_id, rango_ocupado)=(...) conflicts with existing key (...).',
  hint: null,
  message: 'conflicting key value violates exclusion constraint "reservas_sin_solape"'
};
const ERROR_CLAVE_AJENA = {
  code: '23503',
  details: 'Key (mueble_id)=(mueble-1) is not present in table "muebles".',
  hint: null,
  message:
    'insert or update on table "reservas" violates foreign key constraint "reservas_mueble_id_fkey"'
};

let peticiones;
let estadoPieza; // muebles.estado de la pieza
let calendario; // lo que devuelve GET /reservas
let respuestaVenta; // lo que responde POST /reservas
let respuestaBorrado; // lo que responde DELETE /muebles
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const metodo = (init.method || 'GET').toUpperCase();
  peticiones.push({
    metodo,
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams),
    cuerpo: init.body ? JSON.parse(init.body) : null
  });
  if (u.pathname === '/rest/v1/muebles' && metodo === 'GET') {
    return json(200, [
      {
        id: 'mueble-1',
        nombre: 'Sofá Lumina',
        estado: estadoPieza,
        precio_venta: 1250,
        precio_alquiler_dia: null
      }
    ]);
  }
  if (u.pathname === '/rest/v1/muebles' && metodo === 'PATCH')
    return json(200, [{ id: 'mueble-1' }]);
  if (u.pathname === '/rest/v1/muebles' && metodo === 'DELETE') return respuestaBorrado();
  if (u.pathname === '/rest/v1/clientes') return json(200, []);
  if (u.pathname === '/rest/v1/pedidos' && metodo === 'POST') return json(201);
  if (u.pathname === '/rest/v1/pedidos' && metodo === 'GET') return json(200, []);
  if (u.pathname === '/rest/v1/reservas') {
    if (metodo === 'GET') return json(200, calendario(u.searchParams));
    if (metodo === 'POST') return respuestaVenta();
    return json(204);
  }
  return json(404, { message: `Petición no prevista: ${metodo} ${u.pathname}` });
};

const de = (metodo, ruta) => peticiones.filter((p) => p.metodo === metodo && p.ruta === ruta);

let alertas;
beforeEach(() => {
  peticiones = [];
  estadoPieza = 'disponible';
  calendario = () => [];
  respuestaVenta = () => json(201);
  respuestaBorrado = () => json(204);
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { create: async () => ({ url: 'https://checkout.stripe.com/x' }) } }
  }));
  mock.method(email, 'enviarNotificacionVenta', async () => {});
  mock.method(email, 'enviarConfirmacionCliente', async () => {});
  alertas = mock.method(email, 'enviarAlertaAdmin', async () => {});
  mock.method(console, 'error', () => {});
});

afterEach(() => mock.restoreAll());

const pedirPago = () =>
  request(app)
    .post('/api/muebles/crear-sesion-pago')
    .send({
      items: [{ productId: 'mueble-1', modalidad: 'compra' }],
      clienteInfo: {
        nombre: 'Ana',
        email: 'ana@ejemplo.com',
        telefono: '600123456',
        direccion: 'Calle Mayor 15, Barcelona'
      }
    });

describe('contrato de la comprobación previa de crear-sesion-pago', () => {
  test('una sola consulta: las piezas con .in(), los estados que ocupan y el rango desde hoy', async () => {
    const res = await pedirPago();

    assert.equal(res.status, 200);
    const [{ params }] = de('GET', '/rest/v1/reservas');
    assert.deepEqual(params.select.split(','), [
      'mueble_id',
      'tipo',
      'estado',
      'rango_ocupado',
      'expira_en'
    ]);
    assert.equal(params.mueble_id, 'in.(mueble-1)');
    assert.equal(params.estado, 'in.(pendiente,confirmada,en_curso,devuelta)');
    assert.equal(params.rango_ocupado, `ov.[${hoy},)`);
  });

  test('lee el daterange tal como lo devuelve PostgREST', async () => {
    calendario = () => [
      {
        mueble_id: 'mueble-1',
        tipo: 'alquiler',
        estado: 'confirmada',
        rango_ocupado: `[${sumarDias(hoy, 3)},${sumarDias(hoy, 6)})`,
        expira_en: null
      }
    ];
    const res = await pedirPago();
    assert.equal(res.status, 400);
    assert.match(res.body.error, /tiene reservas o está bloqueada hasta el/);
  });
});

describe('contrato de la fila de venta al confirmar el pago', () => {
  test('un 23P01: se limpia y se reintenta, y luego se lee la venta confirmada de la pieza', async () => {
    respuestaVenta = () => json(409, ERROR_EXCLUSION);
    calendario = () => [];

    const resultado = await procesarSesionPagada(crearSesion());

    // ... y, ya con el pedido registrado y antes de avisar, si la otra llamada de la misma sesión
    // (webhook o página de éxito) llegó a dejar la venta.
    assert.deepEqual(
      peticiones.filter((p) => p.ruta === '/rest/v1/reservas').map((p) => p.metodo),
      ['PATCH', 'POST', 'PATCH', 'POST', 'GET', 'GET']
    );
    const [{ params }, { params: revision }] = de('GET', '/rest/v1/reservas');
    assert.equal(params.select, 'stripe_session_id');
    assert.equal(params.mueble_id, 'eq.mueble-1');
    assert.equal(params.tipo, 'eq.venta');
    assert.equal(params.estado, 'eq.confirmada');
    assert.equal(params.limit, '1');
    assert.equal(revision.select, 'id');
    assert.equal(revision.mueble_id, 'eq.mueble-1');
    assert.equal(revision.stripe_session_id, 'eq.cs_test_123');
    assert.equal(revision.tipo, 'eq.venta');
    assert.equal(revision.estado, 'eq.confirmada');
    // Ninguna venta: el choque es con un alquiler o un bloqueo. Conflicto, sin marcar la pieza.
    assert.equal(resultado.conflictos.length, 1);
    assert.equal(resultado.conflictos[0].enCalendario, true);
    assert.equal(de('PATCH', '/rest/v1/muebles').length, 0);
    assert.equal(alertas.mock.callCount(), 1);
  });

  test('si la venta ya era de esta sesión, no es conflicto y la pieza se marca', async () => {
    respuestaVenta = () => json(409, ERROR_EXCLUSION);
    calendario = () => [{ stripe_session_id: 'cs_test_123' }];

    const resultado = await procesarSesionPagada(crearSesion());

    assert.deepEqual(resultado.conflictos, []);
    assert.equal(de('PATCH', '/rest/v1/muebles').length, 1);
    assert.equal(alertas.mock.callCount(), 0);
  });

  test('si es de otra sesión, es una doble venta: la pieza se marca y el aviso es el de siempre', async () => {
    respuestaVenta = () => json(409, ERROR_EXCLUSION);
    calendario = () => [{ stripe_session_id: 'cs_otra' }];

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.conflictos.length, 1);
    assert.equal(resultado.conflictos[0].enCalendario, false);
    assert.equal(de('PATCH', '/rest/v1/muebles').length, 1);
    assert.equal(
      alertas.mock.calls[0].arguments[0].asunto,
      'Posible doble venta de una pieza única'
    );
  });

  test('un interbloqueo (40P01) se reintenta como un 23P01', async () => {
    const respuestas = [
      json(500, {
        code: '40P01',
        details: 'Process 1 waits for ShareLock on transaction 2; blocked by process 2.',
        hint: 'See server log for query details.',
        message: 'deadlock detected'
      }),
      json(201)
    ];
    respuestaVenta = () => respuestas.shift();

    const resultado = await procesarSesionPagada(crearSesion());

    assert.deepEqual(
      peticiones.filter((p) => p.ruta === '/rest/v1/reservas').map((p) => p.metodo),
      ['PATCH', 'POST', 'PATCH', 'POST']
    );
    assert.deepEqual(resultado.conflictos, []);
    assert.equal(de('PATCH', '/rest/v1/muebles').length, 1);
  });

  test('un 23503 (la pieza ya no existe): el pedido se registra igual', async () => {
    respuestaVenta = () => json(409, ERROR_CLAVE_AJENA);
    const resultado = await procesarSesionPagada(crearSesion());
    assert.equal(resultado.estado, 'procesada');
    assert.equal(de('POST', '/rest/v1/pedidos').length, 1);
  });
});

describe('contrato del panel con la venta del calendario', () => {
  const tokenAdmin = jwt.sign(
    { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
    process.env.JWT_SECRET
  );

  test('volver a poner a la venta una pieza vendida: lee el estado, cancela su venta y luego la cambia', async () => {
    estadoPieza = 'vendido';
    calendario = () => [{ id: 'venta-1', historial: [{ tipo: 'creada' }] }];

    const res = await request(app)
      .put('/api/muebles/mueble-1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'disponible' });

    assert.equal(res.status, 200);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      [
        'GET /rest/v1/muebles',
        'GET /rest/v1/reservas',
        'PATCH /rest/v1/reservas',
        'PATCH /rest/v1/muebles',
        'POST /rest/v1/audit_log'
      ]
    );
    const [antes, ventas, cancelar] = peticiones;
    assert.equal(antes.params.select, 'estado');
    assert.equal(antes.params.id, 'eq.mueble-1');
    assert.equal(ventas.params.select, 'id,historial');
    assert.equal(ventas.params.mueble_id, 'eq.mueble-1');
    assert.equal(ventas.params.tipo, 'eq.venta');
    assert.equal(ventas.params.estado, 'eq.confirmada');
    assert.equal(cancelar.params.id, 'eq.venta-1');
    assert.equal(cancelar.params.estado, 'eq.confirmada');
    assert.equal(cancelar.cuerpo.estado, 'cancelada');
    assert.equal(cancelar.cuerpo.cancelada_por, 'admin');
    assert.deepEqual(
      cancelar.cuerpo.historial.map((h) => h.tipo),
      ['creada', 'cancelada']
    );
  });

  test('borrar una pieza con calendario: el 409 de PostgREST con 23503 llega como 409 explicado', async () => {
    respuestaBorrado = () =>
      json(409, {
        code: '23503',
        details: 'Key (id)=(mueble-1) is still referenced from table "reservas".',
        hint: null,
        message:
          'update or delete on table "muebles" violates foreign key constraint "reservas_mueble_id_fkey" on table "reservas"'
      });

    const res = await request(app)
      .delete('/api/muebles/mueble-1')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 409);
    assert.match(res.body.error, /^No se puede borrar: esta pieza tiene ventas o reservas/);
  });
});
