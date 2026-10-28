// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer el disco)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// H42: las fotos del hero que pide Home.jsx (las de 800 y 1200 px y los originales) tienen que estar en
// public/img. Una errata en un nombre no la ve el test de Home (jsdom no descarga imágenes): saldría la
// foto rota solo en el móvil o solo en la tableta.
const codigo = readFileSync(new URL('./Home.jsx', import.meta.url), 'utf8');
const rutas = [...new Set(codigo.match(/\/img\/hero-[a-z0-9-]+\.webp/g))];

describe('Home — archivos de las fotos del hero (H42)', () => {
  it('Home.jsx pide las 4 fotos en 11 archivos: 4 originales, 4 de 800 y 3 de 1200', () => {
    expect(rutas.filter((r) => r.endsWith('-800.webp'))).toHaveLength(4);
    expect(rutas.filter((r) => r.endsWith('-1200.webp'))).toHaveLength(3);
    expect(rutas).toHaveLength(11);
  });

  it.each(rutas)('%s está en public/', (ruta) => {
    expect(existsSync(new URL(`../../public${ruta}`, import.meta.url))).toBe(true);
  });
});

// Las fotos de la galería de ambiente y su versión de 800 px para el móvil (srcSetGaleria en Home.jsx).
const galeria = [...new Set(codigo.match(/\/img\/galeria-[a-z0-9-]+\.webp/g))]
  .flatMap((ruta) => [ruta, ruta.replace(/\.webp$/, '-800.webp')]);

describe('Home — archivos de la galería de ambiente', () => {
  it('Home.jsx pide 2 fotos de galería, cada una con su versión de 800', () => {
    expect(galeria).toHaveLength(4);
  });

  it.each(galeria)('%s está en public/', (ruta) => {
    expect(existsSync(new URL(`../../public${ruta}`, import.meta.url))).toBe(true);
  });
});
