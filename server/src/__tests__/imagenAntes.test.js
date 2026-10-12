// La foto de antes de restaurar (columna `imagen_antes`), para el "antes y después" de la ficha. Se sube
// al editar un mueble, en su propio campo de archivo (imagen_antes), y se quita con quitar_imagen_antes.
// Como en miniaturas.test.js, sharp es la de verdad y solo se sustituye Supabase Storage.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
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
const imagen = () =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 90, b: 60 } } })
    .png()
    .toBuffer();

let fake;
let subidas;
const instalar = (mueble = {}) => {
  fake = crearFakeSupabase({
    muebles: [
      {
        id: 'mueble-1',
        nombre: 'Silla',
        categoria: 'Sillas',
        imagenes: ['https://img.test/despues.jpg'],
        imagen_antes: null,
        ...mueble
      }
    ],
    categorias: [{ id: 20, nombre: 'Sillas', codigo: 'SIL', categoria_padre_id: 1 }]
  });
  mock.method(supabase, 'from', fake.from);
  subidas = [];
  mock.method(supabase.storage, 'from', () => ({
    upload: async (nombre) => {
      subidas.push(nombre);
      return { data: { path: nombre }, error: null };
    },
    getPublicUrl: (nombre) => ({
      data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/imagenes/${nombre}` }
    })
  }));
};
const guardado = () => fake.tablas.muebles.find((m) => m.id === 'mueble-1');
const editar = () =>
  request(app).put('/api/muebles/mueble-1').set('Authorization', `Bearer ${tokenAdmin}`);

beforeEach(() => mock.method(console, 'error', () => {}));
afterEach(() => mock.restoreAll());

describe('PUT /api/muebles/:id — foto de antes de restaurar', () => {
  test('se sube sin miniatura y se guarda en imagen_antes; las fotos de la pieza no cambian', async () => {
    instalar();
    const res = await editar()
      .field('imagenes_existentes', '["https://img.test/despues.jpg"]')
      .attach('imagen_antes', await imagen(), 'antes.png');

    assert.equal(res.status, 200);
    assert.match(guardado().imagen_antes, /\/imagenes\/muebles\/[a-z0-9-]+\.webp$/);
    assert.deepEqual(guardado().imagenes, ['https://img.test/despues.jpg']);
    assert.equal(subidas.length, 1);
    assert.doesNotMatch(subidas[0], /-thumb/);
  });

  test('con fotos nuevas y foto de antes a la vez, cada una va a su sitio', async () => {
    instalar();
    const res = await editar()
      .field('imagenes_existentes', '["https://img.test/despues.jpg"]')
      .attach('imagenes', await imagen(), 'nueva.png')
      .attach('imagen_antes', await imagen(), 'antes.png');

    assert.equal(res.status, 200);
    assert.equal(guardado().imagenes.length, 2);
    assert.match(guardado().imagenes[1], /-full\.webp$/);
    assert.ok(guardado().imagen_antes);
    assert.ok(!guardado().imagenes.includes(guardado().imagen_antes));
  });

  test('quitar_imagen_antes=true la deja en null', async () => {
    instalar({ imagen_antes: 'https://img.test/antes.jpg' });
    const res = await editar().field('quitar_imagen_antes', 'true');
    assert.equal(res.status, 200);
    assert.equal(guardado().imagen_antes, null);
  });

  test('sin foto de antes ni quitar_imagen_antes, la que había se queda', async () => {
    instalar({ imagen_antes: 'https://img.test/antes.jpg' });
    const res = await editar().field('nombre', 'Silla restaurada');
    assert.equal(res.status, 200);
    assert.equal(guardado().imagen_antes, 'https://img.test/antes.jpg');
  });

  test('solo se acepta una foto de antes', async () => {
    instalar();
    const res = await editar()
      .attach('imagen_antes', await imagen(), 'a.png')
      .attach('imagen_antes', await imagen(), 'b.png');
    assert.notEqual(res.status, 200);
    assert.equal(guardado().imagen_antes, null);
  });
});
