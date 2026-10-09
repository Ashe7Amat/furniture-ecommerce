// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se pueden leer el componente y la hoja de estilo)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// El Header fija la altura del logo y su aspect-ratio en CSS. Si el viewBox del SVG cambia y el
// aspect-ratio no, el logo sale deformado o con hueco a un lado.
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

describe('Logo — proporción en la hoja de estilos', () => {
  it('el aspect-ratio de .logo-svg es el del viewBox de Logo.jsx', () => {
    const [, ancho, alto] = leer('./Logo.jsx').match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
    const [, a, b] = leer('../styles/HeaderFooter.css').match(/\.logo-svg\s*\{[^}]*aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    expect(Number(a) / Number(b)).toBeCloseTo(Number(ancho) / Number(alto), 3);
  });
});
