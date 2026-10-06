// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer la hoja de estilo)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// H48 y H47: el contraste lo comprueba axe en el E2E, que el CI no trata como bloqueante, y jsdom no
// calcula los colores. Aquí solo se vigila que estos textos sigan usando --accent-text (4,5:1 o más en claro
// y en oscuro) y no --accent-color (2,76 a 2,97:1 en claro).
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const color = (css, selector) => {
  const regla = css.match(new RegExp(`${selector.replace(/[.[\]()$^*+?|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return regla?.[1].match(/\bcolor:\s*([^;]+);/)?.[1].trim();
};

describe('colores de texto con contraste suficiente (H47, H48)', () => {
  it('el enlace del aviso de cookies usa --accent-text', () => {
    expect(color(leer('../styles/CookieConsent.css'), '.cookie-banner p a')).toBe('var(--accent-text)');
  });

  it('la etiqueta de la contraseña actual en Mi cuenta usa --accent-text', () => {
    expect(color(leer('../pages/Profile.css'), '.form-group-clean.form-group-security label')).toBe('var(--accent-text)');
  });

  it('--accent-text se define en claro y en oscuro', () => {
    const css = leer('../styles/index.css');
    expect(css.match(/--accent-text:\s*#[0-9A-Fa-f]{6}/g)).toHaveLength(3); // :root, oscuro por sistema y oscuro manual
  });
});
