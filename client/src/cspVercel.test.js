// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer vercel.json)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

describe('Cabeceras de seguridad en cliente (vercel.json)', () => {
  const todasCabeceras = vercel.headers.flatMap((h) => h.headers);
  const buscarCabecera = (clave) => todasCabeceras.find((h) => h.key.toLowerCase() === clave.toLowerCase());

  it('incluye X-Content-Type-Options: nosniff', () => {
    const h = buscarCabecera('X-Content-Type-Options');
    expect(h?.value).toBe('nosniff');
  });

  it('incluye X-Frame-Options: DENY', () => {
    const h = buscarCabecera('X-Frame-Options');
    expect(h?.value).toBe('DENY');
  });

  it('incluye Referrer-Policy estricta', () => {
    const h = buscarCabecera('Referrer-Policy');
    expect(h?.value).toBe('strict-origin-when-cross-origin');
  });

  it('incluye Permissions-Policy limitando hardware', () => {
    const h = buscarCabecera('Permissions-Policy');
    expect(h?.value).toContain('camera=()');
    expect(h?.value).toContain('microphone=()');
  });

  it('incluye Strict-Transport-Security con preload', () => {
    const h = buscarCabecera('Strict-Transport-Security');
    expect(h?.value).toMatch(/max-age=\d+/);
    expect(h?.value).toContain('preload');
  });
});

describe('Script de precarga del hero (index.html) y CSP', () => {
  // index.html lleva un único <script> en línea: precarga la foto del hero solo en la portada. La CSP
  // (hoy report-only) solo lo deja correr si su hash está en script-src; si se toca el script sin poner
  // el hash nuevo, la consola avisa en producción y, el día que la CSP pase a enforcing, deja de precargar.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const enLinea = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  it('hay un solo script en línea y su hash está en script-src', () => {
    expect(enLinea).toHaveLength(1);
    const hash = createHash('sha256').update(enLinea[0], 'utf8').digest('base64');
    expect(directivas['script-src']).toContain(`'sha256-${hash}'`);
  });

  it('ya no hay <link rel="preload"> fijos de la foto del hero (se descargaban en todas las páginas)', () => {
    expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+hero-/);
  });
});

describe('Caché de los archivos estáticos (vercel.json)', () => {
  const cacheDe = (fuente) => vercel.headers
    .find((h) => h.source === fuente)
    ?.headers.find((h) => h.key === 'Cache-Control')?.value;

  it('/assets: un año e immutable (Vite pone el hash del contenido en el nombre)', () => {
    expect(cacheDe('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
  });

  it('/img y /audio: un día, y otra semana sirviendo la copia mientras se revalida (sus nombres no cambian)', () => {
    expect(cacheDe('/(img|audio)/(.*)')).toBe('public, max-age=86400, stale-while-revalidate=604800');
  });
});
