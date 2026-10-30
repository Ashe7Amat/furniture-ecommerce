// @vitest-environment node
// El sistema de temas (tarea 1 del starter kit): la paleta vive solo en tokens.css y las hojas
// refactorizadas no llevan colores ni fuentes sueltos, para que cambiar de marca sea cambiar variables.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRAND } from './brand.config';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const HOJAS = ['../styles/index.css', '../styles/Admin.css', '../styles/AdminReservas.css', '../styles/ProductDetail.css'];

describe('hojas que consumen solo tokens', () => {
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

  it.each(HOJAS)('%s usa los nombres nuevos, no los alias clásicos', (hoja) => {
    expect(leer(hoja)).not.toMatch(/var\(--(bg-color|primary-color|secondary-color|accent-color|card-bg|border-color|text-color)\b/);
  });

  it('solo index.css importa tokens.css (si otra hoja lo importara, pisaría un tema puesto encima)', () => {
    expect(leer('../styles/index.css')).toContain("@import '../theme/tokens.css';");
    for (const hoja of [...HOJAS.slice(1), '../styles/AdminUI.css']) {
      expect(sinComentarios(leer(hoja))).not.toContain('tokens.css');
    }
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
