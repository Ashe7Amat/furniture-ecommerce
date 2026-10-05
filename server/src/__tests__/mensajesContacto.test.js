// Panel "Mensajes" (pendiente de la migración mensajes_contacto): el formulario de contacto guarda
// cada mensaje antes de mandar el correo, y el panel los lista y los marca como leídos.
// El limitador del formulario (5 por IP cada 15 minutos) es un contador de este proceso: este
// archivo hace 4 envíos como mucho.
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
const { MAX_MENSAJES } = require('../controllers/mensajesController');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const tokenCliente = jwt.sign(
  { email: 'cliente@test.com', nombre: 'Cliente', rol: 'cliente' },
  process.env.JWT_SECRET
);
const conAdmin = (peticion) => peticion.set('Authorization', `Bearer ${tokenAdmin}`);

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';
const MENSAJES = [
  {
    id: ID_1,
    nombre: 'Ana',
    email: 'ana@example.com',
    mensaje: 'Primero',
    leido: true,
    created_at: '2026-10-01T10:00:00Z'
  },
  {
    id: ID_2,
    nombre: 'Luis',
    email: 'luis@example.com',
    mensaje: 'Segundo',
    leido: false,
    created_at: '2026-10-03T10:00:00Z'
  }
];
const MENSAJE_VALIDO = {
  nombre: '  Lucía  ',
  email: 'lucia@example.com',
  mensaje: 'Quería preguntar por el aparador de roble.'
};

let fake;
let registroErrores;
beforeEach(() => {
  fake = crearFakeSupabase({ mensajes_contacto: MENSAJES.map((m) => ({ ...m })) });
  mock.method(supabase, 'from', fake.from);
  registroErrores = mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

describe('POST /api/contacto guarda el mensaje', () => {
  test('lo guarda (recortado) ANTES de mandar el correo, y responde 200', async () => {
    const orden = [];
    const enviar = mock.method(email, 'enviarMensajeContacto', async () => {
      orden.push(
        fake.tablas.mensajes_contacto.length === 3 ? 'correo después de guardar' : 'correo antes'
      );
      return true;
    });

    const res = await request(app).post('/api/contacto').send(MENSAJE_VALIDO);

    assert.equal(res.status, 200);
    assert.deepEqual(orden, ['correo después de guardar']);
    const guardado = fake.escrituras.find((e) => e.tabla === 'mensajes_contacto');
    assert.deepEqual(guardado.enviado, {
      nombre: 'Lucía',
      email: 'lucia@example.com',
      mensaje: 'Quería preguntar por el aparador de roble.'
    });
    assert.equal(enviar.mock.callCount(), 1);
  });

  test('si el correo falla pero el mensaje se guardó, responde 200: no se pierde', async () => {
    mock.method(email, 'enviarMensajeContacto', async () => false);

    const res = await request(app).post('/api/contacto').send(MENSAJE_VALIDO);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(fake.tablas.mensajes_contacto.length, 3);
  });

  test('si no se puede guardar (p. ej. sin la tabla), se apunta sin datos personales y sigue con el correo', async () => {
    fake.fallos['mensajes_contacto.insert'] = {
      code: '42P01',
      message: 'relation "public.mensajes_contacto" does not exist'
    };
    const enviar = mock.method(email, 'enviarMensajeContacto', async () => true);

    const res = await request(app).post('/api/contacto').send(MENSAJE_VALIDO);

    assert.equal(res.status, 200);
    assert.equal(enviar.mock.callCount(), 1);
    const log = JSON.stringify(registroErrores.mock.calls.map((c) => c.arguments));
    assert.match(log, /No se pudo guardar el mensaje de contacto/);
    assert.doesNotMatch(log, /Lucía|lucia@example\.com|aparador/);
  });

  test('el honeypot no guarda nada', async () => {
    const res = await request(app)
      .post('/api/contacto')
      .send({ ...MENSAJE_VALIDO, web: 'http://spam.test' });
    assert.equal(res.status, 200);
    assert.equal(fake.escrituras.length, 0);
  });
});

describe('GET /api/admin/mensajes', () => {
  test('sin sesión, 401; con sesión de cliente, 403', async () => {
    assert.equal((await request(app).get('/api/admin/mensajes')).status, 401);
    assert.equal(
      (await request(app).get('/api/admin/mensajes').set('Authorization', `Bearer ${tokenCliente}`))
        .status,
      403
    );
  });

  test('los lista del más reciente al más antiguo, sin caché', async () => {
    const res = await conAdmin(request(app).get('/api/admin/mensajes'));
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((m) => m.id),
      [ID_2, ID_1]
    );
    assert.deepEqual(Object.keys(res.body[0]).sort(), [
      'created_at',
      'email',
      'id',
      'leido',
      'mensaje',
      'nombre'
    ]);
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test(`devuelve como mucho ${MAX_MENSAJES}`, async () => {
    fake.tablas.mensajes_contacto.length = 0;
    for (let i = 0; i < MAX_MENSAJES + 3; i++) {
      fake.tablas.mensajes_contacto.push({
        id: `m-${i}`,
        nombre: 'X',
        email: 'x@example.com',
        mensaje: 'Hola',
        leido: false,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()
      });
    }
    const res = await conAdmin(request(app).get('/api/admin/mensajes'));
    assert.equal(res.body.length, MAX_MENSAJES);
  });

  test('un error de la base de datos (p. ej. sin la tabla) da 500 con mensaje genérico', async () => {
    fake.fallos['mensajes_contacto.select'] = { message: 'relation does not exist' };
    const res = await conAdmin(request(app).get('/api/admin/mensajes'));
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al obtener los mensajes.');
  });
});

describe('PATCH /api/admin/mensajes/:id/leido', () => {
  test('lo marca como leído y devuelve el mensaje', async () => {
    const res = await conAdmin(request(app).patch(`/api/admin/mensajes/${ID_2}/leido`));
    assert.equal(res.status, 200);
    assert.equal(res.body.id, ID_2);
    assert.equal(res.body.leido, true);
    assert.equal(fake.tablas.mensajes_contacto.find((m) => m.id === ID_2).leido, true);
  });

  test('con { leido: false }, lo vuelve a dejar como no leído', async () => {
    const res = await conAdmin(request(app).patch(`/api/admin/mensajes/${ID_1}/leido`)).send({
      leido: false
    });
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.mensajes_contacto.find((m) => m.id === ID_1).leido, false);
  });

  test('sin sesión de administrador no toca nada', async () => {
    assert.equal((await request(app).patch(`/api/admin/mensajes/${ID_2}/leido`)).status, 401);
    assert.equal(fake.escrituras.length, 0);
  });

  test('un id que no es un UUID: 400 sin consultar nada', async () => {
    const res = await conAdmin(request(app).patch('/api/admin/mensajes/abc/leido'));
    assert.equal(res.status, 400);
    assert.equal(fake.escrituras.length, 0);
  });

  test('un mensaje que no existe: 404', async () => {
    const res = await conAdmin(
      request(app).patch('/api/admin/mensajes/33333333-3333-4333-8333-333333333333/leido')
    );
    assert.equal(res.status, 404);
  });

  test('un error de la base de datos da 500 con mensaje genérico', async () => {
    fake.fallos['mensajes_contacto.update'] = { message: 'caído' };
    const res = await conAdmin(request(app).patch(`/api/admin/mensajes/${ID_2}/leido`));
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al actualizar el mensaje.');
  });
});
