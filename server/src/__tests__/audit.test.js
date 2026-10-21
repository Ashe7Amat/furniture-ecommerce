// Tests unitarios y de integración para el sistema de Audit Log (FASE 1)
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
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
