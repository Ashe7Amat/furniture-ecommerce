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
  leerPaqueteForge,
  fusionarCapa,
  VARIABLES_FORGE,
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
  assert.equal(web.logo, 'texto', 'sin dibujo propio, el logo de la cabecera es el nombre');
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
  assert.equal(claro['--color-accent-rgb'], '201, 162, 39', 'los tonos en rgb salen del acento');
  assert.equal(claro['--color-hero-light'], claro['--color-bg'], 'el hero usa el fondo nuevo');
  const valores = [
    ':root {',
    ':root:not([data-theme="light"])',
    ':root[data-theme="dark"]'
  ].flatMap((selector) => Object.values(variables(bloque(css, selector))));
  for (const tonoNave5 of [
    '#221B16',
    '#F5F2EC',
    '#3E322A',
    '#B38A70',
    '#1A1510',
    '179, 138, 112',
    '62, 50, 42'
  ]) {
    assert.ok(
      !valores.some((v) => v.toUpperCase().includes(tonoNave5)),
      `queda ${tonoNave5} en tokens.css`
    );
  }
  assert.deepEqual(
    variables(bloque(css, ':root[data-theme="dark"]')),
    variables(bloque(css, ':root:not([data-theme="light"])')),
    'los dos modos oscuros llevan los mismos valores'
  );
});

test('por consola: con --si escribe en --dir y no toca nada sin --si si no hay terminal', () => {
  const dir = copiaDelRepo();
  // Un fondo que no da ninguna paleta: así la prueba vale también si el repo ya tiene esta marca (por
  // ejemplo, tras ejecutar init:client con los datos de la guía).
  const tokens = path.join(dir, ARCHIVOS.tokens);
  fs.writeFileSync(
    tokens,
    fs.readFileSync(tokens, 'utf8').replace(/--color-bg:\s*[^;]+;/, '--color-bg: #000001;')
  );
  const antes = fs.readFileSync(tokens, 'utf8');
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

// ─── --desde: el paquete de marca de ForgeStudio ─────────────────────────────────────────────────
// fixtures/casa-olivo es un paquete exportado de verdad con ForgeStudio (solo se ha cambiado el nombre
// largo): forge-brand.json y forge-tokens.css.

const PAQUETE = path.join(__dirname, 'fixtures', 'casa-olivo');
const JSON_FORGE = JSON.parse(fs.readFileSync(path.join(PAQUETE, 'forge-brand.json'), 'utf8'));
const SCRIPT = path.join(__dirname, 'init-client.js');
const TONOS_NAVE5 = [
  '#221B16',
  '#F5F2EC',
  '#3E322A',
  '#B38A70',
  '#1A1510',
  '179, 138, 112',
  '62, 50, 42'
];

const ejecutar = (argumentos, opciones = {}) =>
  execFileSync(process.execPath, [SCRIPT, ...argumentos], {
    stdio: 'pipe',
    ...opciones
  }).toString();

// Un paquete en una carpeta temporal: el JSON con `cambios` y, si se pide, el forge-tokens.css real
const paqueteCon = (cambios = {}, { conTokens = true } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-'));
  const json = { ...JSON_FORGE, ...cambios };
  fs.writeFileSync(path.join(dir, 'forge-brand.json'), JSON.stringify(json, null, 2));
  if (conTokens)
    fs.copyFileSync(path.join(PAQUETE, 'forge-tokens.css'), path.join(dir, 'forge-tokens.css'));
  return path.join(dir, 'forge-brand.json');
};
const leerEn = (dir, ruta) => fs.readFileSync(path.join(dir, ruta), 'utf8');

test('--desde: escribe los datos del JSON en las dos marcas sin preguntar nada', () => {
  const dir = copiaDelRepo();
  ejecutar([`--desde=${path.join(PAQUETE, 'forge-brand.json')}`, `--dir=${dir}`, '--si']);

  const web = cargarMarcaCliente(leerEn(dir, ARCHIVOS.marcaCliente));
  assert.equal(web.nombre, 'Casa Olivo Valencia');
  assert.equal(web.nombreCorto, 'Casa Olivo');
  assert.equal(web.eslogan, 'Muebles de madera para vivir despacio');
  assert.equal(web.prefijoSku, 'CO');
  assert.equal(web.contacto.email, 'hola@casaolivo.com');
  assert.equal(web.contacto.ciudad, 'Valencia');
  assert.equal(web.web, 'https://casaolivo.com');
  assert.equal(web.dominio, 'casaolivo.com');
  assert.equal(web.redes.instagramUsuario, 'casaolivo');
  assert.equal(web.redes.instagram, 'https://www.instagram.com/casaolivo');
  assert.match(web.contacto.cif, /PENDIENTE/, 'el paquete no trae NIF');
  assert.equal(web.logo, 'texto');

  const api = cargarMarcaServidor(leerEn(dir, ARCHIVOS.marcaServidor));
  assert.equal(api.nombre, 'Casa Olivo Valencia');
  assert.equal(api.nombreLogo, 'CASA OLIVO');
  assert.equal(api.prefijoSku, 'CO');
  assert.equal(api.email.avisosPorDefecto, 'hola@casaolivo.com');
  // Los correos llevan los colores finales de la web, los del paquete
  assert.equal(api.email.colores.claro, '#F5F1E8');
  assert.equal(api.email.colores.texto, '#1A1A1A');
  assert.equal(api.email.colores.acento, '#7A8B5A');
  assert.equal(api.email.colores.superficie, '#FFFFFF');

  const anterior = /Nave ?5|nave5|Barcelona|Plom|08038|amatashenafi|gdrmpxcpucmaxvtpljge/i;
  for (const ruta of [ARCHIVOS.marcaCliente, ARCHIVOS.marcaServidor]) {
    const sinComentarios = leerEn(dir, ruta)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(sinComentarios, anterior, ruta);
  }
});

test('--desde: fusiona forge-tokens.css en tokens.css sin tocar lo que no es de la marca', () => {
  const dir = copiaDelRepo();
  const original = leerEn(dir, ARCHIVOS.tokens);
  ejecutar([`--desde=${path.join(PAQUETE, 'forge-brand.json')}`, `--dir=${dir}`, '--si']);
  const css = leerEn(dir, ARCHIVOS.tokens);
  const claro = variables(bloque(css, ':root {'));
  const antes = variables(bloque(original, ':root {'));

  // Las variables del paquete, tal cual (los hex en mayúsculas, como el resto del archivo)
  assert.equal(claro['--color-bg'], '#F5F1E8');
  assert.equal(claro['--color-primary'], '#2D3A2A');
  assert.equal(claro['--color-accent'], '#7A8B5A');
  assert.equal(claro['--color-accent-text'], '#64714A');
  assert.equal(claro['--color-text'], '#1A1A1A');
  assert.equal(claro['--color-border'], '#1A1A1A');
  assert.equal(claro['--color-on-dark'], '#FFFFFF');
  assert.equal(claro['--color-primary-rgb'], '45, 58, 42');
  assert.equal(
    claro['--color-accent-text-rgb'],
    '100, 113, 74',
    'sigue al acento como texto del paquete'
  );
  assert.equal(claro['--radius-md'], '0px');
  assert.equal(claro['--shadow-md'], 'none');
  assert.equal(claro['--font-display'], "'Playfair Display', Georgia, serif");
  assert.equal(claro['--font-body'], "'Inter', system-ui, sans-serif");

  // Los alias siguen apuntando a las variables nuevas (no se escriben en hex)
  for (const [alias, destino] of [
    ['--bg-color', 'var(--color-bg)'],
    ['--card-bg', 'var(--color-surface)'],
    ['--surface-alt', 'var(--color-surface-alt)'],
    ['--primary-color', 'var(--color-primary)'],
    ['--text-color', 'var(--color-text)']
  ])
    assert.equal(claro[alias], destino, alias);

  // Lo que no es de la marca, intacto
  for (const fija of [
    '--color-success',
    '--color-danger',
    '--color-badge-blue',
    '--color-gray-500',
    '--space-md',
    '--radius-pill',
    '--shadow-sm',
    '--shadow-lg',
    '--font-mono'
  ])
    assert.equal(claro[fija], antes[fija], fija);

  // Las variables de la marca que el paquete no trae salen del primario y el acento: nada de Nave 5
  const todos = [':root {', ':root:not([data-theme="light"])', ':root[data-theme="dark"]'].flatMap(
    (selector) => Object.values(variables(bloque(css, selector)))
  );
  for (const tono of TONOS_NAVE5)
    assert.ok(!todos.some((v) => v.toUpperCase().includes(tono)), `queda ${tono} en tokens.css`);
  assert.equal(claro['--color-hero-light'], '#F5F1E8', 'el hero usa el fondo del paquete');

  // Los dos modos oscuros: la paleta oscura del paquete, solo en las variables que ya tenían
  const oscuro = variables(bloque(css, ':root[data-theme="dark"]'));
  assert.equal(oscuro['--color-bg'], '#141312');
  assert.equal(oscuro['--color-accent'], '#E63946');
  assert.equal(oscuro['--color-success'], '#93B48E', 'los estados en oscuro no se tocan');
  assert.equal(oscuro['--radius-md'], undefined, 'no se añaden variables a los bloques oscuros');
  assert.equal(oscuro['--color-primary-rgb'], undefined);
  assert.deepEqual(oscuro, variables(bloque(css, ':root:not([data-theme="light"])')));
  // Las variables del paquete en claro son todas las de VARIABLES_FORGE
  for (const nombre of VARIABLES_FORGE) assert.ok(claro[nombre], nombre);
});

test('--desde: sin forge-tokens.css usa los colores y las fuentes del JSON', () => {
  const dir = copiaDelRepo();
  const original = variables(bloque(leerEn(dir, ARCHIVOS.tokens), ':root {'));
  const salida = ejecutar([
    `--desde=${paqueteCon({}, { conTokens: false })}`,
    `--dir=${dir}`,
    '--si'
  ]);
  assert.match(salida, /No hay forge-tokens\.css/);
  const claro = variables(bloque(leerEn(dir, ARCHIVOS.tokens), ':root {'));
  assert.equal(claro['--color-primary'], '#2D3A2A');
  assert.equal(claro['--color-accent'], '#7A8B5A');
  assert.equal(claro['--color-bg'], '#F5F1E8');
  assert.equal(claro['--color-text'], '#1A1A1A');
  assert.ok(contraste(claro['--color-secondary'], claro['--color-bg']) >= 4.5, 'secundario AA');
  assert.ok(contraste(claro['--color-accent-text'], claro['--color-bg']) >= 4.5, 'acento AA');
  // La familia del JSON delante, con la pila de reserva que ya tenía el starter
  assert.equal(
    claro['--font-display'],
    original['--font-display'].replace("'Fraunces'", "'Playfair Display'")
  );
  assert.equal(claro['--font-body'], original['--font-body'], 'Inter ya era la del starter');
  assert.equal(claro['--radius-md'], original['--radius-md'], 'sin paquete CSS no hay radios');
});

test('--desde: los flags ganan al JSON y el NIF y la descripción llegan si el paquete los trae', () => {
  const dir = copiaDelRepo();
  const json = paqueteCon({ nif: 'b12345678', descripcion: 'Muebles de olivo hechos a mano.' });
  ejecutar([
    `--desde=${json}`,
    `--dir=${dir}`,
    '--email=pedidos@casaolivo.es',
    '--ciudad=Xàtiva',
    '--si'
  ]);
  const web = cargarMarcaCliente(leerEn(dir, ARCHIVOS.marcaCliente));
  assert.equal(web.contacto.email, 'pedidos@casaolivo.es');
  assert.equal(web.contacto.ciudad, 'Xàtiva');
  assert.equal(web.contacto.cif, 'B12345678');
  assert.equal(web.descripcion, 'Muebles de olivo hechos a mano.');
  assert.equal(web.nombre, 'Casa Olivo Valencia', 'lo que no va en flags sigue saliendo del JSON');

  // Los colores salen del paquete: --primario y --acento no se mezclan con --desde
  const antes = leerEn(dir, ARCHIVOS.tokens);
  assert.throws(
    () => ejecutar([`--desde=${json}`, `--dir=${dir}`, '--primario=#123456', '--si']),
    /no se combinan con --desde/
  );
  assert.equal(leerEn(dir, ARCHIVOS.tokens), antes);
});

test('--desde: sin correo en el paquete pide --email, y sin --si ni terminal no escribe', () => {
  const dir = copiaDelRepo();
  const antes = leerEn(dir, ARCHIVOS.tokens);
  const sinCorreo = paqueteCon({ contacto: { ...JSON_FORGE.contacto, email: '' } });
  assert.throws(
    () => ejecutar([`--desde=${sinCorreo}`, `--dir=${dir}`, '--si']),
    (error) => /no trae el correo/.test(error.stderr) && /--email=/.test(error.stderr)
  );
  assert.throws(() =>
    ejecutar([`--desde=${path.join(PAQUETE, 'forge-brand.json')}`, `--dir=${dir}`])
  );
  assert.equal(leerEn(dir, ARCHIVOS.tokens), antes);
  ejecutar([`--desde=${sinCorreo}`, `--dir=${dir}`, '--email=hola@casaolivo.com', '--si']);
  assert.notEqual(leerEn(dir, ARCHIVOS.tokens), antes);
});

test('--desde: rechaza un paquete mal formado y dice qué campos fallan', () => {
  const noJson = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-')), 'forge-brand.json');
  fs.writeFileSync(noJson, '{ esto no es JSON');
  assert.throws(() => leerPaqueteForge(noJson), /no es un JSON válido/);
  assert.throws(() => leerPaqueteForge('/no/existe/forge-brand.json'), /no encuentro/);

  const { nombre: _nombre, ...sinNombre } = JSON_FORGE;
  const roto = paqueteCon({
    ...sinNombre,
    version: '2.0',
    nombre: undefined,
    prefijoSku: 'C0',
    contacto: { email: 'hola', web: 'ftp://x', instagram: 'no vale' },
    colores: { primario: 'verde', acento: '#12345' },
    fuentes: { display: '<script>', body: 'Inter' }
  });
  assert.throws(
    () => leerPaqueteForge(roto),
    (error) =>
      [
        'version: "2.0"',
        'nombre: falta',
        'prefijoSku:',
        'contacto.email:',
        'contacto.web:',
        'contacto.instagram:',
        'colores.primario:',
        'colores.acento:',
        'fuentes.display:'
      ].every((campo) => error.message.includes(campo)) && !error.message.includes('fuentes.body')
  );
  assert.throws(() => leerPaqueteForge(paqueteCon({ colores: undefined })), /colores: falta/);
  assert.throws(
    () => leerPaqueteForge(paqueteCon({ nombreCorto: 3 })),
    /nombreCorto: tiene que ser texto/
  );
});

test('--desde: normaliza la web, el Instagram y el prefijo del paquete', () => {
  const { datos } = leerPaqueteForge(
    paqueteCon({
      prefijoSku: 'co',
      contacto: {
        email: 'a@b.es',
        ciudad: '',
        web: 'www.casaolivo.com/',
        instagram: 'https://www.instagram.com/casa.olivo/'
      }
    })
  );
  assert.equal(datos.web, 'https://www.casaolivo.com');
  assert.equal(datos.instagramUsuario, 'casa.olivo');
  assert.equal(datos.prefijo, 'CO');
});

test('--desde: forge-tokens.css solo escribe las variables de la marca, con valores seguros', () => {
  const css = fs
    .readFileSync(path.join(PAQUETE, 'forge-tokens.css'), 'utf8')
    .replace('--color-bg: #f5f1e8;', '--color-bg: #f5f1e8;\n  --color-badge-red: #000000;')
    .replace('--color-surface: #ffffff;', '--color-surface: url(https://x.y/z.png);');
  const dir = path.dirname(paqueteCon());
  fs.writeFileSync(path.join(dir, 'forge-tokens.css'), css);
  const paquete = leerPaqueteForge(path.join(dir, 'forge-brand.json'));
  assert.equal(paquete.capa.claro['--color-badge-red'], undefined);
  assert.equal(paquete.capa.claro['--color-surface'], undefined);
  assert.equal(paquete.capa.claro['--bg-color'], undefined, 'los alias no se escriben');
  assert.match(paquete.avisos.join('\n'), /--color-badge-red/);
  assert.match(paquete.avisos.join('\n'), /--color-surface/);

  // Un alias del paquete nunca pisa la variable que lo contiene (--surface-alt dentro de --color-surface-alt)
  const tokens =
    ':root {\n  --color-surface-alt: #111111;\n  --surface-alt: var(--color-surface-alt);\n}\n' +
    '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n  }\n}\n' +
    ':root[data-theme="dark"] {\n}\n';
  const { css: fusionado, escritas } = fusionarCapa(tokens, {
    claro: { '--color-surface-alt': '#222222', '--surface-alt': '#333333' }
  });
  assert.match(fusionado, /--color-surface-alt: #222222;/);
  assert.match(fusionado, /--surface-alt: var\(--color-surface-alt\);/);
  assert.deepEqual(escritas.claro, ['--color-surface-alt']);
});

test('--desde: sin los dos guiones, npm deja la ruta en npm_config_desde y también vale', () => {
  const dir = copiaDelRepo();
  const salida = ejecutar([`--dir=${dir}`, '--si'], {
    env: { ...process.env, npm_config_desde: path.join(PAQUETE, 'forge-brand.json') }
  });
  assert.match(salida, /sin los dos guiones/);
  assert.match(leerEn(dir, ARCHIVOS.marcaCliente), /prefijoSku: 'CO'/);
});
