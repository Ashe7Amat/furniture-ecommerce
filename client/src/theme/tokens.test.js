// @vitest-environment node
// El sistema de temas (starter kit): la paleta vive solo en tokens.css y ninguna hoja ni componente
// lleva colores o fuentes sueltos, para que cambiar de marca sea cambiar variables.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { BRAND } from './brand.config';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const SRC = fileURLToPath(new URL('..', import.meta.url));
const archivos = (filtro, dir = SRC) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'theme' ? [] : archivos(filtro, ruta);
    return filtro(e.name) ? [`../${relative(SRC, ruta)}`] : [];
  });
// Todas las hojas de la web menos las del tema (tokens.css y los temas de ejemplo)
const HOJAS = archivos((nombre) => nombre.endsWith('.css'));
// Las cuatro primeras que se pasaron a tokens usan además los nombres nuevos (--color-*)
const HOJAS_NOMBRES_NUEVOS = ['../styles/index.css', '../styles/Admin.css', '../styles/AdminReservas.css', '../styles/ProductDetail.css'];

describe('hojas que consumen solo tokens', () => {
  it('encuentra todas las hojas de la web', () => {
    expect(HOJAS.length).toBeGreaterThanOrEqual(28);
    expect(HOJAS).toEqual(expect.arrayContaining([...HOJAS_NOMBRES_NUEVOS, '../styles/Home.css', '../pages/Profile.css']));
  });

  it.each(HOJAS)('%s no tiene colores escritos a mano', (hoja) => {
    const css = sinComentarios(leer(hoja));
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(css.match(/\b(rgb|rgba|hsl|hsla)\((?!var\()/g)).toBeNull();
    expect(css.match(/:\s*[^;]*\b(black|white)\s*[;!]/g)).toBeNull();
  });

  it.each(HOJAS)('%s no tiene familias tipográficas escritas a mano', (hoja) => {
    const familias = [...sinComentarios(leer(hoja)).matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
    for (const familia of familias) expect(familia).toMatch(/^(var\(--font-[a-z-]+\)|inherit)$/);
  });

  it.each(HOJAS_NOMBRES_NUEVOS)('%s usa los nombres nuevos, no los alias clásicos', (hoja) => {
    expect(leer(hoja)).not.toMatch(/var\(--(bg-color|primary-color|secondary-color|accent-color|card-bg|border-color|text-color)\b/);
  });

  it('solo index.css importa tokens.css (si otra hoja lo importara, pisaría un tema puesto encima)', () => {
    expect(leer('../styles/index.css')).toContain("@import '../theme/tokens.css';");
    for (const hoja of HOJAS.filter((h) => h !== '../styles/index.css')) {
      expect(sinComentarios(leer(hoja))).not.toContain('tokens.css');
    }
  });
});

describe('componentes sin colores escritos a mano', () => {
  // Dos excepciones a propósito, que no son de la marca: el QR tiene que ser negro sobre blanco para que
  // lo lean los móviles, y el canvas que pasa fotos a JPEG no entiende variables CSS (pinta de blanco lo
  // transparente).
  const EXCEPCIONES = { '../pages/admin/CodigoQr.jsx': ['#fff', '#000'], '../utils/imagen.js': ['#fff'] };
  const CODIGO = archivos((nombre) => /\.(jsx?|tsx?)$/.test(nombre) && !/\.test\./.test(nombre));

  it.each(CODIGO)('%s', (archivo) => {
    const codigo = leer(archivo).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const colores = [...codigo.matchAll(/['"`]\s*(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\((?!var\()[^)]*\))/g)].map((m) => m[1]);
    expect(colores).toEqual(EXCEPCIONES[archivo] ?? []);
  });
});

describe('tokens.css', () => {
  const css = leer('./tokens.css');
  const bloque = (selector) => {
    const inicio = css.indexOf(selector);
    return css.slice(inicio, css.indexOf('}', inicio));
  };
  const variables = (texto) => Object.fromEntries([...texto.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

  it('los dos bloques de modo oscuro (sistema y botón) tienen los mismos valores', () => {
    const sistema = variables(bloque(':root:not([data-theme="light"])'));
    const boton = variables(bloque(':root[data-theme="dark"]'));
    expect(Object.keys(sistema).length).toBeGreaterThan(15);
    expect(boton).toEqual(sistema);
  });

  it('cada alias clásico apunta a un token nuevo', () => {
    const base = variables(bloque(':root {'));
    for (const alias of ['--bg-color', '--primary-color', '--secondary-color', '--accent-color', '--accent-hover', '--accent-text',
      '--card-bg', '--surface-alt', '--border-color', '--text-color', '--success-color', '--danger-color', '--warning-color']) {
      expect(base[alias]).toMatch(/^var\(--color-[a-z-]+\)$/);
      expect(base[base[alias].slice(4, -1)]).toBeTruthy();
    }
  });

  // Solo en Nave 5: con otra marca (npm run init:client) la paleta es otra a propósito.
  it.runIf(BRAND.idInterno === 'nave5')('la paleta de Nave 5 conserva sus valores exactos', () => {
    const base = variables(bloque(':root {'));
    expect(base['--color-bg']).toBe('#F5F2EC');
    expect(base['--color-primary']).toBe('#3E322A');
    expect(base['--color-accent']).toBe('#B38A70');
    expect(base['--color-accent-text']).toBe('#7E5A42');
    expect(base['--color-surface']).toBe('#FCFAF8');
    expect(base['--font-display']).toBe("'Fraunces', ui-serif, 'Iowan Old Style', 'Palatino Linotype', serif");
    expect(base['--font-body']).toBe("'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
  });
});

describe('theme-cliente-demo.css', () => {
  const css = leer('./theme-cliente-demo.css');

  it('explica cómo activarlo y redefine la paleta en claro y en los dos modos oscuros', () => {
    expect(css).toContain("import './theme/theme-cliente-demo.css'");
    expect(css).toMatch(/:root \{[^}]*--color-primary:\s*#0F1E36/);
    expect(css).toContain(':root:not([data-theme="light"])');
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it('no usa data-theme para la marca (data-theme es del modo claro/oscuro)', () => {
    expect(css).not.toContain('data-theme="cliente-demo"');
  });
});
