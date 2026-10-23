// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer la hoja de estilo)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// La barra de modo admin en el móvil: jsdom no pinta, así que aquí se comprueba la hoja de estilo, y
// e2e/admin.spec.js lo mira en el navegador a 390 px (que no haya desplazamiento horizontal y que la
// barra quepa en la pantalla).
const css = readFileSync(new URL('../styles/BarraAdmin.css', import.meta.url), 'utf8');
const regla = (bloque, selector) => {
  const inicio = bloque.indexOf(`${selector} {`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  return bloque.slice(inicio, bloque.indexOf('}', inicio));
};
const movil = css.slice(css.indexOf('@media (max-width: 600px)'), css.indexOf('@media (forced-colors'));

describe('BarraAdmin.css — que no rompa la ficha', () => {
  it('en el ordenador: fija abajo, centrada, sin pasar del ancho de la pantalla y sobre el aviso de cookies', () => {
    const barra = regla(css, '.barra-admin');
    expect(barra).toMatch(/position: fixed;/);
    expect(barra).toMatch(/bottom: calc\(16px \+ var\(--alto-aviso-cookies, 0px\)\);/);
    expect(barra).toMatch(/max-width: calc\(100vw - 32px\);/);
    expect(barra).toMatch(/box-sizing: border-box;/);
    expect(regla(css, '.pd-container.con-barra-admin')).toMatch(/padding-bottom: 96px;/);
  });

  it('en el móvil: de lado a lado con 16 px de margen, en dos filas, y la ficha deja más sitio debajo', () => {
    expect(movil).not.toBe('');
    const barra = regla(movil, '.barra-admin');
    expect(barra).toMatch(/left: 16px;/);
    expect(barra).toMatch(/right: 16px;/);
    expect(barra).toMatch(/transform: none;/);
    expect(barra).toMatch(/flex-wrap: wrap;/);
    expect(regla(movil, '.barra-admin-botones')).toMatch(/width: 100%;/);
    expect(regla(movil, '.pd-container.con-barra-admin')).toMatch(/padding-bottom: 140px;/);
  });

  it('el nombre largo se corta con puntos suspensivos en vez de ensanchar la barra', () => {
    const texto = regla(css, '.barra-admin-texto');
    expect(texto).toMatch(/min-width: 0;/);
    expect(texto).toMatch(/white-space: nowrap;/);
    expect(texto).toMatch(/text-overflow: ellipsis;/);
  });
});
