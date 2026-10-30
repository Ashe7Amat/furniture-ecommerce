// @vitest-environment node
// Desacoplamiento de la marca (tarea 2 del starter kit): el nombre, la web, la dirección y el correo
// de la tienda solo se escriben en theme/brand.config.js. Este test recorre src/ y falla si vuelven a
// aparecer escritos a mano en el código (los comentarios y los tests no cuentan).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND } from './brand.config';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const archivos = (dir) => readdirSync(dir).flatMap((nombre) => {
  const ruta = join(dir, nombre);
  return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
});
const codigo = archivos(SRC).filter((ruta) =>
  /\.(js|jsx)$/.test(ruta) && !/\.test\.(js|jsx)$/.test(ruta) && !ruta.endsWith('setupTests.js') &&
  !ruta.endsWith('adminTestUtils.jsx') && !ruta.endsWith(join('theme', 'brand.config.js')));
// Quita los comentarios: /* ... */, {/* ... */} y // hasta el final de la línea (sin tocar "https://").
const sinComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Un patrón por dato de la marca. Los datos vacíos o por rellenar (PENDIENTE, como los deja
// scripts/init-client.js) no se buscan: no son de nadie.
const literal = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patron = (valor, formar = literal, flags = '') =>
  !valor || valor.includes('PENDIENTE') ? null : new RegExp(formar(valor), flags);
const PROHIBIDOS = [
  ['el nombre', patron(BRAND.nombreCorto, (v) => `\\b${literal(v).replace(/\s+/g, '\\s*')}\\b`, 'i')],
  // La ciudad como palabra, sin contar la zona horaria (Europe/Madrid es de las fechas, no de la marca)
  ['la ciudad', patron(BRAND.contacto.ciudad, (v) => `(?<!Europe/)\\b${literal(v)}\\b`)],
  ['la calle', patron(BRAND.contacto.calle.split(',')[0])],
  ['el código postal', patron(BRAND.contacto.codigoPostal, (v) => `\\b${literal(v)}\\b`)],
  ['el dominio', patron(BRAND.dominio)],
  ['el usuario de Instagram', patron(BRAND.redes.instagramUsuario)],
  ['el identificador interno', patron(BRAND.idInterno, (v) => `['"\`]${literal(v)}`)],
  ['el prefijo de las referencias', patron(BRAND.prefijoSku, (v) => `\\b${literal(v)}-`)],
  ['el NIF', patron(BRAND.contacto.cif)],
  // Con mayúscula: el eslogan como rótulo. En minúscula es prosa de Sobre nosotros («un almacén de ideas»).
  ['el eslogan', patron(BRAND.eslogan)],
].filter(([, regla]) => regla);

describe('la marca solo vive en brand.config.js', () => {
  it('recorre el código de src/', () => {
    expect(codigo.length).toBeGreaterThan(100);
  });

  it.each(PROHIBIDOS)('ningún archivo de src/ escribe a mano %s', (_, regla) => {
    const culpables = codigo
      .filter((ruta) => regla.test(sinComentarios(readFileSync(ruta, 'utf8'))))
      .map((ruta) => relative(SRC, ruta));
    expect(culpables).toEqual([]);
  });

  it('index.html solo lleva marcadores %BRAND_...%, que rellena vite.config.js', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).not.toMatch(new RegExp(literal(BRAND.nombreCorto), 'i'));
    expect(html).not.toContain(BRAND.dominio);
    const marcadores = new Set(html.match(/%BRAND_[A-Z_]+%/g));
    expect([...marcadores].sort()).toEqual(['%BRAND_COLOR_TEMA%', '%BRAND_DESCRIPCION%', '%BRAND_NOMBRE%', '%BRAND_WEB%']);
    expect(html.match(/#[0-9a-fA-F]{3,8}\b/g), 'colores de index.html: de tokens.css').toBeNull();
    const config = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
    for (const marcador of marcadores) expect(config).toContain(`${marcador.slice(1, -1)}:`);
  });
});
