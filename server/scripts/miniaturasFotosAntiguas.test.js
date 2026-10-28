// scripts/miniaturasFotosAntiguas.js: las fotos de muebles anteriores a H61 (sin -full.webp) pasan al
// formato de hoy (-full.webp + -thumb.webp) y se cambian sus URLs en muebles.imagenes. sharp es la de
// verdad; Supabase (tabla y Storage) es un doble en memoria.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
require('../src/__tests__/helpers/testEnv');
const { procesar, rutaEnBucket, esAntigua, rutasNuevas } = require('./miniaturasFotosAntiguas');

const SB = 'https://ejemplo.supabase.co';
const pub = (ruta) => `${SB}/storage/v1/object/public/imagenes/${ruta}`;

const jpg = (width, height) =>
  sharp({ create: { width, height, channels: 3, background: { r: 140, g: 100, b: 70 } } }).jpeg({ quality: 95 }).toBuffer();

const crearSupabase = async ({ muebles, archivos, fallaDescarga = () => false, fallaUpdate = false }) => {
  const subidas = [];
  const updates = [];
  const bucket = { ...archivos };
  return {
    subidas,
    updates,
    bucket,
    from: (tabla) => {
      assert.equal(tabla, 'muebles');
      return {
        select: async () => ({ data: muebles, error: null }),
        update: (valores) => ({
          eq: async (col, id) => {
            if (fallaUpdate) return { error: { message: 'sin conexión' } };
            updates.push({ id, ...valores });
            return { error: null };
          }
        })
      };
    },
    storage: {
      from: (b) => {
        assert.equal(b, 'imagenes');
        return {
          getPublicUrl: (ruta) => ({ data: { publicUrl: pub(ruta) } }),
          download: async (ruta) => {
            if (fallaDescarga(ruta) || !bucket[ruta]) return { data: null, error: { message: 'no existe' } };
            const buf = bucket[ruta];
            return { data: { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) }, error: null };
          },
          upload: async (ruta, buffer, opciones) => {
            subidas.push({ ruta, buffer, opciones });
            bucket[ruta] = buffer;
            return { error: null };
          }
        };
      }
    }
  };
};

describe('miniaturasFotosAntiguas: qué fotos toca', () => {
  it('rutaEnBucket solo reconoce URLs públicas del bucket "imagenes" de este Supabase', () => {
    assert.equal(rutaEnBucket(pub('muebles/a.jpg'), SB), 'muebles/a.jpg');
    assert.equal(rutaEnBucket(pub('muebles/a.jpg') + '?v=2', SB), 'muebles/a.jpg');
    assert.equal(rutaEnBucket('https://otro.com/muebles/a.jpg', SB), null);
    assert.equal(rutaEnBucket('/img/sin-imagen.svg', SB), null);
    assert.equal(rutaEnBucket(null, SB), null);
  });

  it('esAntigua: fotos de muebles que no terminan en -full.webp', () => {
    assert.equal(esAntigua('muebles/001-baul-1.jpg'), true);
    assert.equal(esAntigua('muebles/xnxp4yz0y6-1791303308599.webp'), true);
    assert.equal(esAntigua('muebles/abc-123-full.webp'), false);
    assert.equal(esAntigua('home/portada.webp'), false);
    assert.equal(esAntigua(null), false);
  });

  it('rutasNuevas: mismo nombre, con -full.webp y -thumb.webp', () => {
    assert.deepEqual(rutasNuevas('muebles/001-baul-1.jpg'), {
      grande: 'muebles/001-baul-1-full.webp',
      miniatura: 'muebles/001-baul-1-thumb.webp'
    });
  });
});

describe('miniaturasFotosAntiguas: procesar', () => {
  const datos = async () => ({
    muebles: [
      { id: 1, referencia: 'NAV-BAU-001', imagenes: [pub('muebles/001-baul-1.jpg'), pub('muebles/nueva-1-full.webp')] },
      { id: 2, referencia: 'NAV-SIL-001', imagenes: [pub('muebles/nueva-2-full.webp')] },
      // La misma foto antigua en dos muebles: se procesa una vez.
      { id: 3, referencia: 'NAV-OBJ-001', imagenes: [pub('muebles/001-baul-1.jpg'), 'https://otro.com/foto.jpg'] },
      { id: 4, referencia: 'NAV-OBJ-002', imagenes: null }
    ],
    archivos: { 'muebles/001-baul-1.jpg': await jpg(2400, 1800) }
  });

  it('en simulación no sube ni guarda nada, pero dice qué cambiaría', async () => {
    const sb = await crearSupabase(await datos());
    const r = await procesar(sb, { supabaseUrl: SB });
    assert.equal(sb.subidas.length, 0);
    assert.equal(sb.updates.length, 0);
    assert.equal(r.fotos, 1);
    assert.deepEqual(r.muebles.map((m) => m.id), [1, 3]);
    assert.deepEqual(r.muebles[0].despues, [pub('muebles/001-baul-1-full.webp'), pub('muebles/nueva-1-full.webp')]);
  });

  it('con aplicar: sube miniatura (400 px) y grande (1600 px) en WebP, y cambia solo las URLs antiguas', async () => {
    const sb = await crearSupabase(await datos());
    const r = await procesar(sb, { supabaseUrl: SB, aplicar: true });

    assert.deepEqual(sb.subidas.map((s) => s.ruta), ['muebles/001-baul-1-thumb.webp', 'muebles/001-baul-1-full.webp']);
    for (const s of sb.subidas) assert.equal(s.opciones.contentType, 'image/webp');
    const mini = await sharp(sb.subidas[0].buffer).metadata();
    const grande = await sharp(sb.subidas[1].buffer).metadata();
    assert.equal(mini.format, 'webp');
    assert.equal(mini.width, 400);
    assert.equal(grande.width, 1600);
    assert.equal(grande.height, 1200);

    assert.deepEqual(sb.updates, [
      { id: 1, imagenes: [pub('muebles/001-baul-1-full.webp'), pub('muebles/nueva-1-full.webp')] },
      { id: 3, imagenes: [pub('muebles/001-baul-1-full.webp'), 'https://otro.com/foto.jpg'] }
    ]);
    // No se borra nada: la foto antigua sigue en el bucket, y el informe guarda la lista de antes.
    assert.ok(sb.bucket['muebles/001-baul-1.jpg']);
    assert.deepEqual(r.muebles[0].antes, [pub('muebles/001-baul-1.jpg'), pub('muebles/nueva-1-full.webp')]);
    assert.equal(r.errores.length, 0);
    assert.equal(r.muebles.every((m) => m.guardado), true);
  });

  it('se puede repetir: la segunda vez no queda nada por hacer', async () => {
    const d = await datos();
    const sb = await crearSupabase(d);
    await procesar(sb, { supabaseUrl: SB, aplicar: true });
    for (const u of sb.updates) d.muebles.find((m) => m.id === u.id).imagenes = u.imagenes;
    const r = await procesar(sb, { supabaseUrl: SB, aplicar: true });
    assert.equal(r.fotos, 0);
    assert.equal(r.muebles.length, 0);
  });

  it('si una foto no se puede descargar, esa URL se queda como estaba y se apunta el error', async () => {
    const d = await datos();
    d.muebles[0].imagenes.push(pub('muebles/rota.jpg'));
    const sb = await crearSupabase(d);
    const r = await procesar(sb, { supabaseUrl: SB, aplicar: true });
    assert.deepEqual(r.errores.map((e) => e.ruta), ['muebles/rota.jpg']);
    assert.deepEqual(sb.updates[0].imagenes, [
      pub('muebles/001-baul-1-full.webp'),
      pub('muebles/nueva-1-full.webp'),
      pub('muebles/rota.jpg')
    ]);
    assert.equal(r.muebles[0].parcial, true);
  });

  it('si no se puede guardar el mueble, se apunta el error y guardado queda en false', async () => {
    const sb = await crearSupabase({ ...(await datos()), fallaUpdate: true });
    const r = await procesar(sb, { supabaseUrl: SB, aplicar: true });
    assert.equal(r.errores.length, 2);
    assert.equal(r.muebles.every((m) => m.guardado === false), true);
  });
});
