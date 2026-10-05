// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se pueden leer las hojas de estilo)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// H41: las categorías del catálogo son botones y el foco tiene que verse. jsdom no calcula
// :focus-visible (ni Vitest procesa el CSS), así que se comprueba en las propias hojas de estilo.
const leer = (archivo) => readFileSync(new URL(`../styles/${archivo}`, import.meta.url), 'utf8');

describe('CategorySlider — foco visible con el teclado (H41)', () => {
  it('los botones de la tienda llevan el anillo de foco común de index.css', () => {
    expect(leer('index.css')).toMatch(
      /:where\(a, button,[^)]*\):focus-visible[^{]*\{\s*outline: 2px solid var\(--accent-color\)/
    );
  });

  it('la categoría con el foco se eleva y resalta su nombre, como al pasar el ratón', () => {
    const css = leer('CategorySlider.css');
    expect(css).toMatch(/\.category-item:hover,\s*\.category-item:focus-visible\s*\{\s*transform: translateY\(-5px\)/);
    expect(css).toMatch(/\.category-item:focus-visible \.category-name\s*\{/);
  });

  it('el botón no trae el aspecto del navegador (se ve igual que el div de antes)', () => {
    const regla = leer('CategorySlider.css').match(/\n\.category-item\s*\{([^}]*)\}/)[1];
    for (const declaracion of ['background: none', 'border: 0', 'padding: 0', 'font: inherit']) {
      expect(regla).toContain(declaracion);
    }
  });
});
