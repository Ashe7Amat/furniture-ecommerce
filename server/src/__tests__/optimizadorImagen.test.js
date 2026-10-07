// H62: el optimizador de fotos (utils/upload.js) limita el LADO MAYOR a 1600 px, no solo el ancho, y
// nunca agranda. Usa sharp de verdad (fotos generadas en memoria); solo se sustituye Supabase Storage.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
require('./helpers/testEnv');

const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');

let subidas;
beforeEach(() => {
  subidas = [];
  mock.method(console, 'error', () => {});
  mock.method(supabase.storage, 'from', () => ({
    upload: async (nombre, buffer) => {
      subidas.push({ nombre, buffer });
      return { data: { path: nombre }, error: null };
    },
    getPublicUrl: (nombre) => ({ data: { publicUrl: `https://x.test/${nombre}` } })
  }));
});
afterEach(() => mock.restoreAll());

// Sube una foto de ancho x alto y devuelve las medidas de la que se guarda (la grande).
const medidasGuardadas = async (width, height) => {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } }
  })
    .png()
    .toBuffer();
  await uploadToSupabase({ buffer, originalname: 'foto.png', mimetype: 'image/png' }, 'muebles');
  const { width: ancho, height: alto, format } = await sharp(subidas.at(-1).buffer).metadata();
  return { ancho, alto, format };
};

describe('optimizarImagen: el lado mayor no pasa de 1600 px (H62)', () => {
  test('horizontal 2000 x 1000 -> 1600 x 800', async () => {
    assert.deepEqual(await medidasGuardadas(2000, 1000), {
      ancho: 1600,
      alto: 800,
      format: 'webp'
    });
  });

  test('vertical 2000 x 3000 -> 1067 x 1600', async () => {
    assert.deepEqual(await medidasGuardadas(2000, 3000), {
      ancho: 1067,
      alto: 1600,
      format: 'webp'
    });
  });

  test('vertical 1440 x 1920 (lo que deja el cliente) -> 1200 x 1600', async () => {
    assert.deepEqual(await medidasGuardadas(1440, 1920), {
      ancho: 1200,
      alto: 1600,
      format: 'webp'
    });
  });

  test('cuadrada 2000 x 2000 -> 1600 x 1600', async () => {
    assert.deepEqual(await medidasGuardadas(2000, 2000), {
      ancho: 1600,
      alto: 1600,
      format: 'webp'
    });
  });

  test('pequeña 800 x 600 -> se queda igual, no se agranda', async () => {
    assert.deepEqual(await medidasGuardadas(800, 600), { ancho: 800, alto: 600, format: 'webp' });
  });

  test('un lado justo en 1600 no cambia: 1600 x 1200 y 1200 x 1600', async () => {
    assert.deepEqual(await medidasGuardadas(1600, 1200), {
      ancho: 1600,
      alto: 1200,
      format: 'webp'
    });
    assert.deepEqual(await medidasGuardadas(1200, 1600), {
      ancho: 1200,
      alto: 1600,
      format: 'webp'
    });
  });

  test('la miniatura de 400 px sale de la foto ya reducida, también en vertical', async () => {
    const buffer = await sharp({
      create: { width: 2000, height: 3000, channels: 3, background: { r: 10, g: 80, b: 120 } }
    })
      .png()
      .toBuffer();
    await uploadToSupabase({ buffer, originalname: 'foto.png', mimetype: 'image/png' }, 'muebles', {
      conMiniatura: true
    });
    const [mini, grande] = subidas;
    const m = await sharp(mini.buffer).metadata();
    const g = await sharp(grande.buffer).metadata();
    assert.deepEqual([m.width, m.height], [400, 600]);
    assert.deepEqual([g.width, g.height], [1067, 1600]);
  });
});
