// Comprobación por mutación de los tests de caracterización del panel de administración (tarea 4,
// ver docs/tarea4-diseno.md, sección 6).
//
// QUÉ HACE: por cada "mutante" (un fallo deliberado), cambia un trozo del código del panel, corre
// los tests de esa pestaña y comprueba que al menos uno falla. Después deja el archivo como estaba.
// Si un mutante sobrevive (todos los tests siguen en verde), a los tests les falta algo: o no hay
// ninguno que cubra ese comportamiento, o hay uno que no comprueba nada.
//
// USO (desde client/):
//   node scripts/mutantes-panel.js             -> todas las listas de scripts/mutantes/
//   node scripts/mutantes-panel.js crear       -> solo scripts/mutantes/crear.js
//   node scripts/mutantes-panel.js resumen crear
// Cada mutante corre su archivo de test entero: cuenta unos 10 segundos por mutante.
//
// CÓMO AÑADIR LOS MUTANTES DE UNA PESTAÑA: crear scripts/mutantes/<pestaña>.js con
//   export const TEST = 'src/pages/Admin.<pestaña>.test.jsx';
//   export const MUTANTES = [
//     { nombre: 'qué fallo simula', buscar: 'texto exacto del código', reemplazo: 'texto con el fallo' },
//   ];
// - `buscar` tiene que aparecer tal cual en el archivo (saltos de línea como \n, sin \r). Se cambia
//   solo la primera aparición. Si no aparece, el mutante sale como NO ENCONTRADO.
// - `archivo` (opcional, por defecto src/pages/Admin.jsx): después del refactor, el código vive en
//   src/pages/admin/..., y cada mutante tiene que apuntar a su archivo nuevo.
// - `sobreviveAqui` (opcional): el motivo por el que se espera que el mutante sobreviva con este
//   archivo de test (por ejemplo, porque lo cubre el test de otra pestaña). No cuenta como fallo.
// - `control: true`: marca el mutante de control (hay exactamente uno entre todas las listas; ver
//   COMPROBACIONES PREVIAS). Tiene que ser uno sencillo que un test mate seguro.
// Buenos mutantes: los cambios que un refactor podría colar sin querer (una condición que se pierde,
// un orden distinto, un texto cambiado, una llamada de más o de menos), no fallos absurdos.
//
// COMPROBACIONES PREVIAS: el script lee el resumen de Vitest ("Tests  1 failed | 16 passed"). Si un
// día cambia ese formato, podría dar mutantes por supervivientes (o por muertos) sin serlo. Para que
// eso falle a la vista y no en silencio, antes de empezar:
// 1. Corre cada archivo de test SIN mutar: tiene que salir todo en verde y el script tiene que
//    reconocer cuántos tests pasan. Si no, se para (un test ya en rojo "mataría" todos los mutantes).
// 2. Prueba el mutante de control (`control: true`): tiene que morir. Si sobrevive, se para.
//
// SEGURIDAD: el script modifica código fuente, así que:
// - No arranca si alguno de los archivos que va a mutar tiene cambios sin commitear. Si una ejecución
//   anterior se cortó a lo bruto, el archivo podría haberse quedado con un fallo dentro, y se tomaría
//   por el original.
// - Restaura el archivo después de cada mutante, si algo falla y con Ctrl+C.
//
// Termina con código 1 si falla una comprobación previa, o si algún mutante sobrevive sin
// `sobreviveAqui` o no se encuentra.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const DIR_LISTAS = join(CLIENT, 'scripts', 'mutantes');
const ARCHIVO_POR_DEFECTO = 'src/pages/Admin.jsx';
const COLORES_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const cargarLista = async (nombre) => {
  const { TEST, MUTANTES } = await import(pathToFileURL(join(DIR_LISTAS, `${nombre}.js`)).href);
  return { nombre, TEST, MUTANTES };
};

const todasLasListas = readdirSync(DIR_LISTAS).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, '')).sort();
const pedidas = process.argv.slice(2);
const listas = [];
for (const nombre of pedidas.length > 0 ? pedidas : todasLasListas) listas.push(await cargarLista(nombre));

// El mutante de control se busca en todas las listas, aunque solo se hayan pedido algunas.
const controles = [];
for (const nombre of todasLasListas) {
  const { TEST, MUTANTES } = await cargarLista(nombre);
  for (const m of MUTANTES) if (m.control) controles.push({ ...m, TEST });
}
if (controles.length !== 1) {
  console.error(`Tiene que haber exactamente un mutante con control: true en scripts/mutantes/ (hay ${controles.length}).`);
  process.exit(1);
}
const control = controles[0];

// Originales de todos los archivos que se van a mutar, para restaurarlos pase lo que pase.
const originales = new Map();
for (const m of [control, ...listas.flatMap(l => l.MUTANTES)]) {
  const archivo = resolve(CLIENT, m.archivo ?? ARCHIVO_POR_DEFECTO);
  if (originales.has(archivo)) continue;
  const cambios = execSync(`git status --porcelain -- "${archivo}"`, { cwd: CLIENT, encoding: 'utf8' });
  if (cambios.trim()) {
    console.error(`${archivo} tiene cambios sin commitear. Commitéalos o guárdalos antes de mutarlo.`);
    process.exit(1);
  }
  originales.set(archivo, readFileSync(archivo, 'utf8'));
}

// En Windows, otro proceso (el antivirus, el indexador, un editor) puede tener el archivo abierto
// un instante y la escritura falla con EBUSY, EPERM o UNKNOWN. Pasó una vez (24 sep 2026) justo al
// restaurar, y Admin.jsx se quedó con un mutante dentro. Así que cada escritura se reintenta.
const ERRORES_PASAJEROS = new Set(['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN']);
const escribir = (archivo, contenido) => {
  for (let intento = 1; ; intento++) {
    try {
      writeFileSync(archivo, contenido);
      return;
    } catch (e) {
      if (!ERRORES_PASAJEROS.has(e.code) || intento === 20) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); // espera 250 ms
    }
  }
};

const restaurarTodo = () => {
  for (const [archivo, contenido] of originales) {
    try {
      escribir(archivo, contenido);
    } catch (e) {
      console.error(
        `\n¡NO SE HA PODIDO RESTAURAR ${archivo}! (${e.code}). Puede haberse quedado con un mutante dentro.` +
          ` Restáuralo con: git checkout -- "${archivo}"`
      );
      process.exitCode = 1;
    }
  }
};
const abortar = (mensaje) => {
  restaurarTodo();
  console.error(`\n${mensaje}`);
  process.exit(1);
};
process.on('SIGINT', () => {
  restaurarTodo();
  console.error('\nInterrumpido: archivos restaurados.');
  process.exit(130);
});

// Corre un archivo de test y lee del resumen de Vitest cuántos tests pasan y fallan, y cuántos
// archivos de test fallan (un archivo que ni siquiera carga cuenta como fallido).
const correrTest = (test) => {
  let salida;
  try {
    salida = execSync(`npx vitest run ${test}`, {
      cwd: CLIENT,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, NO_COLOR: '1' }
    });
  } catch (e) {
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const limpia = salida.replace(COLORES_ANSI, '');
  const lineaTests = (limpia.match(/^\s*Tests\s+(.+)$/m) ?? [])[1] ?? '';
  const lineaArchivos = (limpia.match(/^\s*Test Files\s+(.+)$/m) ?? [])[1] ?? '';
  const numero = (linea, palabra) => Number((linea.match(new RegExp(`(\\d+) ${palabra}`)) ?? [])[1] ?? 0);
  return {
    pasados: numero(lineaTests, 'passed'),
    fallidos: numero(lineaTests, 'failed'),
    archivosFallidos: numero(lineaArchivos, 'failed')
  };
};

// Aplica un mutante, corre el test y restaura. Devuelve 'no-encontrado', 'matado' o 'sobrevive'.
const probarMutante = (m, test) => {
  const archivo = resolve(CLIENT, m.archivo ?? ARCHIVO_POR_DEFECTO);
  const texto = originales.get(archivo).replace(/\r\n/g, '\n');
  if (!texto.includes(m.buscar)) return { resultado: 'no-encontrado', detalle: 'NO ENCONTRADO' };
  escribir(archivo, texto.replace(m.buscar, m.reemplazo));
  try {
    const { fallidos, archivosFallidos } = correrTest(test);
    if (fallidos > 0) return { resultado: 'matado', detalle: `MATADO (${fallidos})` };
    if (archivosFallidos > 0) return { resultado: 'matado', detalle: 'MATADO (carga)' };
    return { resultado: 'sobrevive', detalle: 'SOBREVIVE' };
  } finally {
    escribir(archivo, originales.get(archivo));
  }
};

let problemas = 0;
try {
  console.log('== Comprobaciones previas');
  for (const { TEST } of listas) {
    const { pasados, fallidos, archivosFallidos } = correrTest(TEST);
    if (pasados === 0 || fallidos > 0 || archivosFallidos > 0) {
      abortar(`Sin mutar, ${TEST} no sale en verde (se leen ${pasados} que pasan y ${fallidos} que fallan), o el script no reconoce la salida de Vitest. Así no se puede medir nada.`);
    }
    console.log(`en verde sin mutar (${pasados} tests)  ${TEST}`);
  }
  const { resultado, detalle } = probarMutante(control, control.TEST);
  if (resultado !== 'matado') {
    abortar(`El mutante de control ("${control.nombre}") da ${detalle}: el script no está detectando fallos. ¿Ha cambiado el formato de salida de Vitest, se ha movido el código que muta, o el mutante de control ya no es válido para el código actual?`);
  }
  console.log(`${detalle.padEnd(15)} control: ${control.nombre}`);

  for (const { nombre, TEST, MUTANTES } of listas) {
    console.log(`\n== ${nombre} (${TEST})`);
    for (const m of MUTANTES) {
      const { resultado, detalle } = probarMutante(m, TEST);
      if (resultado === 'sobrevive' && m.sobreviveAqui) {
        console.log(`SOBREVIVE (esperado: ${m.sobreviveAqui})  ${m.nombre}`);
        continue;
      }
      if (resultado !== 'matado') problemas++;
      console.log(`${detalle.padEnd(15)} ${m.nombre}`);
    }
  }
} finally {
  restaurarTodo();
}

console.log(problemas === 0 ? '\nTodos los mutantes detectados.' : `\n${problemas} mutante(s) sin detectar o no encontrados.`);
process.exit(problemas === 0 ? 0 : 1);
