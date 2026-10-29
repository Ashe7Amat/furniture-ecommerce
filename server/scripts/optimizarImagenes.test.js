const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { generarVariantesWebp, optimizarDirectorioLocal, TAMANOS } = require('./optimizarImagenes');

const FIXTURES_INPUT = path.resolve(__dirname, '__fixtures__/input');
const FIXTURES_OUTPUT = path.resolve(__dirname, '__fixtures__/output');

describe('server/scripts/optimizarImagenes.js', () => {
  before(async () => {
    if (fs.existsSync(FIXTURES_OUTPUT)) {
      fs.rmSync(FIXTURES_OUTPUT, { recursive: true, force: true });
    }
    fs.mkdirSync(FIXTURES_INPUT, { recursive: true });
    fs.mkdirSync(FIXTURES_OUTPUT, { recursive: true });

    // Generar 3 imágenes de prueba sintéticas con sharp (JPEG y PNG)
    const muestras = [
      { nombre: 'aparador.jpg', ancho: 1400, alto: 1000, color: { r: 126, g: 90, b: 66 } },
      { nombre: 'silla-vintage.jpg', ancho: 1200, alto: 800, color: { r: 198, g: 142, b: 90 } },
      { nombre: 'mesa-centro.png', ancho: 900, alto: 600, color: { r: 50, g: 80, b: 110 } }
    ];

    for (const m of muestras) {
      const ruta = path.join(FIXTURES_INPUT, m.nombre);
      const s = sharp({
        create: {
          width: m.ancho,
          height: m.alto,
          channels: 3,
          background: m.color
        }
      });
      if (m.nombre.endsWith('.png')) {
        await s.png().toFile(ruta);
      } else {
        await s.jpeg({ quality: 90 }).toFile(ruta);
      }
    }
  });

  after(() => {
    // Limpieza de directorio de salida de test
    if (fs.existsSync(FIXTURES_OUTPUT)) {
      fs.rmSync(FIXTURES_OUTPUT, { recursive: true, force: true });
    }
  });

  it('generarVariantesWebp produce 3 variantes en WebP con los anchos correctos', async () => {
    const bufferPrueba = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 100, g: 100, b: 100 }
      }
    })
      .jpeg()
      .toBuffer();

    const variantes = await generarVariantesWebp(bufferPrueba, 'pieza-demo');
    assert.equal(variantes.length, 3);

    const [v400, v800, v1200] = variantes;
    assert.equal(v400.sufijo, '-400.webp');
    assert.equal(v400.ancho, 400);
    assert.equal(v800.sufijo, '-800.webp');
    assert.equal(v800.ancho, 800);
    assert.equal(v1200.sufijo, '-1200.webp');
    assert.equal(v1200.ancho, 1200);

    // Verificar formato WebP
    const meta400 = await sharp(v400.buffer).metadata();
    assert.equal(meta400.format, 'webp');
    assert.equal(meta400.width, 400);
  });

  it('optimizarDirectorioLocal procesa las imágenes y genera los archivos esperados', async () => {
    const res = await optimizarDirectorioLocal(FIXTURES_INPUT, FIXTURES_OUTPUT);

    assert.equal(res.procesados, 3);
    assert.equal(res.omitidos, 0);
    assert(res.bytesOriginales > 0);
    assert(res.bytesNuevos > 0);

    // Verificar que los 3 tamaños existen para cada imagen
    for (const base of ['aparador', 'silla-vintage', 'mesa-centro']) {
      for (const t of TAMANOS) {
        const archivoEsperado = path.join(FIXTURES_OUTPUT, `${base}${t.sufijo}`);
        assert(fs.existsSync(archivoEsperado), `Debe existir ${archivoEsperado}`);
      }
    }
  });

  it('optimizarDirectorioLocal es idempotente y omite archivos ya procesados', async () => {
    const resSegundaVez = await optimizarDirectorioLocal(FIXTURES_INPUT, FIXTURES_OUTPUT);
    assert.equal(resSegundaVez.procesados, 0);
    assert.equal(resSegundaVez.omitidos, 3);
  });
});
