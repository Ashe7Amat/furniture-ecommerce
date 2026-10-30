// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer la hoja de estilo de forma nativa)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/ProductCard.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../theme/tokens.css', import.meta.url), 'utf8');

// Contraste WCAG entre dos colores [r, g, b]
const luminancia = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [la, lb] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
};

describe('ProductCard.css — contraste de badge y contención de CTA', () => {
  it('el badge usa fondo oscuro semitransparente con backdrop-filter y texto blanco para contraste en ambos temas', () => {
    expect(css).toMatch(/\.product-badge\s*\{[^}]*background:\s*rgba\(var\(--color-cta-rgb\),\s*0\.7\);/);
    expect(css).toMatch(/\.product-badge\s*\{[^}]*color:\s*var\(--color-white\);/);
    expect(css).toMatch(/\.product-badge\s*\{[^}]*backdrop-filter:\s*blur\(8px\);/);
    expect(css).toMatch(/\.product-badge--unique\s*\{[^}]*color:\s*var\(--color-white\);/);
    // El tono oscuro sale de tokens.css (fijo en claro y en oscuro): con el blanco encima pasa el AA
    expect(tokens).toMatch(/--color-white:\s*#fff;/);
    const cta = tokens.match(/--color-cta-rgb:\s*(\d+),\s*(\d+),\s*(\d+);/).slice(1).map(Number);
    expect(contraste([255, 255, 255], cta)).toBeGreaterThanOrEqual(4.5);
  });

  it('el footer de acciones tiene flex-wrap, align-items center y overflow hidden para evitar desbordes', () => {
    expect(css).toMatch(/\.product-footer\s*\{[^}]*display:\s*flex;/);
    expect(css).toMatch(/\.product-footer\s*\{[^}]*flex-wrap:\s*wrap;/);
    expect(css).toMatch(/\.product-footer\s*\{[^}]*justify-content:\s*space-between;/);
    expect(css).toMatch(/\.product-footer\s*\{[^}]*align-items:\s*center;/);
    expect(css).toMatch(/\.product-footer\s*\{[^}]*overflow:\s*hidden;/);
  });

  it('el CTA y el precio usan clamp y no rompen el contenedor', () => {
    expect(css).toMatch(/\.price-value\s*\{[^}]*font-size:\s*clamp\(/);
    expect(css).toMatch(/\.product-cta\s*\{[^}]*font-size:\s*clamp\(/);
    expect(css).toMatch(/\.product-cta\s*\{[^}]*display:\s*inline-flex;/);
  });
});
