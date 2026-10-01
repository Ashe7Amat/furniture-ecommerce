// Caminos de error de los controladores de pedidos, categorías y contacto que no cubría ningún
// test: la base de datos falla (o la consulta lanza) y el controlador responde un 500 con un
// mensaje genérico, sin detalles internos (H3); y el contacto responde 502 si el correo no sale.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const email = require('../utils/email');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const firmar = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
const tokenAdmin = firmar({
  email: 'admin@test.com',
  nombre: 'Admin',
  rol: 'admin'
});
const tokenCliente = firmar({
  email: 'ana@example.com',
  nombre: 'Ana',
  rol: 'cliente'
});
const ERROR_BD = {
  message: 'relation "pedidos" does not exist',
  code: '42P01'
};

let registroErrores;
beforeEach(() => {
  registroErrores = mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

// Instala el doble de Supabase con la operación indicada fallando.
const conFallo = (fallos, tablas = {}) => {
  const fake = crearFakeSupabase({ ...tablas, fallos });
  mock.method(supabase, 'from', fake.from);
  return fake;
};
// Comprueba que la respuesta no deja ver nada del error interno.
const sinDetalles = (res) => {
  const cuerpo = JSON.stringify(res.body);
  assert.doesNotMatch(cuerpo, /relation|42P01|does not exist|conexión caída/);
};

describe('pedidos', () => {
  test('GET /api/pedidos/mios: un token sin email da 401, sin consultar nada', async () => {
    const fake = conFallo({});
    const sinEmail = firmar({ nombre: 'Raro', rol: 'cliente' });

    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${sinEmail}`);

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'No has iniciado sesión.' });
    assert.equal(fake.escrituras.length, 0);
  });

  test('GET /api/pedidos/mios: si falla la base de datos, 500 genérico', async () => {
    conFallo({ 'pedidos.select': ERROR_BD });

    const res = await request(app)
      .get('/api/pedidos/mios')
      .set('Authorization', `Bearer ${tokenCliente}`);

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      error: 'Error interno al obtener tus pedidos.'
    });
    sinDetalles(res);
    assert.equal(registroErrores.mock.callCount(), 1);
  });

  test('GET /api/pedidos (admin): si falla la base de datos, 500 genérico', async () => {
    conFallo({ 'pedidos.select': ERROR_BD });

    const res = await request(app).get('/api/pedidos').set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      error: 'Error interno al obtener los pedidos.'
    });
    sinDetalles(res);
  });

  test('PATCH /api/pedidos/:id/estado: si la consulta lanza, 500 genérico', async () => {
    mock.method(supabase, 'from', () => {
      throw new Error('conexión caída');
    });

    const res = await request(app)
      .patch('/api/pedidos/p1/estado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'enviado' });

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      error: 'Error interno al actualizar el pedido.'
    });
    sinDetalles(res);
  });
});

describe('categorías (admin)', () => {
  const CATEGORIAS = {
    categorias: [{ id: 3, nombre: 'Sillas', categoria_padre_id: null, imagen_url: null }]
  };

  test('POST /api/categorias: si falla el insert, 500 genérico', async () => {
    conFallo({ 'categorias.insert': ERROR_BD }, CATEGORIAS);

    const res = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Mesas');

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error al crear la categoría.' });
    sinDetalles(res);
  });

  test('PUT /api/categorias/:id: si falla el update, 500 genérico', async () => {
    conFallo({ 'categorias.update': ERROR_BD }, CATEGORIAS);

    const res = await request(app)
      .put('/api/categorias/3')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Sillas de comedor');

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error al editar la categoría.' });
    sinDetalles(res);
  });

  test('DELETE /api/categorias/:id: si falla el borrado, 500 genérico y la categoría sigue ahí', async () => {
    const fake = conFallo({ 'categorias.delete': ERROR_BD }, CATEGORIAS);

    const res = await request(app)
      .delete('/api/categorias/3')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error al eliminar la categoría.' });
    sinDetalles(res);
    assert.equal(fake.tablas.categorias.length, 1);
  });
});

describe('contacto', () => {
  test('POST /api/contacto: si el correo no sale, 502 y el visitante puede reintentar', async () => {
    const enviar = mock.method(email, 'enviarMensajeContacto', async () => false);

    const res = await request(app).post('/api/contacto').send({
      nombre: 'Ana',
      email: 'ana@example.com',
      mensaje: 'Quería preguntar por el aparador.'
    });

    assert.equal(res.status, 502);
    assert.deepEqual(res.body, {
      error: 'No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.'
    });
    assert.equal(enviar.mock.callCount(), 1);
  });

  test('POST /api/contacto: si sale, 200 { success: true }', async () => {
    mock.method(email, 'enviarMensajeContacto', async () => true);

    const res = await request(app).post('/api/contacto').send({
      nombre: 'Ana',
      email: 'ana@example.com',
      mensaje: 'Quería preguntar por el aparador.'
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });
});
