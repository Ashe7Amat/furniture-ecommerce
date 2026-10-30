// Desacoplamiento de la marca (tarea 2 del starter kit): el nombre, la web, la dirección y los colores
// de los correos solo se escriben en src/config/brand.config.js. Este test recorre src/ y falla si
// vuelven a aparecer escritos a mano en el código (los comentarios y los tests no cuentan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BRAND } = require('./brand.config');

const SRC = path.join(__dirname, '..');
const archivos = (dir) =>
  fs.readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    return fs.statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
const codigo = archivos(SRC).filter(
  (ruta) =>
    ruta.endsWith('.js') &&
    !ruta.endsWith('.test.js') &&
    !ruta.includes(`${path.sep}__tests__${path.sep}`) &&
    ruta !== path.join(__dirname, 'brand.config.js')
);
const sinComentarios = (texto) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Un patrón por dato de la marca. Los datos vacíos o por rellenar (PENDIENTE, como los deja
// scripts/init-client.js) no se buscan: no son de nadie.
const literal = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patron = (valor, formar = literal, flags = '') =>
  !valor || valor.includes('PENDIENTE') ? null : new RegExp(formar(valor), flags);
const PROHIBIDOS = [
  ['el nombre', patron(BRAND.nombre, (v) => literal(v).replace(/\s+/g, '\\s*'), 'i')],
  ['el nombre del logo', patron(BRAND.nombreLogo, (v) => `['"\`>]${literal(v)}['"\`<]`)],
  ['el dominio', patron(BRAND.dominio)],
  ['la calle', patron(BRAND.contacto.direccion.split(',')[0])],
  ['el prefijo de las referencias', patron(BRAND.prefijoSku, (v) => `['"\`]${literal(v)}['"\`-]`)],
  [
    'los colores de los correos',
    patron(Object.values(BRAND.email.colores).join('|'), (v) => v, 'i')
  ],
  ['el correo de avisos por defecto', patron(BRAND.email.avisosPorDefecto)]
].filter(([, regla]) => regla);

test('recorre el código de src/', () => {
  assert.ok(codigo.length > 50);
});

for (const [que, regla] of PROHIBIDOS) {
  test(`ningún archivo de src/ escribe a mano ${que}`, () => {
    const culpables = codigo
      .filter((ruta) => regla.test(sinComentarios(fs.readFileSync(ruta, 'utf8'))))
      .map((ruta) => path.relative(SRC, ruta));
    assert.deepEqual(culpables, []);
  });
}
