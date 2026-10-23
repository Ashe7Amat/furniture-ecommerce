// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer la hoja de estilo de forma nativa)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/ProductCard.css', import.meta.url), 'utf8');

describe('ProductCard.css — contraste de badge y contención de CTA', () => {
  it('el badge usa fondo oscuro semitransparente con backdrop-filter y texto blanco para contraste en ambos temas', () => {
    expect(css).toMatch(/\.product-badge\s*\{[^}]*background:\s*rgba\(26,\s*21,\s*16,\s*0\.7\);/);
    expect(css).toMatch(/\.product-badge\s*\{[^}]*color:\s*#FFFFFF;/);
    expect(css).toMatch(/\.product-badge\s*\{[^}]*backdrop-filter:\s*blur\(8px\);/);
    expect(css).toMatch(/\.product-badge--unique\s*\{[^}]*color:\s*#FFFFFF;/);
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
