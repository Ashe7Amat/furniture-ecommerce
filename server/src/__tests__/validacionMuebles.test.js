// Validación con Zod de POST/PUT /api/muebles (crear y editar un mueble desde el panel de admin,
// task 2 punto 6). Las peticiones son multipart/form-data (por las fotos, vía multer): todos los
// campos de texto llegan como string, incluso precios y booleanos -- validar() los convierte a su
// tipo real (o rechaza con un mensaje claro) DESPUÉS de multer y ANTES del controlador.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const conAuth = (req) => req.set('Authorization', `Bearer ${tokenAdmin}`);

let fake;
beforeEach(() => {
  fake = crearFakeSupabase({});
  mock.method(supabase, 'from', fake.from);
});
afterEach(() => mock.restoreAll());

describe('POST /api/muebles — validación con Zod', () => {
  test('rechaza con 400 si falta el nombre', async () => {
    const res = await conAuth(request(app).post('/api/muebles')).field('categoria', 'Sofás');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El nombre del mueble es obligatorio.');
    assert.equal(fake.escrituras.length, 0);
  });

  test('rechaza con 400 si el precio de venta no es un número', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá')
      .field('categoria', 'Sofás')
      .field('precio_venta', 'no-es-un-numero');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El precio debe ser un número.');
  });

  test('rechaza con 400 un precio negativo', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá')
      .field('categoria', 'Sofás')
      .field('precio_venta', '-10');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El precio no puede ser negativo.');
  });

  test('un precio de solo espacios cuenta como vacío (null), no como 0 (Number("   ") vale 0 en JS)', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá')
      .field('categoria', 'Sofás')
      .field('precio_venta', '   ');

    assert.equal(res.status, 201);
    const insertado = fake.escrituras.find(
      (e) => e.tabla === 'muebles' && e.accion === 'insert'
    ).fila;
    assert.equal(insertado.precio_venta, null);
  });

  test('rechaza con 400 un estado que no es uno de los válidos', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá')
      .field('categoria', 'Sofás')
      .field('estado', 'roto');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El estado debe ser uno de: disponible, vendido, alquilado.');
  });

  test('un payload válido (con el precio como texto, típico de un formulario) se crea con los tipos ya convertidos', async () => {
    const res = await conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Sofá Lumina')
      .field('categoria', 'Sofás')
      .field('precio_venta', '1250.5')
      .field('disponible', 'true'); // se acepta, pero se ignora: lo calcula la base de datos

    assert.equal(res.status, 201);
    const { fila: insertado, enviado } = fake.escrituras.find(
      (e) => e.tabla === 'muebles' && e.accion === 'insert'
    );
    assert.equal(insertado.precio_venta, 1250.5);
    assert.equal(insertado.estado, 'disponible'); // valor por defecto cuando no se manda
    assert.equal('disponible' in enviado, false);
    assert.equal(insertado.disponible, true); // derivado de estado por el trigger
  });

  test('sin token de admin, corta en 401 antes de llegar a la validación', async () => {
    const res = await request(app).post('/api/muebles').field('nombre', 'x');
    assert.equal(res.status, 401);
  });
});

describe('PUT /api/muebles/:id — validación con Zod (actualización parcial)', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'mueble-1',
          nombre: 'Sofá',
          categoria: 'Sofás',
          estado: 'disponible',
          disponible: true,
          precio_venta: 100
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  test('un objeto vacío es válido (no se pide cambiar nada) y no toca el estado de la pieza', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1'));
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].estado, 'disponible');
  });

  test('editar solo el precio no exige mandar el nombre (a diferencia de crear)', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field(
      'precio_venta',
      '999'
    );
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].precio_venta, 999);
    assert.equal(fake.tablas.muebles[0].nombre, 'Sofá'); // no se toca
  });

  test('un precio_alquiler vacío se guarda como null (borra el precio), no como NaN', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field(
      'precio_alquiler',
      ''
    );
    assert.equal(res.status, 200);
    assert.equal(fake.tablas.muebles[0].precio_alquiler_dia, null);
  });

  test('rechaza con 400 un estado inválido, sin escribir nada', async () => {
    const res = await conAuth(request(app).put('/api/muebles/mueble-1')).field('estado', 'roto');
    assert.equal(res.status, 400);
    assert.equal(fake.escrituras.length, 0);
  });
});
