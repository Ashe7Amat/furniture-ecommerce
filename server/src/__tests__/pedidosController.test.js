// Tests de pedidosController.js (tarea 5): obtenerMisPedidos y obtenerPedidos no tenían ningún
// test todavía (PATCH /estado ya está cubierto por validacionPedidos.test.js -- aquí solo se
// añade el caso de "pedido no encontrado" que faltaba ahí).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const tokenCliente = (email) => jwt.sign({ email, nombre: 'Cliente', rol: 'cliente' }, process.env.JWT_SECRET);
const tokenAdmin = jwt.sign({ email: 'admin@test.com', nombre: 'Admin', rol: 'admin' }, process.env.JWT_SECRET);

let fake;
afterEach(() => mock.restoreAll());

describe('GET /api/pedidos/mios — obtenerMisPedidos', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      pedidos: [
        { id: 'p1', cliente_info: { email: 'ana@example.com' }, estado: 'entregado', created_at: '2026-01-01' },
        { id: 'p2', cliente_info: { email: 'ANA@EXAMPLE.COM' }, estado: 'procesando', created_at: '2026-02-01' },
        { id: 'p3', cliente_info: { email: 'otro@example.com' }, estado: 'enviado', created_at: '2026-01-15' }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin token, 401', async () => {
    const res = await request(app).get('/api/pedidos/mios');
    assert.equal(res.status, 401);
  });

  test('devuelve solo los pedidos del email logueado, comparado sin distinguir mayúsculas', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('ana@example.com')}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every((p) => p.id !== 'p3'));
  });

  test('más recientes primero', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('ana@example.com')}`);

    assert.deepEqual(res.body.map((p) => p.id), ['p2', 'p1']);
  });

  test('un cliente sin pedidos recibe un array vacío, no un error', async () => {
    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente('nadie@example.com')}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });
});

describe('GET /api/pedidos — obtenerPedidos (solo admin)', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      pedidos: [
        { id: 'p1', estado: 'entregado', created_at: '2026-01-01' },
        { id: 'p2', estado: 'procesando', created_at: '2026-03-01' }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('sin token, 401', async () => {
    const res = await request(app).get('/api/pedidos');
    assert.equal(res.status, 401);
  });

  test('con token de cliente (no admin), 403', async () => {
    const res = await request(app).get('/api/pedidos').set('Authorization', `Bearer ${tokenCliente('x@example.com')}`);
    assert.equal(res.status, 403);
  });

  test('con token de admin, devuelve todos los pedidos, más recientes primero', async () => {
    const res = await request(app).get('/api/pedidos').set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((p) => p.id), ['p2', 'p1']);
  });
});

describe('PATCH /api/pedidos/:id/estado — caso no cubierto: pedido inexistente', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ pedidos: [{ id: 'pedido-1', estado: 'procesando' }] });
    mock.method(supabase, 'from', fake.from);
  });

  test('un id que no existe da 404, no 500 ni un 200 vacío', async () => {
    const res = await request(app)
      .patch('/api/pedidos/no-existe/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'enviado' });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Pedido no encontrado.');
  });
});
