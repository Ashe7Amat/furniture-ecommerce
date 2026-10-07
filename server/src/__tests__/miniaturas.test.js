// H61: las fotos de muebles se suben con una miniatura de 400 px al lado (<base>-thumb.webp), para las
// tarjetas del catálogo, y la foto grande pasa a llamarse <base>-full.webp. Como en upload.test.js,
// sharp es la de verdad y solo se sustituye Supabase Storage.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const sharp = require('sharp');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { uploadToSupabase, ANCHO_MINIATURA } = require('../utils/upload');

// Una foto de verdad de la web (1600 x 1200, la del hero), para medir lo que pesa su miniatura.
const FOTO_REAL = path.resolve(__dirname, '../../../client/public/img/hero-almacen.webp');

const imagen = (width, height) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } })
    .png()
    .toBuffer();
const archivo = (buffer) => ({ buffer, originalname: 'foto.png', mimetype: 'image/png' });

// Storage simulado: guarda lo que se sube, en orden. `fallaSi(nombre)` hace fallar esa subida.
let subidas;
const simularStorage = ({ fallaSi = () => false } = {}) => {
  subidas = [];
  mock.method(supabase.storage, 'from', (bucket) => {
    assert.equal(bucket, 'imagenes');
    return {
      upload: async (nombre, buffer, opciones) => {
        if (fallaSi(nombre)) return { data: null, error: { message: `no se pudo: ${nombre}` } };
        subidas.push({ nombre, buffer, opciones });
        return { data: { path: nombre }, error: null };
      },
      getPublicUrl: (nombre) => ({
        data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/imagenes/${nombre}` }
      })
    };
  });
};

beforeEach(() => {
  mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

describe('uploadToSupabase con miniatura (H61)', () => {
  test('sube primero la miniatura de 400 px y después la grande, con el mismo nombre de base', async () => {
    simularStorage();

    const url = await uploadToSupabase(archivo(await imagen(1000, 750)), 'muebles', {
      conMiniatura: true
    });

    assert.equal(subidas.length, 2);
    const [mini, grande] = subidas;
    assert.match(mini.nombre, /^muebles\/[a-z0-9]+-\d+-thumb\.webp$/);
    assert.equal(grande.nombre, mini.nombre.replace(/-thumb\.webp$/, '-full.webp'));
    assert.equal(mini.opciones.contentType, 'image/webp');
    assert.equal(grande.opciones.contentType, 'image/webp');
    assert.equal((await sharp(mini.buffer).metadata()).width, ANCHO_MINIATURA);
    assert.equal((await sharp(grande.buffer).metadata()).width, 1000, 'la grande no cambia');
    assert.equal(url, `https://x.supabase.co/storage/v1/object/public/imagenes/${grande.nombre}`);
  });

  test('con una foto real de 1600 px, la miniatura pesa menos de 60 KB', async () => {
    simularStorage();
    const foto = await sharp(FOTO_REAL).toBuffer();

    await uploadToSupabase(archivo(foto), 'muebles', { conMiniatura: true });

    const [mini, grande] = subidas;
    assert.equal((await sharp(mini.buffer).metadata()).width, 400);
    assert.ok(mini.buffer.length < 60 * 1024, `miniatura de ${mini.buffer.length} bytes`);
    assert.ok(grande.buffer.length > 4 * mini.buffer.length, 'y mucho menos que la grande');
  });

  test('una foto más estrecha que 400 px no se agranda para la miniatura', async () => {
    simularStorage();
    await uploadToSupabase(archivo(await imagen(300, 200)), 'muebles', { conMiniatura: true });
    assert.equal((await sharp(subidas[0].buffer).metadata()).width, 300);
  });

  test('si la miniatura no se puede subir, la foto se guarda sin ella y con su nombre de siempre', async () => {
    simularStorage({ fallaSi: (nombre) => nombre.endsWith('-thumb.webp') });

    const url = await uploadToSupabase(archivo(await imagen(800, 600)), 'muebles', {
      conMiniatura: true
    });

    assert.equal(subidas.length, 1);
    assert.match(
      subidas[0].nombre,
      /^muebles\/[a-z0-9]+-\d+\.webp$/,
      'sin -full: no hay miniatura'
    );
    assert.match(url, /-\d+\.webp$/);
    assert.ok(
      console.error.mock.calls.some(({ arguments: [texto] }) => /miniatura/.test(texto)),
      'y se avisa en el registro'
    );
  });

  test('si la foto no se puede procesar, se sube el original tal cual y sin miniatura', async () => {
    simularStorage();
    const texto = Buffer.from('no es una imagen', 'utf8');

    await uploadToSupabase(
      { buffer: texto, originalname: 'nota.txt', mimetype: 'text/plain' },
      'muebles',
      { conMiniatura: true }
    );

    assert.equal(subidas.length, 1);
    assert.match(subidas[0].nombre, /\.txt$/);
  });

  test('si falla la subida de la grande, lanza (aunque la miniatura ya se haya subido)', async () => {
    simularStorage({ fallaSi: (nombre) => nombre.endsWith('-full.webp') });

    await assert.rejects(
      uploadToSupabase(archivo(await imagen(800, 600)), 'muebles', { conMiniatura: true }),
      // Lanza el error tal cual lo devuelve Supabase (un objeto con message, no un Error).
      (error) => /^no se pudo: muebles\/.+-full\.webp$/.test(error.message)
    );
    assert.equal(subidas.length, 1, 'la miniatura sí llegó a subirse');
  });

  test('sin conMiniatura (las categorías), una sola subida, como antes', async () => {
    simularStorage();
    await uploadToSupabase(archivo(await imagen(800, 600)), 'categorias');
    assert.equal(subidas.length, 1);
    assert.match(subidas[0].nombre, /^categorias\/[a-z0-9]+-\d+\.webp$/);
  });
});

describe('las fotos que se suben al crear y al editar un mueble llevan miniatura', () => {
  const tokenAdmin = jwt.sign(
    { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
    process.env.JWT_SECRET
  );
  let fake;
  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [{ id: 'mueble-1', nombre: 'Silla', categoria: 'Sillas', imagenes: [] }],
      categorias: [{ id: 20, nombre: 'Sillas', codigo: 'SIL', categoria_padre_id: 1 }]
    });
    mock.method(supabase, 'from', fake.from);
    simularStorage();
  });

  test('PUT /api/muebles/:id: la foto nueva se guarda como -full.webp y su miniatura queda subida', async () => {
    const res = await request(app)
      .put('/api/muebles/mueble-1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('imagenes_existentes', '["https://img.test/vieja.jpg"]')
      .attach('imagenes', await imagen(800, 600), 'foto.png');

    assert.equal(res.status, 200);
    const guardadas = fake.tablas.muebles.find((m) => m.id === 'mueble-1').imagenes;
    assert.equal(guardadas.length, 2);
    assert.equal(guardadas[0], 'https://img.test/vieja.jpg');
    assert.match(guardadas[1], /\/imagenes\/muebles\/[a-z0-9]+-\d+-full\.webp$/);
    assert.deepEqual(
      subidas.map((s) => s.nombre.replace(/^muebles\/[a-z0-9]+-\d+/, '')),
      ['-thumb.webp', '-full.webp']
    );
  });

  test('POST /api/muebles: también', async () => {
    const res = await request(app)
      .post('/api/muebles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('nombre', 'Silla nueva')
      .field('categoria', 'Sillas')
      .attach('imagenes', await imagen(800, 600), 'foto.png');

    assert.equal(res.status, 201);
    const nueva = fake.tablas.muebles.find((m) => m.nombre === 'Silla nueva');
    assert.equal(nueva.imagenes.length, 1);
    assert.match(nueva.imagenes[0], /-full\.webp$/);
    assert.equal(subidas.length, 2);
  });
});
