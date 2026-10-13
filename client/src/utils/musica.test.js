// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede comprobar client/public/audio)
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { CANCIONES, CONSULTA_ESCRITORIO } from './musica';

const audio = new URL('../../public/audio/', import.meta.url);
// Un mp3 de 128 kbps de 6 minutos pesa unos 6 MB; más que esto es que no se ha recomprimido.
const MAX_BYTES = 7 * 1024 * 1024;

describe('canciones de la música de fondo', () => {
  it('hay canciones (si no, el reproductor no aparece)', () => {
    expect(CANCIONES.length).toBeGreaterThanOrEqual(2);
  });

  it('cada canción tiene título, artista, su mp3 en public/audio y su número de Pixabay', () => {
    CANCIONES.forEach((c) => {
      expect(c.titulo, JSON.stringify(c)).toBeTruthy();
      expect(c.artista, c.titulo).toBeTruthy();
      // Desde la propia web: así no hay que abrir ningún origen en la CSP (client/vercel.json).
      expect(c.url, c.titulo).toMatch(/^\/audio\/[a-z0-9-]+\.mp3$/);
      expect(Number.isInteger(c.pixabay) && c.pixabay > 0, `${c.titulo}: número de Pixabay`).toBe(true);
      const archivo = statSync(new URL(c.url.replace('/audio/', ''), audio));
      expect(archivo.size, c.url).toBeGreaterThan(0);
      expect(archivo.size, `${c.url} pesa demasiado`).toBeLessThanOrEqual(MAX_BYTES);
    });
  });

  it('no repite canciones', () => {
    const urls = CANCIONES.map((c) => c.url);
    expect(new Set(urls).size).toBe(urls.length);
    const numeros = CANCIONES.map((c) => c.pixabay);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('no sobra ningún mp3 en public/audio (se subiría a la web sin usarse)', () => {
    const usados = CANCIONES.map((c) => c.url.replace('/audio/', '')).sort();
    expect(readdirSync(audio).filter((f) => f.endsWith('.mp3')).sort()).toEqual(usados);
  });
});

describe('cuándo sale el reproductor', () => {
  // jsdom no evalúa media queries (los tests del componente simulan matchMedia), así que aquí solo se
  // puede vigilar la consulta. Con el puntero principal no salía en portátiles con pantalla táctil.
  it('basta con tener algún ratón o touchpad, aunque el puntero principal sea táctil', () => {
    expect(CONSULTA_ESCRITORIO).toMatch(/\(any-pointer: fine\)/);
    expect(CONSULTA_ESCRITORIO).not.toMatch(/(^|[^-])(pointer|hover):/);
  });
});
