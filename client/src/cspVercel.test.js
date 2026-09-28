// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer vercel.json)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// La CSP del cliente vive en client/vercel.json (la aplica Vercel; en `npm run dev` no hay CSP), así
// que un origen que falte solo se nota en producción, como un aviso en la consola (hoy es
// report-only) o como algo roto (si pasa a enforcing). Aquí se comprueba contra el propio archivo.
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const cabecera = vercel.headers
  .flatMap((h) => h.headers)
  .find((h) => h.key.startsWith('Content-Security-Policy'));
const directivas = Object.fromEntries(
  cabecera.value
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .filter((partes) => partes[0])
    .map(([nombre, ...fuentes]) => [nombre, fuentes])
);

// Coincidencia de una fuente de la CSP con una URL, en la parte que usa esta política: un origen
// sin ruta vale para cualquier ruta; con una ruta que acaba en "/", para lo que cuelgue de ella; con
// otra ruta, solo para esa. Si la directiva no existe, manda default-src.
const permite = (directiva, url) => {
  const destino = new URL(url);
  const fuentes = directivas[directiva] ?? directivas['default-src'] ?? [];
  return fuentes.some((fuente) => {
    if (!/^https?:\/\//.test(fuente)) return false;
    const origen = new URL(fuente);
    if (origen.origin !== destino.origin) return false;
    if (origen.pathname === '/' && !fuente.endsWith('/')) return true;
    return origen.pathname.endsWith('/')
      ? destino.pathname.startsWith(origen.pathname)
      : destino.pathname === origen.pathname;
  });
};

describe('CSP del cliente (vercel.json)', () => {
  // Las cuatro que pide Google para "Continuar con Google" (Google Identity Services), según
  // https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid (CSP).
  it.each([
    ['script-src', 'https://accounts.google.com/gsi/client', 'la librería'],
    ['style-src', 'https://accounts.google.com/gsi/style', 'la hoja de estilos del botón (H22)'],
    ['frame-src', 'https://accounts.google.com/gsi/button', 'el iframe del botón'],
    ['connect-src', 'https://accounts.google.com/gsi/status', 'sus peticiones']
  ])('%s permite %s (%s de Google Sign-In)', (directiva, url) => {
    expect(permite(directiva, url)).toBe(true);
  });

  it('style-src solo abre la hoja de estilos de Google, no todo accounts.google.com', () => {
    expect(permite('style-src', 'https://accounts.google.com/otra-cosa')).toBe(false);
  });

  it('el comprobador distingue: un origen que no está en la política no se permite', () => {
    expect(permite('script-src', 'https://ejemplo.com/script.js')).toBe(false);
  });
});
