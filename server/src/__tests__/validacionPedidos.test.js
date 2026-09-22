// Validación con Zod de PATCH /api/pedidos/:id/estado (task 2, punto 6): mismo mensaje que el
// chequeo manual que reemplaza.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const tokenAdmin = jwt.sign({ email: 'admin@test.com', nombre: 'Admin', rol: 'admin' }, process.env.JWT_SECRET);

let fake;
beforeEach(() => {
  fake = crearFakeSupabase({ pedidos: [{ id: 'pedido-1', estado: 'procesando' }] });
  mock.method(supabase, 'from', fake.from);
});
afterEach(() => mock.restoreAll());

describe('PATCH /api/pedidos/:id/estado — validación con Zod', () => {
  test('rechaza con 400 un estado que no está en la lista, sin escribir nada', async () => {
    const res = await request(app).patch('/api/pedidos/pedido-1/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'perdido' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Estado no válido. Usa uno de: procesando, enviado, entregado, cancelado.');
    assert.equal(fake.tablas.pedidos[0].estado, 'procesando');
  });

  test('rechaza con 400 si falta el estado', async () => {
    const res = await request(app).patch('/api/pedidos/pedido-1/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});
    assert.equal(res.status, 400);
  });

  test('un estado válido se acepta y actualiza el pedido', async () => {
    const res = await request(app).patch('/api/pedidos/pedido-1/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'enviado' });

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.pedidos[0].estado, 'enviado');
  });

  test('sin token de admin, corta en 401/403 antes de llegar a la validación', async () => {
    const res = await request(app).patch('/api/pedidos/pedido-1/estado').send({ estado: 'perdido' });
    assert.equal(res.status, 401);
  });
});
