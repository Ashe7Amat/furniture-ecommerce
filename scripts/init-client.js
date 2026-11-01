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
//   npm run init:client -- --desde=forge-brand.json   (el paquete de marca de ForgeStudio; ojo con los
//                     dos guiones: sin ellos npm se queda el argumento)
//   --dir=<carpeta>   trabaja sobre otra copia del repositorio (por defecto, la de este script)
//   --si              no pide confirmación antes de escribir
//
// Con --desde, los datos salen del JSON y no se preguntan (solo el correo, si viene vacío), y tokens.css
// recibe además las variables de forge-tokens.css, si está en la misma carpeta que el JSON. Los flags que
// se pasen a la vez ganan a los datos del JSON, salvo --primario y --acento, que no se admiten: los
// colores salen del paquete. Ver "Paquete de marca de ForgeStudio", más abajo.
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
// aviso) no se tocan: ya pasan AA en claro y en oscuro y no son de la marca. El fondo claro se deriva del
// primario, salvo que llegue hecho (el de un paquete de ForgeStudio): así el texto secundario y el de
// acento se calculan con 4,5:1 sobre el fondo que de verdad va a tener la web.
const generarPaleta = (
  primario,
  acento = mezclar(primario, BLANCO, 0.35),
  fondo = mezclar(primario, BLANCO, 0.96)
) => {
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
    // El NIF y el Instagram solo llegan con --desde (un paquete de ForgeStudio que los traiga)
    ['cif', d.nif || `${PENDIENTE} (NIF)`, 'contacto:'],
    ['web', d.web],
    ['dominio', d.dominio],
    ['instagram', `https://www.instagram.com/${d.instagramUsuario || PENDIENTE}`, 'redes:'],
    ['instagramUsuario', d.instagramUsuario || PENDIENTE, 'redes:']
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
  d.descripcion =
    d.descripcion ||
    `${d.nombre}: ${d.tipoNegocio}${d.ciudad === PENDIENTE ? '' : ` en ${d.ciudad}`}.`;
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

// ─── Paquete de marca de ForgeStudio (--desde) ───────────────────────────────────────────────────
// ForgeStudio (el editor visual) exporta un ZIP con forge-brand.json (los datos de la marca: nombre,
// eslogan, contacto, prefijo, 4 colores y 2 fuentes) y forge-tokens.css (unas 30 variables: la paleta en
// claro y en los dos modos oscuros, las fuentes, los radios y la sombra). Con --desde=forge-brand.json:
//   1. Los datos salen del JSON en vez de preguntarse.
//   2. tokens.css se genera como siempre, con la paleta derivada del primario y el acento del JSON, para
//      que no quede ningún tono de la tienda anterior en las variables que el paquete no trae (botón
//      oscuro, hero, halos, etiquetas).
//   3. Encima se escriben las variables de forge-tokens.css (si está junto al JSON), que mandan: el
//      diseño hecho en ForgeStudio llega tal cual. Sin forge-tokens.css, solo el texto y las fuentes del
//      JSON. El resto de tokens.css (estados, insignias, grises, espaciado...) no se toca.
//   4. Los colores de los correos (brand.config.js del servidor) se leen del tokens.css final.

// Las variables de forge-tokens.css que se escriben en tokens.css. Los alias clásicos que también trae
// (--bg-color, --card-bg...) no se escriben: en tokens.css ya apuntan a estas con var(), y así siguen el
// modo oscuro.
const VARIABLES_FORGE = [
  '--color-bg',
  '--color-surface',
  '--color-surface-alt',
  '--color-primary',
  '--color-primary-rgb',
  '--color-secondary',
  '--color-accent',
  '--color-accent-rgb',
  '--color-accent-hover',
  '--color-accent-text',
  '--color-border',
  '--color-text',
  '--color-text-muted',
  '--color-on-dark',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-full',
  '--font-display',
  '--font-body',
  '--shadow-md'
];
const ALIAS_FORGE = [
  '--bg-color',
  '--card-bg',
  '--surface-alt',
  '--primary-color',
  '--secondary-color',
  '--accent-color',
  '--border-color',
  '--text-color'
];
// Los tres bloques de tokens.css (y de forge-tokens.css) por su selector
const SELECTORES_CAPA = {
  claro: /:root\s*\{/,
  oscuroBoton: /:root\[data-theme="dark"\]\s*\{/,
  oscuroSistema: /:root:not\(\[data-theme="light"\]\)\s*\{/
};
const VERSION_FORGE = /^1(\.\d+)*$/;
const FAMILIA_FUENTE = /^-?[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/;

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
// "@usuario", "usuario" o la URL del perfil: devuelve el usuario, o null si no lo parece
const usuarioInstagram = (valor) => {
  const m = valor.match(
    /^(?:https?:\/\/(?:www\.)?instagram\.com\/|@)?([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/
  );
  return m ? m[1] : null;
};
// La web como la quiere init:client: con https:// y sin barra final
const normalizarWeb = (valor) => {
  const web = valor.replace(/\/+$/, '');
  return web && !/^[a-z]+:\/\//i.test(web) ? `https://${web}` : web;
};

// Comprueba forge-brand.json (contrato 1.x de ForgeStudio) y devuelve sus datos limpios, o la lista de
// todo lo que falla, con la ruta de cada campo dentro del JSON.
const validarPaqueteForge = (json) => {
  if (!esObjeto(json)) return { errores: ['no es un objeto JSON'], datos: null };
  const errores = [];
  for (const grupo of ['contacto', 'colores', 'fuentes']) {
    if (!esObjeto(json[grupo])) errores.push(`${grupo}: falta (o no es un objeto)`);
  }
  const campo = (ruta, obligatorio = false) => {
    const partes = ruta.split('.');
    const padre = partes.length > 1 ? json[partes[0]] : json;
    if (!esObjeto(padre)) return '';
    const valor = padre[partes[partes.length - 1]];
    if (valor === undefined || valor === null) {
      if (obligatorio) errores.push(`${ruta}: falta`);
      return '';
    }
    if (typeof valor !== 'string') {
      errores.push(`${ruta}: tiene que ser texto`);
      return '';
    }
    return valor.replace(/\s+/g, ' ').trim();
  };
  const regla = (ruta, valor, error) => {
    if (valor !== '' && error) errores.push(`${ruta}: ${error}`);
  };
  const color = (ruta, obligatorio = false) => {
    const valor = campo(ruta, obligatorio).toUpperCase();
    if (obligatorio && valor === '' && !errores.some((e) => e.startsWith(`${ruta}:`)))
      errores.push(`${ruta}: está vacío`);
    regla(ruta, valor, esHex(valor) ? null : 'un color en hex con 6 cifras, como #3E322A');
    return valor;
  };

  const version = campo('version', true);
  regla(
    'version',
    version,
    VERSION_FORGE.test(version)
      ? null
      : `"${version}" no es 1.x, la versión que entiende init:client`
  );
  const nombre = campo('nombre', true);
  if (nombre.length < 2 && !errores.some((e) => e.startsWith('nombre:')))
    errores.push('nombre: tiene que tener al menos 2 letras');
  const datos = {
    version,
    generadoEl: typeof json.generadoEl === 'string' ? json.generadoEl : '',
    nombre,
    nombreCorto: campo('nombreCorto', true),
    eslogan: campo('eslogan'),
    descripcion: campo('descripcion'),
    nif: campo('nif').toUpperCase(),
    prefijo: campo('prefijoSku').toUpperCase(),
    email: campo('contacto.email'),
    ciudad: campo('contacto.ciudad'),
    web: normalizarWeb(campo('contacto.web')),
    instagram: campo('contacto.instagram'),
    primario: color('colores.primario', true),
    acento: color('colores.acento'),
    fondo: color('colores.fondo'),
    texto: color('colores.texto'),
    fuentes: { display: campo('fuentes.display'), body: campo('fuentes.body') }
  };
  regla('prefijoSku', datos.prefijo, VALIDAR.prefijo(datos.prefijo));
  regla('contacto.email', datos.email, VALIDAR.email(datos.email));
  regla('contacto.web', datos.web, VALIDAR.web(datos.web));
  datos.instagramUsuario = datos.instagram ? usuarioInstagram(datos.instagram) : '';
  if (datos.instagramUsuario === null)
    errores.push('contacto.instagram: escribe "@usuario" o la URL del perfil');
  for (const tipo of ['display', 'body']) {
    const familia = datos.fuentes[tipo];
    regla(
      `fuentes.${tipo}`,
      familia,
      FAMILIA_FUENTE.test(familia) ? null : 'el nombre de una familia, como Playfair Display'
    );
  }
  return { errores, datos };
};

// Un valor de forge-tokens.css que se puede escribir en tokens.css, o null. Los colores, en hex de 6
// cifras en mayúsculas como el resto de tokens.css (vite.config.js lee --color-primary en hex).
const valorCapa = (nombre, bruto) => {
  const valor = bruto.trim();
  if (!valor || valor.length > 200 || !/^[\w\s#,.'"()%+-]+$/.test(valor) || /url\(/i.test(valor))
    return null;
  if (nombre.endsWith('-rgb')) {
    const canales = valor.split(',').map((c) => c.trim());
    const validos = canales.length === 3 && canales.every((c) => /^\d{1,3}$/.test(c) && +c <= 255);
    return validos ? canales.join(', ') : null;
  }
  if (nombre.startsWith('--color-')) {
    const corto = valor.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
    const largo = corto
      ? `#${corto
          .slice(1)
          .map((c) => c + c)
          .join('')}`
      : valor;
    return esHex(largo) ? largo.toUpperCase() : null;
  }
  return valor;
};

// Las variables de cada bloque de forge-tokens.css, solo las de VARIABLES_FORGE y con valores válidos
const leerCapaForge = (css, avisos = []) => {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const desconocidas = new Set();
  const invalidas = new Set();
  const capa = {};
  for (const [bloque, selector] of Object.entries(SELECTORES_CAPA)) {
    const encontrado = selector.exec(limpio);
    if (!encontrado) {
      if (bloque === 'claro') throw new Error('forge-tokens.css: no encuentro el bloque :root {');
      continue;
    }
    const abre = encontrado.index + encontrado[0].length;
    const cuerpo = limpio.slice(abre, limpio.indexOf('}', abre));
    const valores = {};
    for (const [, nombreBruto, bruto] of cuerpo.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;{}]*);/g)) {
      const nombre = nombreBruto.toLowerCase();
      if (ALIAS_FORGE.includes(nombre)) continue;
      if (!VARIABLES_FORGE.includes(nombre)) {
        desconocidas.add(nombre);
        continue;
      }
      const valor = valorCapa(nombre, bruto);
      if (valor === null) invalidas.add(`${nombre} (${bruto.trim()})`);
      else valores[nombre] = valor;
    }
    capa[bloque] = valores;
  }
  if (desconocidas.size)
    avisos.push(
      `forge-tokens.css: no se escriben ${[...desconocidas].join(', ')} (no son de la marca)`
    );
  if (invalidas.size)
    avisos.push(`forge-tokens.css: no se escriben por su valor ${[...invalidas].join(', ')}`);
  return capa;
};

// Lee y valida el paquete: forge-brand.json y, si está a su lado, forge-tokens.css
const leerPaqueteForge = (ruta) => {
  const archivo = path.basename(ruta);
  let texto;
  try {
    texto = fs.readFileSync(ruta, 'utf8');
  } catch {
    throw new Error(`--desde: no encuentro ${ruta}`);
  }
  let json;
  try {
    json = JSON.parse(texto.replace(/^﻿/, ''));
  } catch (error) {
    throw new Error(`${archivo} no es un JSON válido (${error.message})`);
  }
  const { errores, datos } = validarPaqueteForge(json);
  if (errores.length) throw new Error(`${archivo} no sirve:\n  - ${errores.join('\n  - ')}`);

  const avisos = [];
  const rutaTokens = path.join(path.dirname(ruta), 'forge-tokens.css');
  const tieneTokens = fs.existsSync(rutaTokens);
  const capa = tieneTokens ? leerCapaForge(fs.readFileSync(rutaTokens, 'utf8'), avisos) : {};
  if (!tieneTokens)
    avisos.push(
      `No hay forge-tokens.css junto a ${archivo}: la paleta sale solo de sus 4 colores y sus fuentes.`
    );

  // Lo que se pregunta por consola. Vacío ('') = viene en el JSON sin valor: no se pregunta y toma el
  // valor por defecto. Sin correo, sí se pregunta (o hace falta --email).
  const args = {
    nombre: datos.nombre,
    nombreCorto: datos.nombreCorto,
    prefijo: datos.prefijo,
    primario: datos.primario,
    acento: datos.acento,
    eslogan: datos.eslogan,
    ciudad: datos.ciudad,
    web: datos.web
  };
  if (datos.email) args.email = datos.email;
  // Lo que no se pregunta nunca: solo llega desde el paquete
  const extra = {
    descripcion: datos.descripcion,
    nif: datos.nif,
    instagramUsuario: datos.instagramUsuario,
    fondo: datos.fondo || undefined,
    texto: datos.texto,
    fuentes: datos.fuentes
  };
  return { ruta, datos, args, extra, capa, rutaTokens: tieneTokens ? rutaTokens : null, avisos };
};

// Pone `familia` delante de la pila de fuentes que ya hay, sin repetirla: 'Playfair Display' sobre
// 'Fraunces', ui-serif, serif → 'Playfair Display', ui-serif, serif
const GENERICAS = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
const pilaDeFuentes = (familia, pilaActual) => {
  const sinComillas = (f) => f.trim().replace(/^['"]|['"]$/g, '');
  const resto = pilaActual
    .split(',')
    .slice(1)
    .map((f) => f.trim())
    .filter((f) => f && sinComillas(f).toLowerCase() !== familia.toLowerCase());
  const primera = GENERICAS.includes(familia.toLowerCase()) ? familia : `'${familia}'`;
  return [primera, ...resto].join(', ');
};

const variablesDelBloque = (css, bloque) => {
  const [inicio, fin] = bloques(css)[bloque];
  return Object.fromEntries(
    [...css.slice(inicio, fin).matchAll(/(?:^|[\s;{])(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim()
    ])
  );
};

// La capa que se escribe sobre tokens.css: el texto y las fuentes del JSON y, encima, forge-tokens.css
const capaFinal = (capa, d, css) => {
  const actuales = variablesDelBloque(css, 'claro');
  const desdeJson = {};
  if (d.texto) desdeJson['--color-text'] = d.texto;
  for (const [tipo, variable] of [
    ['display', '--font-display'],
    ['body', '--font-body']
  ]) {
    const familia = d.fuentes?.[tipo];
    if (familia && actuales[variable])
      desdeJson[variable] = pilaDeFuentes(familia, actuales[variable]);
  }
  return { ...capa, claro: { ...desdeJson, ...(capa.claro || {}) } };
};

// Escribe la capa en los tres bloques de tokens.css. Solo cambia variables que ya están en cada bloque:
// las que no (fuentes, radios o tonos rgb en los modos oscuros, que el starter fija en :root) se
// cuentan como omitidas si su valor no es el mismo que en claro.
const fusionarCapa = (css, capa) => {
  const escritas = { claro: [], oscuroSistema: [], oscuroBoton: [] };
  const omitidas = new Set();
  let resultado = css;
  for (const bloque of ['oscuroBoton', 'oscuroSistema', 'claro']) {
    const [inicio, fin] = bloques(resultado)[bloque];
    let texto = resultado.slice(inicio, fin);
    for (const [nombre, valor] of Object.entries(capa[bloque] || {})) {
      if (!VARIABLES_FORGE.includes(nombre)) continue;
      const patron = new RegExp(`(^|[\\s;{])(${nombre}\\s*:\\s*)[^;]+;`);
      if (!patron.test(texto)) {
        if (capa.claro?.[nombre] !== valor) omitidas.add(nombre);
        continue;
      }
      texto = texto.replace(patron, (_, antes, clave) => `${antes}${clave}${valor};`);
      escritas[bloque].push(nombre);
    }
    resultado = resultado.slice(0, inicio) + texto + resultado.slice(fin);
  }
  return { css: resultado, escritas, omitidas: [...omitidas] };
};

// Los correos no entienden variables CSS: sus colores se copian del tokens.css final
const CORREO_DESDE_TOKENS = {
  claro: '--color-bg',
  secundario: '--color-secondary',
  borde: '--color-border',
  texto: '--color-text',
  acento: '--color-accent',
  superficie: '--color-surface'
};
const correoDesdeTokens = (correo, css) => {
  const claro = variablesDelBloque(css, 'claro');
  const final = { ...correo };
  for (const [clave, variable] of Object.entries(CORREO_DESDE_TOKENS)) {
    if (esHex(claro[variable] || '')) final[clave] = claro[variable].toUpperCase();
  }
  return final;
};

// ─── Programa ────────────────────────────────────────────────────────────────────────────────────

const ARCHIVOS = {
  marcaCliente: 'client/src/theme/brand.config.js',
  marcaServidor: 'server/src/config/brand.config.js',
  tokens: 'client/src/theme/tokens.css'
};

// `opciones.capa`: las variables de un paquete de ForgeStudio (--desde), que se escriben encima de la
// paleta generada. Sin ella, todo es como antes de --desde.
const generar = (raiz, respuestas, opciones = {}) => {
  const d = completar(respuestas);
  const paleta = generarPaleta(d.primario, d.acento, d.fondo);
  const leer = (ruta) => fs.readFileSync(path.join(raiz, ruta), 'utf8');
  let tokens = generarTokens(leer(ARCHIVOS.tokens), paleta);
  let correo = paleta.correo;
  let fusion = null;
  if (opciones.capa) {
    fusion = fusionarCapa(tokens, capaFinal(opciones.capa, d, tokens));
    tokens = fusion.css;
    // El halo de los campos del panel es el acento como texto: el del paquete, si lo trae
    const acentoTexto = variablesDelBloque(tokens, 'claro')['--color-accent-text'];
    if (esHex(acentoTexto || ''))
      tokens = ponerVariables(tokens, bloques(tokens).claro, {
        '--color-accent-text-rgb': aRgb(acentoTexto).join(', ')
      });
    correo = correoDesdeTokens(correo, tokens);
  }
  return {
    datos: d,
    paleta,
    fusion,
    archivos: {
      [ARCHIVOS.marcaCliente]: generarMarcaCliente(leer(ARCHIVOS.marcaCliente), d),
      [ARCHIVOS.marcaServidor]: generarMarcaServidor(leer(ARCHIVOS.marcaServidor), d, correo),
      [ARCHIVOS.tokens]: tokens
    }
  };
};

const main = async () => {
  const args = leerArgumentos(process.argv.slice(2));
  // Sin los dos guiones (npm run init:client --desde=...), npm se queda el argumento y lo deja aquí
  const desdeNpm = process.env.npm_config_desde;
  if (args.desde === undefined && desdeNpm) {
    args.desde = desdeNpm === 'true' ? true : desdeNpm;
    console.log(
      'Aviso: --desde ha llegado sin los dos guiones; la próxima vez: npm run init:client -- --desde=...\n'
    );
  }
  const raiz = path.resolve(typeof args.dir === 'string' ? args.dir : path.join(__dirname, '..'));
  const rl = process.stdin.isTTY && !args.si ? crearConsola() : null;
  try {
    await inicializar(args, raiz, rl);
  } finally {
    rl?.close();
  }
};

// Con --desde: lee el paquete y devuelve los argumentos con sus datos (los flags ganan)
const prepararDesde = (args, rl) => {
  if (args.desde === undefined) return { args, paquete: null };
  if (args.desde === true || args.desde === '')
    throw new Error('--desde necesita la ruta del paquete: --desde=forge-brand.json');
  if (args.primario !== undefined || args.acento !== undefined)
    throw new Error(
      '--primario y --acento no se combinan con --desde: los colores salen del paquete de ForgeStudio ' +
        '(cámbialos allí y vuelve a exportarlo).'
    );
  // npm ejecuta el script desde la raíz del repo: la ruta es relativa a donde se escribió el comando
  const base = process.env.INIT_CWD || process.cwd();
  const paquete = leerPaqueteForge(path.resolve(base, args.desde));
  const final = { ...paquete.args, ...args };
  if (final.email === undefined && !rl)
    throw new Error(
      `${path.basename(paquete.ruta)} no trae el correo de contacto: rellénalo en ForgeStudio ` +
        '(Perfil de marca) o añade --email=hola@tienda.com.'
    );
  return { args: final, paquete };
};

const fecha = (iso) => {
  const dia = new Date(iso);
  return Number.isNaN(dia.getTime())
    ? ''
    : dia.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const inicializar = async (argsConsola, raiz, rl) => {
  const { args, paquete } = prepararDesde(argsConsola, rl);
  if (paquete) {
    const generado = fecha(paquete.datos.generadoEl);
    console.log(
      `Nuevo cliente desde ${path.basename(paquete.ruta)} (ForgeStudio${generado ? `, ${generado}` : ''})` +
        (paquete.rutaTokens ? ' y forge-tokens.css' : '')
    );
    for (const aviso of paquete.avisos) console.log(`  Aviso: ${aviso}`);
    console.log('');
  } else {
    console.log('Nuevo cliente: marca y paleta (Enter acepta lo que va entre corchetes)\n');
  }
  const respuestas = { ...(await preguntar(args, rl)), ...(paquete?.extra || {}) };
  const { datos, archivos, fusion } = generar(
    raiz,
    respuestas,
    paquete ? { capa: paquete.capa } : {}
  );

  const claro = variablesDelBloque(archivos[ARCHIVOS.tokens], 'claro');
  const oscuro = variablesDelBloque(archivos[ARCHIVOS.tokens], 'oscuroBoton');
  console.log(
    `\n${datos.nombre} · referencias ${datos.prefijo}-XXX-000 · ${datos.email} · ${datos.web}`
  );
  console.log(
    `Paleta: primario ${claro['--color-primary']}, acento ${claro['--color-accent']}, ` +
      `fondo ${claro['--color-bg']}, texto secundario ${claro['--color-secondary']} ` +
      `(contraste ${contraste(claro['--color-secondary'], claro['--color-bg']).toFixed(2)}:1), ` +
      `fondo oscuro ${oscuro['--color-bg']}`
  );
  if (fusion) {
    const enOscuro = fusion.escritas.oscuroBoton.length;
    console.log(
      `tokens.css: ${fusion.escritas.claro.length} variables del paquete en claro y ${enOscuro} en cada ` +
        'modo oscuro; los alias (--bg-color, --card-bg...) siguen apuntando a ellas.'
    );
    if (fusion.omitidas.length)
      console.log(
        `  No se aplican en oscuro (el starter las fija en :root): ${fusion.omitidas.join(', ')}`
      );
    for (const [variable, nombre] of [
      ['--color-secondary', 'texto secundario'],
      ['--color-text-muted', 'texto atenuado'],
      ['--color-accent-text', 'acento como texto']
    ]) {
      const ratio = contraste(claro[variable], claro['--color-bg']);
      if (ratio < 4.5)
        console.log(
          `  Aviso: ${nombre} (${variable}) da ${ratio.toFixed(2)}:1 sobre el fondo; AA pide 4,5.`
        );
    }
  }
  const total = Object.keys(archivos).length;
  if (!(await confirmar(args, rl, `\n¿Escribo los ${total} archivos en ${raiz}?`))) {
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

module.exports = {
  generar,
  generarPaleta,
  contraste,
  completar,
  ponerCampo,
  leerPaqueteForge,
  fusionarCapa,
  VARIABLES_FORGE,
  ARCHIVOS
};
