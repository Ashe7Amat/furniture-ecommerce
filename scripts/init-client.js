// Inicializa la marca de un cliente nuevo (starter kit, tarea 4): pregunta el nombre, el prefijo de las
// referencias, el correo y los colores, y reescribe los tres archivos de la marca:
//   - client/src/theme/brand.config.js   (la web)
//   - server/src/config/brand.config.js  (la API: correos, sitemap, referencias)
//   - client/src/theme/tokens.css        (la paleta, en claro y en los dos modos oscuros)
// Solo cambia los valores: los comentarios, el orden y los campos que no pregunta se quedan como están.
// Lo que no sabe (dirección, NIF, razón social, Instagram, logo de los correos) lo deja como "PENDIENTE", para que
// no se cuele ningún dato de la tienda anterior. Ver docs/NUEVO_CLIENTE.md.
//
// Uso:
//   npm run init:client                          (pregunta por consola)
//   node scripts/init-client.js --nombre="Studio Vintage" --prefijo=STV --email=hola@studio.es \
//     --primario=#1E3A5F [--acento=#C9A227] [--eslogan="Muebles con historia"] [--ciudad=Madrid] \
//     [--web=https://www.studio.es] --si
//   --dir=<carpeta>   trabaja sobre otra copia del repositorio (por defecto, la de este script)
//   --si              no pide confirmación antes de escribir
//
// Sin dependencias: solo módulos de Node (22 o más, como client/ y server/).

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { execFileSync } = require('node:child_process');

// Consola con preguntas que devuelven promesas (readline/promises aún es experimental en Node 22.0).
// Guarda las líneas que llegan antes de la pregunta (al pegar varias respuestas de golpe).
const crearConsola = () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lineas = [];
  let esperando = null;
  rl.on('line', (linea) =>
    esperando ? (esperando(linea), (esperando = null)) : lineas.push(linea)
  );
  return {
    question: (texto) => {
      process.stdout.write(texto);
      if (lineas.length) return Promise.resolve(lineas.shift());
      return new Promise((resolver) => (esperando = resolver));
    },
    close: () => rl.close()
  };
};

// ─── Colores ─────────────────────────────────────────────────────────────────────────────────────

const esHex = (valor) => /^#[0-9a-fA-F]{6}$/.test(valor);
const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const aHex = (rgb) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase();
// Mezcla en sRGB: `peso` es la parte de `b` (0 = todo a, 1 = todo b)
const mezclar = (a, b, peso) => {
  const [ra, rb] = [aRgb(a), aRgb(b)];
  return aHex(ra.map((c, i) => c + (rb[i] - c) * peso));
};
const BLANCO = '#FFFFFF';
const NEGRO = '#000000';
const luminancia = (hex) => {
  const [r, g, b] = aRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [la, lb] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
};
// Oscurece (o aclara) `color` poco a poco hasta tener `minimo` de contraste con `fondo` (AA: 4,5)
const conContraste = (color, fondo, minimo = 4.5) => {
  const hacia = luminancia(fondo) > 0.5 ? NEGRO : BLANCO;
  for (let paso = 0; paso <= 1.0001; paso += 0.02) {
    const candidato = mezclar(color, hacia, paso);
    if (contraste(candidato, fondo) >= minimo) return candidato;
  }
  return hacia;
};

// La paleta entera a partir del color primario y el de acento. Los colores de estado (éxito, error,
// aviso) no se tocan: ya pasan AA en claro y en oscuro y no son de la marca.
const generarPaleta = (primario, acento = mezclar(primario, BLANCO, 0.35)) => {
  const fondo = mezclar(primario, BLANCO, 0.96);
  const claro = {
    '--color-bg': fondo,
    '--color-primary': primario,
    '--color-secondary': conContraste(mezclar(primario, BLANCO, 0.3), fondo),
    '--color-text': primario,
    '--color-accent': acento,
    '--color-accent-hover': mezclar(acento, NEGRO, 0.12),
    '--color-accent-text': conContraste(acento, fondo),
    '--color-surface': mezclar(primario, BLANCO, 0.985),
    '--color-surface-alt': mezclar(primario, BLANCO, 0.9),
    '--color-border': mezclar(primario, BLANCO, 0.84),
    '--color-etiqueta-bg': mezclar(acento, BLANCO, 0.65),
    '--color-etiqueta-text': primario
  };
  claro['--color-text-muted'] = claro['--color-secondary'];

  let fondoOscuro = mezclar(primario, NEGRO, 0.45);
  while (luminancia(fondoOscuro) > 0.02) fondoOscuro = mezclar(fondoOscuro, NEGRO, 0.1);
  const textoOscuro = mezclar(primario, BLANCO, 0.92);
  const acentoOscuro = conContraste(mezclar(acento, BLANCO, 0.3), fondoOscuro);
  const oscuro = {
    '--color-bg': fondoOscuro,
    '--color-primary': textoOscuro,
    '--color-secondary': conContraste(mezclar(primario, BLANCO, 0.7), fondoOscuro),
    '--color-text': textoOscuro,
    '--color-accent': acentoOscuro,
    '--color-accent-hover': mezclar(acentoOscuro, BLANCO, 0.25),
    '--color-accent-text': acentoOscuro,
    '--color-surface': mezclar(fondoOscuro, BLANCO, 0.04),
    '--color-surface-alt': mezclar(fondoOscuro, BLANCO, 0.1),
    '--color-border': mezclar(fondoOscuro, BLANCO, 0.16),
    '--color-etiqueta-bg': mezclar(acento, NEGRO, 0.55),
    '--color-etiqueta-text': textoOscuro
  };
  oscuro['--color-text-muted'] = oscuro['--color-secondary'];

  const cta = mezclar(primario, NEGRO, 0.55);
  const rgb = (hex) => aRgb(hex).join(', ');
  // Los colores fijos (iguales en claro y en oscuro) que salen de la marca. Los neutros (blanco, negro,
  // grises, insignias y estados del panel) se quedan como están.
  const fijos = {
    '--color-cta': cta,
    '--color-cta-hover': mezclar(primario, NEGRO, 0.25),
    '--color-cta-rgb': rgb(cta),
    '--color-on-dark': fondo,
    '--color-overlay': `rgba(${rgb(mezclar(primario, NEGRO, 0.75))}, 0.5)`,
    '--color-overlay-warm': `rgba(${rgb(fondoOscuro)}, 0.55)`,
    '--color-focus-glow': `rgba(${rgb(acento)}, 0.2)`,
    '--color-primary-rgb': rgb(primario),
    '--color-accent-rgb': rgb(acento),
    '--color-accent-text-rgb': rgb(claro['--color-accent-text']),
    '--color-focus-contact-rgb': rgb(acento),
    '--color-focus-booking-rgb': rgb(acento),
    '--color-hero-bg': fondoOscuro,
    '--color-hero-light': fondo,
    '--color-photo-btn-rgb': rgb(mezclar(primario, NEGRO, 0.6)),
    '--color-overlay-contact': `rgba(${rgb(mezclar(primario, NEGRO, 0.7))}, 0.75)`,
    '--color-cta-hover-contact': mezclar(primario, NEGRO, 0.25),
    '--color-admin-bar-bg': `rgba(${rgb(mezclar(primario, NEGRO, 0.65))}, 0.9)`,
    '--color-admin-bar-text': fondo
  };
  // Los correos no entienden variables CSS: sus colores van en hex en la marca del servidor
  const correo = {
    oscuro: fondoOscuro,
    claro: fondo,
    secundario: claro['--color-secondary'],
    borde: claro['--color-border'],
    texto: primario,
    textoSuave: mezclar(primario, BLANCO, 0.4),
    acento,
    superficie: claro['--color-surface'],
    blanco: BLANCO
  };
  return { claro, oscuro, fijos, correo };
};

// ─── Reescritura de los archivos ─────────────────────────────────────────────────────────────────

const comillas = (valor) => `'${String(valor).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// Cambia el valor (una cadena entre comillas simples) de `clave` en un .js. Admite el valor en la línea
// siguiente, como lo deja Prettier en las líneas largas. Con `dentro`, solo busca a partir de ese texto.
const ponerCampo = (codigo, clave, valor, dentro) => {
  const inicio = dentro ? codigo.indexOf(dentro) : 0;
  if (inicio < 0) throw new Error(`No encuentro "${dentro}"`);
  const patron = new RegExp(`(^|[\\s{,])(${clave}:\\s*)'(?:[^'\\\\]|\\\\.)*'`, 'm');
  const resto = codigo.slice(inicio);
  if (!patron.test(resto)) throw new Error(`No encuentro el campo "${clave}"`);
  return (
    codigo.slice(0, inicio) +
    resto.replace(patron, (_, antes, claveYEspacio) => `${antes}${claveYEspacio}${comillas(valor)}`)
  );
};

// Cambia el valor de una variable CSS dentro de un bloque (el texto entre `selector {` y su `}`)
const bloques = (css) => {
  const buscar = (selector, desde = 0) => {
    const inicio = css.indexOf(selector, desde);
    if (inicio < 0) throw new Error(`tokens.css: no encuentro el bloque ${selector}`);
    const abre = css.indexOf('{', inicio);
    return [abre, css.indexOf('}', abre)];
  };
  return {
    claro: buscar(':root {'),
    oscuroSistema: buscar(':root:not([data-theme="light"])'),
    oscuroBoton: buscar(':root[data-theme="dark"]')
  };
};
const ponerVariables = (css, rango, valores) => {
  let [inicio, fin] = rango;
  let bloque = css.slice(inicio, fin);
  for (const [nombre, valor] of Object.entries(valores)) {
    const patron = new RegExp(`(${nombre}:\\s*)[^;]+;`);
    if (!patron.test(bloque)) throw new Error(`tokens.css: falta ${nombre}`);
    bloque = bloque.replace(patron, `$1${valor};`);
  }
  return css.slice(0, inicio) + bloque + css.slice(fin);
};

const generarTokens = (css, paleta) => {
  // De atrás adelante, para que los cambios de longitud no muevan los bloques que quedan
  let resultado = ponerVariables(css, bloques(css).oscuroBoton, paleta.oscuro);
  resultado = ponerVariables(resultado, bloques(resultado).oscuroSistema, paleta.oscuro);
  return ponerVariables(resultado, bloques(resultado).claro, { ...paleta.claro, ...paleta.fijos });
};

const PENDIENTE = 'PENDIENTE';

const generarMarcaCliente = (codigo, d) => {
  const campos = [
    ['nombre', d.nombre],
    ['nombreCorto', d.nombreCorto],
    ['eslogan', d.eslogan],
    ['tipoNegocio', d.tipoNegocio],
    ['hashtag', d.hashtag],
    ['descripcion', d.descripcion],
    ['logo', 'texto'],
    ['prefijoSku', d.prefijo],
    ['idInterno', d.idInterno],
    ['email', d.email, 'contacto:'],
    ['telefono', '', 'contacto:'],
    ['calle', `${PENDIENTE} (calle y número)`, 'contacto:'],
    ['direccion', `${PENDIENTE} (dirección completa)`, 'contacto:'],
    ['ciudad', d.ciudad, 'contacto:'],
    ['codigoPostal', PENDIENTE, 'contacto:'],
    ['horario', '', 'contacto:'],
    ['razonSocial', `${PENDIENTE} (razón social)`, 'contacto:'],
    ['cif', `${PENDIENTE} (NIF)`, 'contacto:'],
    ['web', d.web],
    ['dominio', d.dominio],
    ['instagram', `https://www.instagram.com/${PENDIENTE}`, 'redes:'],
    ['instagramUsuario', PENDIENTE, 'redes:']
  ];
  return campos.reduce(
    (texto, [clave, valor, dentro]) => ponerCampo(texto, clave, valor, dentro),
    codigo
  );
};

const generarMarcaServidor = (codigo, d, correo) => {
  const campos = [
    ['nombre', d.nombre],
    ['nombreLogo', d.nombreCorto.toUpperCase()],
    ['eslogan', d.eslogan],
    ['prefijoSku', d.prefijo],
    ['idInterno', d.idInterno],
    ['web', d.web],
    ['dominio', d.dominio],
    ['direccion', `${PENDIENTE} (dirección completa)`, 'contacto:'],
    ['codigoPostal', PENDIENTE, 'contacto:'],
    ['ciudad', d.ciudad, 'contacto:'],
    ['remitentePorDefecto', `${d.nombre} <onboarding@resend.dev>`, 'email:'],
    ['avisosPorDefecto', d.email, 'email:'],
    ['logo', '', 'email:'],
    ['logo2x', '', 'email:'],
    ...Object.entries(correo).map(([clave, valor]) => [clave, valor, 'colores:'])
  ];
  return campos.reduce(
    (texto, [clave, valor, dentro]) => ponerCampo(texto, clave, valor, dentro),
    codigo
  );
};

// ─── Datos del cliente ───────────────────────────────────────────────────────────────────────────

const sinAcentos = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (texto) =>
  sinAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const iniciales = (texto) =>
  sinAcentos(texto)
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(2, 'X');

const VALIDAR = {
  nombre: (v) => (v.trim().length >= 2 ? null : 'Escribe el nombre de la marca.'),
  nombreCorto: (v) => (v.trim().length >= 1 ? null : 'Escribe un nombre corto.'),
  prefijo: (v) =>
    /^[A-Z]{2,5}$/.test(v) ? null : 'De 2 a 5 letras mayúsculas, sin acentos (p. ej. NAV).',
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'No parece un correo.'),
  primario: (v) => (esHex(v) ? null : 'Un color en hex con 6 cifras, como #3E322A.'),
  acento: (v) => (esHex(v) ? null : 'Un color en hex con 6 cifras, como #B38A70.'),
  eslogan: () => null,
  ciudad: () => null,
  web: (v) =>
    /^https:\/\/[^/\s]+$/.test(v)
      ? null
      : 'La web con https:// y sin barra final, como https://www.tienda.com.'
};

// Completa lo que falte con valores derivados de lo que ya se sabe
const completar = (r) => {
  const d = { ...r };
  d.nombreCorto = d.nombreCorto || d.nombre;
  d.prefijo = (d.prefijo || iniciales(d.nombre)).toUpperCase();
  d.ciudad = d.ciudad || PENDIENTE;
  d.idInterno = slug(d.nombreCorto).replace(/-/g, '') || 'tienda';
  d.web = (d.web || `https://www.${slug(d.nombre).replace(/-/g, '')}.com`).replace(/\/+$/, '');
  d.dominio = d.web.replace(/^https:\/\/(www\.)?/, '');
  d.hashtag = '#' + sinAcentos(d.nombre).replace(/[^A-Za-z0-9]/g, '');
  d.eslogan = d.eslogan || '';
  d.tipoNegocio = d.tipoNegocio || 'tienda de muebles y objetos vintage';
  d.descripcion = `${d.nombre}: ${d.tipoNegocio}${d.ciudad === PENDIENTE ? '' : ` en ${d.ciudad}`}.`;
  return d;
};

const leerArgumentos = (argv) => {
  const args = {};
  for (const arg of argv) {
    const m = arg.match(/^--([a-zA-Z]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  return args;
};

// `rl`: la consola si hay terminal y no se ha pasado --si; si no, solo cuentan los argumentos
const preguntar = async (args, rl) => {
  const respuestas = {};
  const pregunta = async (clave, texto, porDefecto) => {
    let valor = args[clave];
    if (valor === undefined && rl) {
      for (;;) {
        const sugerido = porDefecto ? ` [${porDefecto}]` : '';
        valor = (await rl.question(`${texto}${sugerido}: `)).trim() || porDefecto || '';
        if (clave === 'prefijo') valor = valor.toUpperCase();
        const error = valor === '' && porDefecto === undefined ? null : VALIDAR[clave](valor);
        if (!error) break;
        console.log(`  ${error}`);
      }
    }
    if (valor === undefined || valor === '') return undefined;
    if (clave === 'prefijo') valor = String(valor).toUpperCase();
    const error = VALIDAR[clave](String(valor));
    if (error) throw new Error(`--${clave}: ${error}`);
    return String(valor);
  };
  {
    respuestas.nombre = await pregunta(
      'nombre',
      'Nombre de la marca (p. ej. Studio Vintage Madrid)',
      ''
    );
    if (!respuestas.nombre) throw new Error('Falta el nombre de la marca (--nombre).');
    respuestas.nombreCorto = await pregunta(
      'nombreCorto',
      'Nombre corto (cabecera, logo de los correos)',
      respuestas.nombre
    );
    respuestas.prefijo = await pregunta(
      'prefijo',
      'Prefijo de las referencias de las piezas',
      iniciales(respuestas.nombre)
    );
    respuestas.email = await pregunta('email', 'Correo de contacto', '');
    if (!respuestas.email) throw new Error('Falta el correo de contacto (--email).');
    respuestas.primario = await pregunta(
      'primario',
      'Color primario (texto y botones, en hex)',
      ''
    );
    if (!respuestas.primario) throw new Error('Falta el color primario (--primario=#RRGGBB).');
    respuestas.eslogan = await pregunta('eslogan', 'Eslogan (Enter = sin eslogan)', undefined);
    respuestas.acento = await pregunta(
      'acento',
      'Color de acento (en hex; Enter = derivado del primario)',
      undefined
    );
    respuestas.ciudad = await pregunta('ciudad', 'Ciudad (Enter = PENDIENTE)', undefined);
    respuestas.web = await pregunta('web', 'Web pública (Enter = derivada del nombre)', undefined);
  }
  return respuestas;
};

const confirmar = async (args, rl, texto) => {
  if (args.si) return true;
  if (!rl) throw new Error('Sin consola interactiva: añade --si para escribir sin preguntar.');
  const respuesta = (await rl.question(`${texto} (s/N): `)).trim().toLowerCase();
  return respuesta === 's' || respuesta === 'si' || respuesta === 'sí';
};

// ─── Programa ────────────────────────────────────────────────────────────────────────────────────

const ARCHIVOS = {
  marcaCliente: 'client/src/theme/brand.config.js',
  marcaServidor: 'server/src/config/brand.config.js',
  tokens: 'client/src/theme/tokens.css'
};

const generar = (raiz, respuestas) => {
  const d = completar(respuestas);
  const paleta = generarPaleta(d.primario, d.acento);
  const leer = (ruta) => fs.readFileSync(path.join(raiz, ruta), 'utf8');
  return {
    datos: d,
    paleta,
    archivos: {
      [ARCHIVOS.marcaCliente]: generarMarcaCliente(leer(ARCHIVOS.marcaCliente), d),
      [ARCHIVOS.marcaServidor]: generarMarcaServidor(
        leer(ARCHIVOS.marcaServidor),
        d,
        paleta.correo
      ),
      [ARCHIVOS.tokens]: generarTokens(leer(ARCHIVOS.tokens), paleta)
    }
  };
};

const main = async () => {
  const args = leerArgumentos(process.argv.slice(2));
  const raiz = path.resolve(typeof args.dir === 'string' ? args.dir : path.join(__dirname, '..'));
  const rl = process.stdin.isTTY && !args.si ? crearConsola() : null;
  try {
    await inicializar(args, raiz, rl);
  } finally {
    rl?.close();
  }
};

const inicializar = async (args, raiz, rl) => {
  console.log('Nuevo cliente: marca y paleta (Enter acepta lo que va entre corchetes)\n');
  const { datos, paleta, archivos } = generar(raiz, await preguntar(args, rl));

  console.log(
    `\n${datos.nombre} · referencias ${datos.prefijo}-XXX-000 · ${datos.email} · ${datos.web}`
  );
  console.log(
    `Paleta: primario ${paleta.claro['--color-primary']}, acento ${paleta.claro['--color-accent']}, ` +
      `fondo ${paleta.claro['--color-bg']}, texto secundario ${paleta.claro['--color-secondary']} ` +
      `(contraste ${contraste(paleta.claro['--color-secondary'], paleta.claro['--color-bg']).toFixed(2)}:1), ` +
      `fondo oscuro ${paleta.oscuro['--color-bg']}`
  );
  if (!(await confirmar(args, rl, `\n¿Escribo los 3 archivos en ${raiz}?`))) {
    console.log('No se ha escrito nada.');
    return;
  }
  for (const [ruta, contenido] of Object.entries(archivos)) {
    fs.writeFileSync(path.join(raiz, ruta), contenido);
    console.log(`  escrito ${ruta}`);
  }
  // La API pasa Prettier en el CI: se formatea su archivo si Prettier está instalado
  const prettier = path.join(raiz, 'server/node_modules/.bin/prettier');
  if (fs.existsSync(prettier)) {
    try {
      execFileSync(prettier, ['--write', path.join(raiz, ARCHIVOS.marcaServidor)], {
        cwd: path.join(raiz, 'server'),
        stdio: 'ignore'
      });
    } catch {
      console.log(`  (no he podido pasar Prettier: ejecuta "npm run format" en server/)`);
    }
  }
  console.log(`
Siguientes pasos (docs/NUEVO_CLIENTE.md):
  1. Revisa los cambios con git diff y completa lo marcado como ${PENDIENTE} (dirección, código postal, razón
     social, NIF) en las dos brand.config.js, y el logo de los correos (email.logo) en la del servidor.
  2. La cabecera lleva el nombre en texto (logo: 'texto'). Si el cliente tiene un logo dibujado, pon su SVG
     en client/src/theme/LogoDibujo.jsx y cambia logo a 'dibujo'.
  3. Cambia a mano lo que la marca no cubre: client/public/ (favicon, og-image, manifest.json, robots.txt,
     fotos), client/vercel.json y los textos legales (docs/NUEVO_CLIENTE.md, "Archivos que se cambian a mano").
  4. Comprueba: npm run lint, npm test y npm run build en client/, y npm test en server/. Los tests leen la
     marca de brand.config.js: tienen que pasar en verde.`);
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { generar, generarPaleta, contraste, completar, ponerCampo, ARCHIVOS };
