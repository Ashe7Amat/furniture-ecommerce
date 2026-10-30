// Tests de server/migrations/00_esquema_base.sql (starter kit, 30 oct 2026): el esquema para la base de
// datos de un cliente nuevo. No lo ejecutan (eso se comprobó en un PostgreSQL local): vigilan que cada
// tabla que usa la API esté en el archivo, con RLS, y que no se cuelen datos de Nave 5.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..');
const sql = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '00_esquema_base.sql'),
  'utf8'
);
const sinComentarios = sql.replace(/--.*$/gm, '');

const archivos = (dir) =>
  fs.readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (fs.statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta);
    return ruta.endsWith('.js') ? [ruta] : [];
  });

// Las tablas que lee o escribe la API: supabase.from('tabla'), sin contar storage.from('bucket').
const tablasDeLaApi = [
  ...new Set(
    archivos(SRC).flatMap((ruta) =>
      [...fs.readFileSync(ruta, 'utf8').matchAll(/(?<!storage)\.from\('([a-z_]+)'\)/g)].map(
        (m) => m[1]
      )
    )
  )
].sort();
const tablasDelEsquema = [...sinComentarios.matchAll(/CREATE TABLE public\.([a-z_]+)/g)]
  .map((m) => m[1])
  .sort();

describe('00_esquema_base.sql', () => {
  test('crea todas las tablas que usa la API, y ninguna más', () => {
    assert.ok(tablasDeLaApi.length >= 11, `tablas encontradas en src/: ${tablasDeLaApi}`);
    assert.deepEqual(tablasDelEsquema, tablasDeLaApi);
  });

  test('activa RLS en cada tabla', () => {
    for (const tabla of tablasDelEsquema) {
      assert.match(
        sinComentarios,
        new RegExp(`ALTER TABLE public\\.${tabla} ENABLE ROW LEVEL SECURITY;`),
        tabla
      );
    }
  });

  test('la web anónima solo lee el catálogo y la portada', () => {
    const politicas = [...sinComentarios.matchAll(/CREATE POLICY[\s\S]*?;/g)].map((m) => m[0]);
    const tablas = politicas.map((p) => p.match(/ON public\.([a-z_]+)/)[1]).sort();
    assert.deepEqual(tablas, ['ajustes_home', 'categorias', 'muebles']);
    for (const politica of politicas) assert.match(politica, /FOR SELECT/);
  });

  test('lleva el bucket de las fotos y la restricción que impide los solapes de reservas', () => {
    const bucket = sinComentarios.match(/storage\.buckets[\s\S]*?VALUES\s*\('([a-z]+)'/);
    assert.ok(bucket, 'inserta el bucket en storage.buckets');
    const usado = fs.readFileSync(path.join(SRC, 'utils', 'upload.js'), 'utf8');
    assert.ok(usado.includes(`storage.from('${bucket[1]}')`), 'el mismo que usa upload.js');
    assert.match(sinComentarios, /CONSTRAINT reservas_sin_solape EXCLUDE USING gist/);
  });

  test('va en una transacción y sin datos de Nave 5', () => {
    assert.match(sinComentarios, /^\s*BEGIN;/m);
    assert.match(sinComentarios, /^COMMIT;\s*$/m);
    assert.doesNotMatch(sinComentarios, /nave ?5|gdrmpxcpucmaxvtpljge|Espejos|reservas_borrador/i);
  });
});
