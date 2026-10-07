// Tests de mueblesController.js (tarea 5 de la sesión del 5 oct 2026, cobertura): cómo se leen las
// imágenes al crear y al editar un mueble sin subir archivos (como JSON dentro de un texto, como un
// texto suelto o como una lista), y los errores de la base de datos que no tenían test.
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

const SILLA = {
  id: 'mueble-1',
  nombre: 'Silla',
  categoria: 'Sillas',
  estado: 'disponible',
  imagenes: ['https://img.test/vieja.jpg']
};

let fake;
const instalar = (opciones = {}) => {
  fake = crearFakeSupabase({
    muebles: [{ ...SILLA }],
    categorias: [{ id: 20, nombre: 'Sillas', codigo: 'SIL', categoria_padre_id: 1 }],
    ...opciones
  });
  mock.method(supabase, 'from', fake.from);
};
beforeEach(() => {
  instalar();
  mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

const editar = (cuerpo) => conAuth(request(app).put('/api/muebles/mueble-1')).send(cuerpo);
const imagenesGuardadas = () => fake.tablas.muebles.find((m) => m.id === 'mueble-1').imagenes;

describe('PUT /api/muebles/:id — imágenes sin subir archivos', () => {
  test('imagenes_existentes como JSON dentro de un texto', async () => {
    const res = await editar({
      imagenes_existentes: '["https://img.test/a.jpg","https://img.test/b.jpg"]'
    });
    assert.equal(res.status, 200);
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/a.jpg', 'https://img.test/b.jpg']);
  });

  // H57: el editor del panel reordena las fotos (la primera es la principal) y las manda en el orden nuevo.
  test('imagenes_existentes se guarda en el orden en que llega, aunque sea otro que el de antes', async () => {
    instalar({
      muebles: [
        {
          ...SILLA,
          imagenes: ['https://img.test/a.jpg', 'https://img.test/b.jpg', 'https://img.test/c.jpg']
        }
      ]
    });
    const res = await editar({
      imagenes_existentes:
        '["https://img.test/c.jpg","https://img.test/a.jpg","https://img.test/b.jpg"]'
    });
    assert.equal(res.status, 200);
    assert.deepEqual(imagenesGuardadas(), [
      'https://img.test/c.jpg',
      'https://img.test/a.jpg',
      'https://img.test/b.jpg'
    ]);
  });

  test('imagenes_existentes como un texto que no es JSON: una sola imagen', async () => {
    await editar({ imagenes_existentes: 'https://img.test/sola.jpg' });
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/sola.jpg']);
  });

  test('imagenes_existentes como lista, o como un valor suelto que no es texto', async () => {
    await editar({ imagenes_existentes: ['https://img.test/a.jpg'] });
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/a.jpg']);

    await editar({ imagenes_existentes: 7 });
    assert.deepEqual(imagenesGuardadas(), [7]);
  });

  test('imagenes_existentes vacía deja el mueble sin fotos (se han quitado todas)', async () => {
    await editar({ imagenes_existentes: '[]' });
    assert.deepEqual(imagenesGuardadas(), []);
  });

  test('imagenes (sin imagenes_existentes): JSON, texto suelto o lista', async () => {
    await editar({ imagenes: '["https://img.test/json.jpg"]' });
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/json.jpg']);

    await editar({ imagenes: 'https://img.test/texto.jpg' });
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/texto.jpg']);

    await editar({ imagenes: ['https://img.test/lista.jpg'] });
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/lista.jpg']);

    await editar({ imagenes: 3 });
    assert.deepEqual(imagenesGuardadas(), [3]);
  });

  test('con imagenes_existentes, imagenes se ignora', async () => {
    await editar({
      imagenes_existentes: '["https://img.test/existente.jpg"]',
      imagenes: '["https://img.test/otra.jpg"]'
    });
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/existente.jpg']);
  });

  test('sin ninguno de los dos, las fotos no se tocan', async () => {
    const res = await editar({ nombre: 'Silla Tolix' });
    assert.equal(res.status, 200);
    assert.deepEqual(imagenesGuardadas(), ['https://img.test/vieja.jpg']);
  });

  test('si falla la base de datos al guardar, 500 genérico', async () => {
    instalar({ fallos: { 'muebles.update': { message: 'caída' } } });
    const res = await editar({ nombre: 'Silla Tolix' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al editar el mueble.');
  });
});

describe('POST /api/muebles — imágenes sin subir archivos', () => {
  const crear = (imagenes) =>
    conAuth(request(app).post('/api/muebles')).send({
      nombre: 'Silla nueva',
      categoria: 'Sillas',
      descripcion: 'Restaurada',
      imagenes
    });
  const nueva = () => fake.tablas.muebles.find((m) => m.nombre === 'Silla nueva');

  test('como JSON dentro de un texto', async () => {
    const res = await crear('["https://img.test/a.jpg"]');
    assert.equal(res.status, 201);
    assert.deepEqual(nueva().imagenes, ['https://img.test/a.jpg']);
  });

  test('como un texto que no es JSON: una sola imagen', async () => {
    await crear('https://img.test/sola.jpg');
    assert.deepEqual(nueva().imagenes, ['https://img.test/sola.jpg']);
  });

  test('como lista, o como un valor suelto que no es texto', async () => {
    await crear(['https://img.test/lista.jpg']);
    assert.deepEqual(nueva().imagenes, ['https://img.test/lista.jpg']);

    instalar();
    await crear(5);
    assert.deepEqual(nueva().imagenes, [5]);
  });
});

describe('errores de la base de datos sin test hasta ahora', () => {
  test('GET /api/admin/muebles: 500 genérico', async () => {
    instalar({ fallos: { 'muebles.select': { message: 'caída' } } });
    const res = await conAuth(request(app).get('/api/admin/muebles'));
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error interno al obtener los muebles.');
  });

  test('DELETE /api/muebles/:id: 500 genérico', async () => {
    instalar({ fallos: { 'muebles.delete': { message: 'caída' } } });
    const res = await conAuth(request(app).delete('/api/muebles/mueble-1'));
    assert.equal(res.status, 500);
    assert.match(res.body.error, /borrar el mueble/);
  });

  test('GET /api/muebles/buscar: 500 genérico; sin término, lista vacía sin consultar', async () => {
    instalar({ fallos: { 'muebles.select': { message: 'caída' } } });
    const res = await request(app).get('/api/muebles/buscar?q=silla');
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error en el motor de búsqueda.');

    const vacia = await request(app).get('/api/muebles/buscar');
    assert.equal(vacia.status, 200);
    assert.deepEqual(vacia.body, []);
  });
});
