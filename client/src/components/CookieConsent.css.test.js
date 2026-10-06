// @vitest-environment node
// (sin DOM: así import.meta.url es la ruta del archivo y se puede leer la hoja de estilo)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// H48, H47 y H54: el contraste lo comprueba axe en el E2E, que el CI no trata como bloqueante, y jsdom no
// calcula los colores. Aquí solo se vigila que estos textos sigan usando --accent-text (4,5:1 o más en claro
// y en oscuro) y no --accent-color (2,76 a 2,97:1 en claro).
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const color = (css, selector) => {
  const regla = css.match(new RegExp(`${selector.replace(/[.[\]()$^*+?|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return regla?.[1].match(/\bcolor:\s*([^;]+);/)?.[1].trim();
};

describe('colores de texto y de foco con contraste suficiente (H47, H48, H54, H56)', () => {
  it('el enlace del aviso de cookies usa --accent-text', () => {
    expect(color(leer('../styles/CookieConsent.css'), '.cookie-banner p a')).toBe('var(--accent-text)');
  });

  it('la etiqueta de la contraseña actual en Mi cuenta usa --accent-text', () => {
    expect(color(leer('../pages/Profile.css'), '.form-group-clean.form-group-security label')).toBe('var(--accent-text)');
  });

  it('el lema "Almacén de ideas" del modal de acceso usa --accent-text (H54)', () => {
    expect(color(leer('../styles/AuthModal.css'), '.auth-tagline')).toBe('var(--accent-text)');
  });

  // H56: estados que axe no prueba (no pasa el ratón ni pone el foco). Se busca la propiedad exacta, para que
  // "border-color" no se confunda con "color".
  const propiedad = (css, selector, nombre) => {
    const regla = css.match(new RegExp(`${selector.replace(/[.[\]()$^*+?|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    return regla?.[1].match(new RegExp(`(?:^|[;\\s])${nombre}:\\s*([^;]+);`))?.[1].trim();
  };

  it('el botón "¿Aún no eres miembro?…" del modal de acceso, al pasar el ratón, usa --accent-text (H56)', () => {
    expect(propiedad(leer('../styles/AuthModal.css'), '.auth-toggle-btn:hover', 'color')).toBe('var(--accent-text)');
  });

  it('el borde de foco de los campos del modal de acceso usa --accent-text (H56)', () => {
    expect(propiedad(leer('../styles/AuthModal.css'), '.auth-input-group input:focus', 'border-color')).toBe('var(--accent-text)');
  });

  it('--accent-text se define en claro y en oscuro', () => {
    const css = leer('../styles/index.css');
    expect(css.match(/--accent-text:\s*#[0-9A-Fa-f]{6}/g)).toHaveLength(3); // :root, oscuro por sistema y oscuro manual
  });
});
