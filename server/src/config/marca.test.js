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

const PROHIBIDOS = [
  ['el nombre', /Nave\s*5/i],
  ['el dominio', new RegExp(BRAND.dominio.replace('.', '\\.'))],
  ['la calle', new RegExp(BRAND.contacto.direccion.split(',')[0])],
  ['el prefijo de las referencias', new RegExp(`['"\`]${BRAND.prefijoSku}['"\`-]`)],
  ['los colores de los correos', new RegExp(Object.values(BRAND.email.colores).join('|'), 'i')],
  ['el correo de avisos por defecto', new RegExp(BRAND.email.avisosPorDefecto.replace('.', '\\.'))]
];

test('recorre el código de src/', () => {
  assert.ok(codigo.length > 50);
});

for (const [que, patron] of PROHIBIDOS) {
  test(`ningún archivo de src/ escribe a mano ${que}`, () => {
    const culpables = codigo
      .filter((ruta) => patron.test(sinComentarios(fs.readFileSync(ruta, 'utf8'))))
      .map((ruta) => path.relative(SRC, ruta));
    assert.deepEqual(culpables, []);
  });
}
