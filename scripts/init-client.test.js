// Tests de scripts/init-client.js: genera la marca de un cliente inventado sobre una copia de los tres
// archivos y comprueba lo que escribe. Se ejecutan con `npm test` en la raíz.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  generar,
  generarPaleta,
  contraste,
  completar,
  ponerCampo,
  ARCHIVOS
} = require('./init-client');

const RAIZ = path.join(__dirname, '..');
const CLIENTE = {
  nombre: 'Studio Vintage Madrid',
  prefijo: 'SVM',
  email: 'hola@studiovintage.es',
  primario: '#1E3A5F',
  acento: '#C9A227',
  ciudad: 'Madrid'
};

const copiaDelRepo = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'init-client-'));
  for (const ruta of Object.values(ARCHIVOS)) {
    fs.mkdirSync(path.join(dir, path.dirname(ruta)), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, ruta), path.join(dir, ruta));
  }
  return dir;
};

// Carga un brand.config.js generado como módulo (el del cliente es ESM: se quita el export)
const cargarMarcaCliente = (codigo) => {
  const cuerpo = codigo.replace(/^export default .*$/m, '').replace(/^export const /gm, 'const ');
  return new Function(`${cuerpo}; return BRAND;`)();
};
const cargarMarcaServidor = (codigo) => {
  const modulo = { exports: {} };
  new Function('module', 'exports', codigo)(modulo, modulo.exports);
  return modulo.exports.BRAND;
};
const variables = (bloque) =>
  Object.fromEntries(
    [...bloque.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  );
const bloque = (css, selector) => {
  const inicio = css.indexOf(selector);
  return css.slice(inicio, css.indexOf('}', inicio));
};

test('la paleta generada pasa AA: texto secundario y de acento sobre el fondo, en claro y en oscuro', () => {
  for (const [primario, acento] of [
    ['#1E3A5F', '#C9A227'],
    ['#3E322A', '#B38A70'],
    ['#7A1F5C', undefined],
    ['#FFD400', '#00A3A3']
  ]) {
    const { claro, oscuro } = generarPaleta(primario, acento);
    for (const p of [claro, oscuro]) {
      assert.ok(
        contraste(p['--color-secondary'], p['--color-bg']) >= 4.5,
        `${primario}: secundario`
      );
      assert.ok(
        contraste(p['--color-accent-text'], p['--color-bg']) >= 4.5,
        `${primario}: acento como texto`
      );
    }
    assert.ok(contraste(claro['--color-primary'], claro['--color-bg']) >= 1, primario);
  }
});

test('completa lo que no se pregunta a partir del nombre', () => {
  const d = completar({ nombre: 'Casa Ñandú Vintage', email: 'a@b.es', primario: '#123456' });
  assert.equal(d.prefijo, 'CNV');
  assert.equal(d.idInterno, 'casananduvintage');
  assert.equal(d.web, 'https://www.casananduvintage.com');
  assert.equal(d.dominio, 'casananduvintage.com');
  assert.equal(d.hashtag, '#CasaNanduVintage');
  assert.equal(d.ciudad, 'PENDIENTE');
});

test('ponerCampo cambia solo el campo pedido, también si su valor va en la línea siguiente', () => {
  const codigo =
    "const A = {\n  nombre: 'x',\n  nombreCorto: 'y',\n  datos: {\n    nombre: 'z',\n    logo:\n      'largo'\n  }\n};";
  assert.match(
    ponerCampo(codigo, 'nombre', "O'Neill"),
    /nombre: 'O\\'Neill',\n {2}nombreCorto: 'y'/
  );
  assert.match(ponerCampo(codigo, 'nombre', 'w', 'datos:'), /nombre: 'x'[\s\S]*nombre: 'w'/);
  assert.match(ponerCampo(codigo, 'logo', 'corto', 'datos:'), /logo:\n {6}'corto'/);
  assert.throws(() => ponerCampo(codigo, 'inexistente', 'v'), /No encuentro el campo/);
});

test('genera las dos marcas y la paleta sin dejar datos de la tienda anterior', () => {
  const { archivos } = generar(copiaDelRepo(), CLIENTE);

  const web = cargarMarcaCliente(archivos[ARCHIVOS.marcaCliente]);
  assert.equal(web.nombre, 'Studio Vintage Madrid');
  assert.equal(web.prefijoSku, 'SVM');
  assert.equal(web.prefijoSKU, 'SVM');
  assert.equal(web.contacto.email, 'hola@studiovintage.es');
  assert.equal(web.contacto.ciudad, 'Madrid');
  assert.equal(web.web, 'https://www.studiovintagemadrid.com');
  assert.match(web.contacto.cif, /PENDIENTE/);
  assert.match(web.contacto.razonSocial, /PENDIENTE/);

  const api = cargarMarcaServidor(archivos[ARCHIVOS.marcaServidor]);
  assert.equal(api.nombre, 'Studio Vintage Madrid');
  assert.equal(api.prefijoSku, 'SVM');
  assert.equal(api.email.avisosPorDefecto, 'hola@studiovintage.es');
  assert.equal(api.email.colores.texto, '#1E3A5F');
  assert.equal(api.email.logo, '');

  const anterior = /Nave ?5|nave5|Barcelona|Plom|08038|amatashenafi|gdrmpxcpucmaxvtpljge/i;
  for (const ruta of [ARCHIVOS.marcaCliente, ARCHIVOS.marcaServidor]) {
    const sinComentarios = archivos[ruta].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(sinComentarios, anterior, ruta);
  }

  const css = archivos[ARCHIVOS.tokens];
  const claro = variables(bloque(css, ':root {'));
  assert.equal(claro['--color-primary'], '#1E3A5F');
  assert.equal(claro['--color-accent'], '#C9A227');
  assert.equal(claro['--primary-color'], 'var(--color-primary)', 'los alias siguen igual');
  assert.equal(claro['--color-success'], '#4D6E4A', 'los colores de estado no se tocan');
  assert.deepEqual(
    variables(bloque(css, ':root[data-theme="dark"]')),
    variables(bloque(css, ':root:not([data-theme="light"])')),
    'los dos modos oscuros llevan los mismos valores'
  );
});

test('por consola: con --si escribe en --dir y no toca nada sin --si si no hay terminal', () => {
  const dir = copiaDelRepo();
  const antes = fs.readFileSync(path.join(dir, ARCHIVOS.tokens), 'utf8');
  const argumentos = Object.entries(CLIENTE).map(([clave, valor]) => `--${clave}=${valor}`);
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [path.join(__dirname, 'init-client.js'), `--dir=${dir}`, ...argumentos],
      { stdio: 'pipe' }
    )
  );
  assert.equal(fs.readFileSync(path.join(dir, ARCHIVOS.tokens), 'utf8'), antes);
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'init-client.js'), `--dir=${dir}`, ...argumentos, '--si'],
    { stdio: 'pipe' }
  );
  assert.notEqual(fs.readFileSync(path.join(dir, ARCHIVOS.tokens), 'utf8'), antes);
  assert.match(fs.readFileSync(path.join(dir, ARCHIVOS.marcaCliente), 'utf8'), /prefijoSku: 'SVM'/);
});

test('rechaza datos mal escritos', () => {
  const dir = copiaDelRepo();
  for (const malo of ['--prefijo=S1', '--email=hola', '--primario=azul']) {
    const argumentos = { ...CLIENTE };
    const [clave, valor] = malo.slice(2).split('=');
    argumentos[clave] = valor;
    const lista = Object.entries(argumentos).map(([c, v]) => `--${c}=${v}`);
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [path.join(__dirname, 'init-client.js'), `--dir=${dir}`, ...lista, '--si'],
          { stdio: 'pipe' }
        ),
      malo
    );
  }
});
