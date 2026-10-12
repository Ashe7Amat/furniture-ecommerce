// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede comprobar client/public/audio)
import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { CANCIONES } from './musica';

const publico = new URL('../../public', import.meta.url);
// Un mp3 de 128 kbps de 5 minutos pesa unos 5 MB; más que esto es que no se ha comprimido.
const MAX_BYTES = 7 * 1024 * 1024;

describe('canciones de la música de fondo', () => {
  it('cada canción tiene título, artista, su mp3 en public/audio y la página de Pixabay de su licencia', () => {
    CANCIONES.forEach((c) => {
      expect(c.titulo, JSON.stringify(c)).toBeTruthy();
      expect(c.artista, c.titulo).toBeTruthy();
      // Desde la propia web: así no hay que abrir ningún origen en la CSP (client/vercel.json).
      expect(c.url, c.titulo).toMatch(/^\/audio\/[a-z0-9-]+\.mp3$/);
      expect(c.fuente, c.titulo).toMatch(/^https:\/\/pixabay\.com\//);
      const archivo = statSync(new URL(`.${c.url}`, `${publico.href}/`));
      expect(archivo.size, c.url).toBeGreaterThan(0);
      expect(archivo.size, `${c.url} pesa demasiado`).toBeLessThanOrEqual(MAX_BYTES);
    });
  });

  it('no repite canciones', () => {
    const urls = CANCIONES.map((c) => c.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
