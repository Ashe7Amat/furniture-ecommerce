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
// Buenos mutantes: los cambios que un refactor podría colar sin querer (una condición que se pierde,
// un orden distinto, un texto cambiado, una llamada de más o de menos), no fallos absurdos.
//
// SEGURIDAD: el script modifica código fuente, así que:
// - No arranca si alguno de los archivos que va a mutar tiene cambios sin commitear. Si una ejecución
//   anterior se cortó a lo bruto, el archivo podría haberse quedado con un fallo dentro, y se tomaría
//   por el original.
// - Restaura el archivo después de cada mutante, si algo falla y con Ctrl+C.
//
// Termina con código 1 si algún mutante sobrevive sin `sobreviveAqui` o no se encuentra.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const DIR_LISTAS = join(CLIENT, 'scripts', 'mutantes');
const ARCHIVO_POR_DEFECTO = 'src/pages/Admin.jsx';
const COLORES_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const pedidas = process.argv.slice(2);
const nombresListas = pedidas.length > 0
  ? pedidas
  : readdirSync(DIR_LISTAS).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, '')).sort();

const listas = [];
for (const nombre of nombresListas) {
  const { TEST, MUTANTES } = await import(pathToFileURL(join(DIR_LISTAS, `${nombre}.js`)).href);
  listas.push({ nombre, TEST, MUTANTES });
}

// Originales de todos los archivos que se van a mutar, para restaurarlos pase lo que pase.
const originales = new Map();
for (const { MUTANTES } of listas) {
  for (const m of MUTANTES) {
    const archivo = resolve(CLIENT, m.archivo ?? ARCHIVO_POR_DEFECTO);
    if (originales.has(archivo)) continue;
    const cambios = execSync(`git status --porcelain -- "${archivo}"`, { cwd: CLIENT, encoding: 'utf8' });
    if (cambios.trim()) {
      console.error(`${archivo} tiene cambios sin commitear. Commitéalos o guárdalos antes de mutarlo.`);
      process.exit(1);
    }
    originales.set(archivo, readFileSync(archivo, 'utf8'));
  }
}

const restaurarTodo = () => {
  for (const [archivo, contenido] of originales) writeFileSync(archivo, contenido);
};
process.on('SIGINT', () => {
  restaurarTodo();
  console.error('\nInterrumpido: archivos restaurados.');
  process.exit(130);
});

// Un mutante está "matado" si falla algún test, o si el archivo de test ni siquiera carga (por
// ejemplo, porque el mutante rompe la sintaxis).
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
  const testsFallidos = Number((limpia.match(/Tests\s+(\d+) failed/) ?? [])[1] ?? 0);
  const archivosFallidos = Number((limpia.match(/Test Files\s+(\d+) failed/) ?? [])[1] ?? 0);
  return { testsFallidos, archivosFallidos };
};

let problemas = 0;
try {
  for (const { nombre, TEST, MUTANTES } of listas) {
    console.log(`\n== ${nombre} (${TEST})`);
    for (const m of MUTANTES) {
      const archivo = resolve(CLIENT, m.archivo ?? ARCHIVO_POR_DEFECTO);
      const texto = originales.get(archivo).replace(/\r\n/g, '\n');
      if (!texto.includes(m.buscar)) {
        console.log(`NO ENCONTRADO   ${m.nombre}`);
        problemas++;
        continue;
      }
      writeFileSync(archivo, texto.replace(m.buscar, m.reemplazo));
      try {
        const { testsFallidos, archivosFallidos } = correrTest(TEST);
        if (testsFallidos > 0) {
          console.log(`MATADO (${testsFallidos})      ${m.nombre}`);
        } else if (archivosFallidos > 0) {
          console.log(`MATADO (carga)  ${m.nombre}`);
        } else if (m.sobreviveAqui) {
          console.log(`SOBREVIVE (esperado: ${m.sobreviveAqui})  ${m.nombre}`);
        } else {
          console.log(`SOBREVIVE       ${m.nombre}`);
          problemas++;
        }
      } finally {
        writeFileSync(archivo, originales.get(archivo));
      }
    }
  }
} finally {
  restaurarTodo();
}

console.log(problemas === 0 ? '\nTodos los mutantes detectados.' : `\n${problemas} mutante(s) sin detectar o no encontrados.`);
process.exit(problemas === 0 ? 0 : 1);
