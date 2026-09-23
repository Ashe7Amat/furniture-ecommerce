// Tests de utils/upload.js (tarea 5). No mockea sharp: usa la librería real, con un buffer de
// imagen genuino generado por la propia sharp (sharp({ create: ... })) para el caso feliz, y un
// buffer que no es una imagen en absoluto para el caso de fallo -- así se ejercita el try/catch
// real de optimizarImagen sin fabricar bytes de imagen a mano (frágil) ni mockear una librería de
// proceso local (no es un servicio externo como Stripe/Resend/Supabase, así que no hace falta
// mockearla). Lo único que se mockea es supabase.storage (Supabase Storage sí es un servicio
// externo real).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
require('./helpers/testEnv');

const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');

// Imagen real de 2x2 píxeles, generada por sharp en memoria (no viene de ningún archivo del
// repo ni de la red) -- vale como "archivo subido" de verdad para optimizarImagen.
let bufferImagenValida;

describe('uploadToSupabase', () => {
  beforeEach(async () => {
    bufferImagenValida = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 200, g: 100, b: 50 } }
    }).png().toBuffer();
    mock.method(console, 'error', () => {});
    mock.method(console, 'log', () => {});
  });
  afterEach(() => mock.restoreAll());

  test('sin archivo, devuelve null sin tocar Supabase Storage', async () => {
    const fromSpy = mock.method(supabase.storage, 'from', () => {
      throw new Error('no debería llamarse a storage.from sin archivo');
    });

    const resultado = await uploadToSupabase(null);

    assert.equal(resultado, null);
    assert.equal(fromSpy.mock.callCount(), 0);
  });

  test('camino feliz: optimiza a WebP, sube al bucket "imagenes" y devuelve la URL pública', async () => {
    const upload = mock.fn(async () => ({ data: { path: 'x' }, error: null }));
    const getPublicUrl = mock.fn((fileName) => ({
      data: { publicUrl: `https://ejemplo.supabase.co/storage/v1/object/public/imagenes/${fileName}` }
    }));
    const fromSpy = mock.method(supabase.storage, 'from', (bucket) => {
      assert.equal(bucket, 'imagenes');
      return { upload, getPublicUrl };
    });

    const url = await uploadToSupabase(
      { buffer: bufferImagenValida, originalname: 'foto.png', mimetype: 'image/png' },
      'muebles'
    );

    assert.equal(fromSpy.mock.callCount(), 2); // una vez para upload, otra para getPublicUrl
    const [fileName, buffer, opciones] = upload.mock.calls[0].arguments;
    assert.match(fileName, /^muebles\/.+\.webp$/);
    assert.equal(opciones.contentType, 'image/webp');
    assert.equal(opciones.upsert, true);
    assert.ok(Buffer.isBuffer(buffer));
    assert.notDeepEqual(buffer, bufferImagenValida); // se reprocesó, no es el buffer original tal cual
    assert.match(url, /^https:\/\/ejemplo\.supabase\.co\/.+\.webp$/);
  });

  test('sin carpeta indicada, usa "uploads" por defecto', async () => {
    const upload = mock.fn(async () => ({ data: {}, error: null }));
    mock.method(supabase.storage, 'from', () => ({
      upload,
      getPublicUrl: (fileName) => ({ data: { publicUrl: `https://x/${fileName}` } })
    }));

    await uploadToSupabase({ buffer: bufferImagenValida, originalname: 'foto.png', mimetype: 'image/png' });

    const [fileName] = upload.mock.calls[0].arguments;
    assert.match(fileName, /^uploads\//);
  });

  test('si sharp no puede procesar el archivo, sube el original tal cual (mismo mimetype/extensión), sin romper', async () => {
    const upload = mock.fn(async () => ({ data: {}, error: null }));
    mock.method(supabase.storage, 'from', () => ({
      upload,
      getPublicUrl: (fileName) => ({ data: { publicUrl: `https://x/${fileName}` } })
    }));
    const bufferInvalido = Buffer.from('esto no es una imagen, es texto plano', 'utf8');

    const url = await uploadToSupabase(
      { buffer: bufferInvalido, originalname: 'documento.pdf', mimetype: 'application/pdf' },
      'muebles'
    );

    const [fileName, buffer, opciones] = upload.mock.calls[0].arguments;
    assert.match(fileName, /\.pdf$/); // conserva la extensión original, no ".webp"
    assert.equal(opciones.contentType, 'application/pdf');
    assert.deepEqual(buffer, bufferInvalido); // sube el buffer original sin tocar
    assert.match(url, /\.pdf$/);
  });

  test('si Supabase Storage devuelve un error al subir, uploadToSupabase lanza y no pide la URL pública', async () => {
    const getPublicUrl = mock.fn();
    mock.method(supabase.storage, 'from', () => ({
      upload: async () => ({ data: null, error: { message: 'bucket lleno' } }),
      getPublicUrl
    }));

    await assert.rejects(
      uploadToSupabase({ buffer: bufferImagenValida, originalname: 'foto.png', mimetype: 'image/png' }, 'muebles'),
      (error) => error.message === 'bucket lleno'
    );
    assert.equal(getPublicUrl.mock.callCount(), 0);
  });
});
