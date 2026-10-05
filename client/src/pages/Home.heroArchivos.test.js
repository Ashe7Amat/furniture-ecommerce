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
