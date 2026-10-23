// Tests unitarios y de integración para el sistema de Audit Log (FASE 1)
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-audit-log';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { registrarActividad, calcularDiff, sonValoresIguales } = require('../utils/audit');

const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const ADMIN_EMAIL = 'admin@nave5barcelona.com';
const tokenAdmin = jwt.sign(
  { sub: ADMIN_ID, email: ADMIN_EMAIL, rol: 'admin', nombre: 'Admin Nave 5' },
  process.env.JWT_SECRET
);

let fake;
const instalar = (opciones = {}) => {
  fake = crearFakeSupabase({
    muebles: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        nombre: 'Silla Vintage',
        categoria: 'Sillas',
        categoria_id: '1',
        descripcion: 'Madera noble restaurada',
        precio_venta: 150,
        precio_alquiler_dia: 15,
        imagenes: ['https://example.com/silla.jpg'],
        estado: 'disponible',
        disponible: true,
        referencia: 'NAV-SIL-001'
      }
    ],
    categorias: [
      {
        id: '1',
        nombre: 'Sillas',
        codigo: 'SIL',
        imagen_url: 'https://example.com/cat-sillas.jpg',
        categoria_padre_id: null
      }
    ],
    clientes: [
      {
        id: ADMIN_ID,
        email: ADMIN_EMAIL,
        password: bcrypt.hashSync('Password123!', 10),
        nombre: 'Admin Nave 5',
        rol: 'admin',
        email_verificado: true
      }
    ],
    pedidos: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        estado: 'procesando',
        total: 150,
        created_at: '2026-10-21T10:00:00.000Z',
        items: [],
        cliente_info: { nombre: 'Cliente Test', email: 'cliente@test.com' }
      }
    ],
    ...opciones
  });
  mock.method(supabase, 'from', fake.from);
};

beforeEach(() => {
  instalar();
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
});

afterEach(() => {
  mock.restoreAll();
});

describe('Utilidad audit.js', () => {
  describe('sonValoresIguales', () => {
    test('compara primitivos correctamente', () => {
      assert.equal(sonValoresIguales(10, 10), true);
      assert.equal(sonValoresIguales(10, 20), false);
      assert.equal(sonValoresIguales('hola', 'hola'), true);
      assert.equal(sonValoresIguales('hola', 'adios'), false);
      assert.equal(sonValoresIguales(null, null), true);
      assert.equal(sonValoresIguales(undefined, undefined), true);
      assert.equal(sonValoresIguales(null, undefined), false);
      assert.equal(sonValoresIguales(10, '10'), false);
    });

    test('compara objetos y arrays', () => {
      assert.equal(sonValoresIguales(['a', 'b'], ['a', 'b']), true);
      assert.equal(sonValoresIguales(['a', 'b'], ['b', 'a']), false);
      assert.equal(sonValoresIguales({ foo: 1 }, { foo: 1 }), true);
      assert.equal(sonValoresIguales({ foo: 1 }, { foo: 2 }), false);
    });
  });

  describe('calcularDiff', () => {
    test('en creación: guarda todo en datos_nuevos y null en datos_anteriores', () => {
      const res = calcularDiff(null, { precio: 100, nombre: 'Mesa' });
      assert.equal(res.hayCambios, true);
      assert.equal(res.diffAnteriores, null);
      assert.deepEqual(res.diffNuevos, { precio: 100, nombre: 'Mesa' });
    });

    test('en eliminación: guarda todo en datos_anteriores y null en datos_nuevos', () => {
      const res = calcularDiff({ precio: 100, nombre: 'Mesa' }, null);
      assert.equal(res.hayCambios, true);
      assert.deepEqual(res.diffAnteriores, { precio: 100, nombre: 'Mesa' });
      assert.equal(res.diffNuevos, null);
    });

    test('si no hay datos en ninguno: hayCambios es false', () => {
      const res = calcularDiff(null, null);
      assert.equal(res.hayCambios, false);
      assert.equal(res.diffAnteriores, null);
      assert.equal(res.diffNuevos, null);
    });

    test('en edición con cambios: calcula el diff exacto de los campos modificados', () => {
      // Regla: si le paso {precio: 100} y {precio: 120}, debe guardar {precio: 120} en nuevos
      const res = calcularDiff(
        { precio: 100, nombre: 'Mesa', estado: 'disponible' },
        { precio: 120, nombre: 'Mesa' }
      );
      assert.equal(res.hayCambios, true);
      assert.deepEqual(res.diffAnteriores, { precio: 100 });
      assert.deepEqual(res.diffNuevos, { precio: 120 });
    });

    test('en edición sin cambios: hayCambios es false y no genera diff', () => {
      const res = calcularDiff({ precio: 100, nombre: 'Mesa' }, { precio: 100, nombre: 'Mesa' });
      assert.equal(res.hayCambios, false);
      assert.deepEqual(res.diffAnteriores, {});
      assert.deepEqual(res.diffNuevos, {});
    });

    test('ignora cambios de updated_at', () => {
      const res = calcularDiff(
        { precio: 100, updated_at: '2026-01-01' },
        { precio: 100, updated_at: '2026-01-02' }
      );
      assert.equal(res.hayCambios, false);
    });
  });

  describe('registrarActividad', () => {
    test('inserta en audit_log si hay cambios', async () => {
      const req = { usuario: { sub: ADMIN_ID, email: ADMIN_EMAIL } };
      const resultado = await registrarActividad(
        req,
        'editar',
        'muebles',
        'm-123',
        { precio: 100 },
        { precio: 120 }
      );

      assert.ok(resultado);
      assert.equal(fake.tablas.audit_log.length, 1);
      const entrada = fake.tablas.audit_log[0];
      assert.equal(entrada.admin_id, ADMIN_ID);
      assert.equal(entrada.admin_email, ADMIN_EMAIL);
      assert.equal(entrada.accion, 'editar');
      assert.equal(entrada.entidad, 'muebles');
      assert.equal(entrada.entidad_id, 'm-123');
      assert.deepEqual(entrada.datos_anteriores, { precio: 100 });
      assert.deepEqual(entrada.datos_nuevos, { precio: 120 });
    });

    test('si no hay cambios en edición, no inserta nada en audit_log', async () => {
      const req = { usuario: { sub: ADMIN_ID, email: ADMIN_EMAIL } };
      const resultado = await registrarActividad(
        req,
        'editar',
        'muebles',
        'm-123',
        { precio: 100 },
        { precio: 100 }
      );

      assert.equal(resultado, null);
      assert.equal(fake.tablas.audit_log.length, 0);
    });

    test('REGLA DE ORO: si supabase falla al insertar el log, no lanza error y devuelve null', async () => {
      instalar({
        fallos: { 'audit_log.insert': { message: 'error en audit_log' } }
      });
      const req = { usuario: { sub: ADMIN_ID, email: ADMIN_EMAIL } };
      const resultado = await registrarActividad(req, 'crear', 'muebles', 'm-999', null, {
        nombre: 'Nuevo'
      });

      assert.equal(resultado, null);
    });

    test('captura excepciones inesperadas sin propagar error', async () => {
      mock.method(supabase, 'from', () => {
        throw new Error('excepción inesperada');
      });

      const res = await registrarActividad(null, 'crear', 'muebles', 'm-1', null, { a: 1 });
      assert.equal(res, null);
    });
  });
});

describe('Integración con mueblesController', () => {
  const SILLA_ID = '00000000-0000-4000-8000-000000000001';

  test('POST /api/muebles registra actividad al crear un mueble', async () => {
    const res = await request(app)
      .post('/api/muebles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Mesa de Centro')
      .field('categoria', 'Sillas')
      .field('descripcion', 'Mesa baja')
      .field('precio_venta', '200')
      .field('estado', 'disponible');

    assert.equal(res.status, 201);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'crear');
    assert.equal(log.entidad, 'muebles');
    assert.equal(log.admin_id, ADMIN_ID);
    assert.equal(log.admin_email, ADMIN_EMAIL);
    assert.equal(log.datos_anteriores, null);
    assert.equal(log.datos_nuevos.nombre, 'Mesa de Centro');
  });

  test('PUT /api/muebles/:id registra actividad con el diff al editar un mueble', async () => {
    const res = await request(app)
      .put(`/api/muebles/${SILLA_ID}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('precio_venta', '180');

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'editar');
    assert.equal(log.entidad, 'muebles');
    assert.equal(log.entidad_id, SILLA_ID);
    assert.deepEqual(log.datos_anteriores, { precio_venta: 150 });
    assert.deepEqual(log.datos_nuevos, { precio_venta: 180 });
  });

  test('PUT /api/muebles/:id sin cambios no genera entrada en audit_log', async () => {
    const res = await request(app)
      .put(`/api/muebles/${SILLA_ID}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('precio_venta', '150');

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.audit_log.length, 0);
  });

  test('DELETE /api/muebles/:id registra actividad al eliminar un mueble', async () => {
    const res = await request(app)
      .delete(`/api/muebles/${SILLA_ID}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'eliminar');
    assert.equal(log.entidad, 'muebles');
    assert.equal(log.entidad_id, SILLA_ID);
    assert.equal(log.datos_anteriores.nombre, 'Silla Vintage');
    assert.equal(log.datos_nuevos, null);
  });

  test('POST /api/muebles/:id/duplicar registra actividad al duplicar un mueble', async () => {
    const res = await request(app)
      .post(`/api/muebles/${SILLA_ID}/duplicar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 201);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'duplicar');
    assert.equal(log.entidad, 'muebles');
    assert.equal(log.datos_anteriores, null);
    assert.equal(log.datos_nuevos.nombre, 'Silla Vintage (Copia)');
  });

  test('REGLA DE ORO: si el log de auditoría falla, el mueble se crea igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const res = await request(app)
      .post('/api/muebles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Aparador Nórdico')
      .field('categoria', 'Sillas')
      .field('descripcion', 'Aparador')
      .field('precio_venta', '300')
      .field('estado', 'disponible');

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(fake.tablas.muebles.some((m) => m.nombre === 'Aparador Nórdico'));
  });

  test('REGLA DE ORO: si el log de auditoría falla, el mueble se edita igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const res = await request(app)
      .put(`/api/muebles/${SILLA_ID}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('precio_venta', '199');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const mueble = fake.tablas.muebles.find((m) => m.id === SILLA_ID);
    assert.equal(mueble.precio_venta, 199);
  });

  test('REGLA DE ORO: si el log de auditoría falla, el mueble se elimina igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const res = await request(app)
      .delete(`/api/muebles/${SILLA_ID}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(
      fake.tablas.muebles.find((m) => m.id === SILLA_ID),
      undefined
    );
  });

  test('REGLA DE ORO: si el log de auditoría falla, el mueble se duplica igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const res = await request(app)
      .post(`/api/muebles/${SILLA_ID}/duplicar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(fake.tablas.muebles.some((m) => m.nombre === 'Silla Vintage (Copia)'));
  });
});

describe('Integración con categoriasController', () => {
  test('POST /api/categorias registra actividad al crear una categoría', async () => {
    const res = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Mesas')
      .field('codigo', 'MES');

    assert.equal(res.status, 201);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'crear');
    assert.equal(log.entidad, 'categorias');
    assert.equal(log.datos_anteriores, null);
    assert.equal(log.datos_nuevos.nombre, 'Mesas');
  });

  test('PUT /api/categorias/:id registra actividad al editar una categoría', async () => {
    const res = await request(app)
      .put('/api/categorias/1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Sillas y Sillones');

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'editar');
    assert.equal(log.entidad, 'categorias');
    assert.equal(log.entidad_id, '1');
    assert.deepEqual(log.datos_anteriores, { nombre: 'Sillas' });
    assert.deepEqual(log.datos_nuevos, { nombre: 'Sillas y Sillones' });
  });

  test('DELETE /api/categorias/:id registra actividad al eliminar una categoría', async () => {
    const res = await request(app)
      .delete('/api/categorias/1')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'eliminar');
    assert.equal(log.entidad, 'categorias');
    assert.equal(log.entidad_id, '1');
    assert.equal(log.datos_anteriores.nombre, 'Sillas');
    assert.equal(log.datos_nuevos, null);
  });

  test('REGLA DE ORO: si el log de auditoría falla, la categoría se crea, edita y elimina igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const resCrear = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Lámparas')
      .field('codigo', 'LAM');
    assert.equal(resCrear.status, 201);

    const resEditar = await request(app)
      .put('/api/categorias/1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Sillas Antiguas');
    assert.equal(resEditar.status, 200);

    const resEliminar = await request(app)
      .delete('/api/categorias/1')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(resEliminar.status, 200);
  });
});

describe('Integración con pedidosController', () => {
  const PEDIDO_ID = '00000000-0000-4000-8000-000000000010';

  test('PATCH /api/pedidos/:id/estado registra actividad de cambio_estado', async () => {
    const res = await request(app)
      .patch(`/api/pedidos/${PEDIDO_ID}/estado`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'enviado' });

    assert.equal(res.status, 200);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'cambio_estado');
    assert.equal(log.entidad, 'pedidos');
    assert.equal(log.entidad_id, PEDIDO_ID);
    assert.equal(log.admin_id, ADMIN_ID);
    assert.equal(log.admin_email, ADMIN_EMAIL);
    assert.deepEqual(log.datos_anteriores, { estado: 'procesando' });
    assert.deepEqual(log.datos_nuevos, { estado: 'enviado' });
  });

  test('REGLA DE ORO: si el log falla, el estado del pedido se actualiza igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const res = await request(app)
      .patch(`/api/pedidos/${PEDIDO_ID}/estado`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'entregado' });

    assert.equal(res.status, 200);
    const pedido = fake.tablas.pedidos.find((p) => p.id === PEDIDO_ID);
    assert.equal(pedido.estado, 'entregado');
  });
});

describe('Integración con authController (login)', () => {
  test('POST /api/auth/login registra actividad de login exitoso', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'Password123!' });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(fake.tablas.audit_log.length, 1);
    const log = fake.tablas.audit_log[0];
    assert.equal(log.accion, 'login');
    assert.equal(log.entidad, 'auth');
    assert.equal(log.admin_id, ADMIN_ID);
    assert.equal(log.admin_email, ADMIN_EMAIL);
    assert.equal(log.datos_anteriores, null);
    assert.equal(log.datos_nuevos.email, ADMIN_EMAIL);
    assert.equal(log.datos_nuevos.rol, 'admin');
  });

  test('REGLA DE ORO: si el log de auditoría falla, el login funciona igual', async () => {
    instalar({
      fallos: { 'audit_log.insert': { message: 'fallo de conexión a audit_log' } }
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'Password123!' });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });
});

describe('Endpoint GET /api/admin/audit-log', () => {
  const tokenCliente = jwt.sign(
    { sub: '00000000-0000-4000-8000-0000000000c1', email: 'cliente@test.com', rol: 'cliente' },
    process.env.JWT_SECRET
  );

  beforeEach(() => {
    instalar({
      audit_log: [
        {
          id: 'log-1',
          admin_id: ADMIN_ID,
          admin_email: ADMIN_EMAIL,
          accion: 'crear',
          entidad: 'muebles',
          entidad_id: 'm-1',
          datos_anteriores: null,
          datos_nuevos: { nombre: 'Mueble Uno' },
          created_at: '2026-10-21T12:00:00.000Z'
        },
        {
          id: 'log-2',
          admin_id: ADMIN_ID,
          admin_email: ADMIN_EMAIL,
          accion: 'editar',
          entidad: 'muebles',
          entidad_id: 'm-1',
          datos_anteriores: { precio_venta: 100 },
          datos_nuevos: { precio_venta: 120 },
          created_at: '2026-10-21T12:10:00.000Z'
        },
        {
          id: 'log-3',
          admin_id: 'otro-admin',
          admin_email: 'otro@nave5barcelona.com',
          accion: 'cambio_estado',
          entidad: 'pedidos',
          entidad_id: 'ped-1',
          datos_anteriores: { estado: 'procesando' },
          datos_nuevos: { estado: 'enviado' },
          created_at: '2026-10-21T12:20:00.000Z'
        }
      ]
    });
  });

  test('sin token devuelve 401', async () => {
    const res = await request(app).get('/api/admin/audit-log');
    assert.equal(res.status, 401);
  });

  test('con rol no admin devuelve 403', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${tokenCliente}`);
    assert.equal(res.status, 403);
  });

  test('con token admin devuelve los registros paginados ordenados por created_at DESC', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.logs));
    assert.equal(res.body.logs.length, 3);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.pagina, 1);
    assert.equal(res.body.porPagina, 50);
    assert.equal(res.body.logs[0].id, 'log-3');
    assert.equal(res.body.logs[1].id, 'log-2');
    assert.equal(res.body.logs[2].id, 'log-1');
  });

  test('filtra por entidad (tanto singular como plural)', async () => {
    const resSingular = await request(app)
      .get('/api/admin/audit-log?entidad=mueble')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(resSingular.status, 200);
    assert.equal(resSingular.body.logs.length, 2);
    assert.ok(resSingular.body.logs.every((l) => l.entidad === 'muebles'));

    const resPlural = await request(app)
      .get('/api/admin/audit-log?entidad=muebles')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(resPlural.status, 200);
    assert.equal(resPlural.body.logs.length, 2);
  });

  test('filtra por accion', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?accion=crear')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.logs.length, 1);
    assert.equal(res.body.logs[0].accion, 'crear');
  });

  test('filtra por admin_email', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?admin_email=otro@nave5barcelona.com')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.logs.length, 1);
    assert.equal(res.body.logs[0].admin_email, 'otro@nave5barcelona.com');
  });

  test('soporta paginación con page y limit', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?page=1&limit=2')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.logs.length, 2);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.totalPaginas, 2);
  });
});
