// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se pueden leer vercel.json e index.html)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// SEO del catálogo (28 oct 2026): el sitemap lo genera la API (server/src/controllers/
// sitemapController.js) con todas las fichas, y la web lo sirve en su propio dominio con un rewrite.
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const vercel = JSON.parse(leer('../vercel.json'));

describe('sitemap.xml', () => {
  it('se sirve desde la API, con un rewrite que va antes del de la SPA', () => {
    const indice = vercel.rewrites.findIndex((r) => r.source === '/sitemap.xml');
    expect(vercel.rewrites[indice]?.destination).toBe('https://nave5-api.vercel.app/api/sitemap.xml');
    expect(indice).toBeLessThan(vercel.rewrites.findIndex((r) => r.source === '/(.*)'));
  });

  it('no queda un sitemap fijo en public/ (Vercel lo serviría antes que el rewrite)', () => {
    expect(existsSync(new URL('../public/sitemap.xml', import.meta.url))).toBe(false);
  });

  it('robots.txt sigue apuntando a él', () => {
    expect(leer('../public/robots.txt')).toContain('Sitemap: https://www.nave5barcelona.com/sitemap.xml');
  });
});

describe('index.html', () => {
  const html = leer('../index.html');
  const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1])
  );

  it('describe la tienda con su dirección, en un JSON-LD válido', () => {
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({
      '@type': 'FurnitureStore',
      name: 'Nave 5 Barcelona',
      url: 'https://www.nave5barcelona.com/',
      address: { streetAddress: 'Carrer del Plom, 32-34', postalCode: '08038', addressLocality: 'Barcelona' },
    });
  });

  it('sin precios ni rango de precios (MOSTRAR_PRECIOS)', () => {
    expect(JSON.stringify(bloques)).not.toMatch(/price/i);
  });

  it('sin canonical ni og:url fijos (H34: dirían que todas las rutas son la portada)', () => {
    expect(html).not.toMatch(/rel="canonical"|og:url/);
  });
});
