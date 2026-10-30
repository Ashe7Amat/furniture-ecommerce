import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Logo from './Logo';
import { BRAND } from '../theme/brand.config';

// El logotipo de la cabecera lo elige la marca (BRAND.logo): el dibujo de theme/LogoDibujo.jsx o el
// nombre corto en texto. Se prueban los dos cambiando el campo, y se deja como estaba.
const logoDeLaMarca = BRAND.logo;
afterEach(() => {
  BRAND.logo = logoDeLaMarca;
});

const pintar = () => render(<Logo className="logo-svg" />).container.firstChild;

describe('Logo', () => {
  it("con logo 'dibujo' pinta el SVG de la marca, decorativo y en el color del texto", () => {
    BRAND.logo = 'dibujo';
    const logo = pintar();
    expect(logo.tagName.toLowerCase()).toBe('svg');
    expect(logo).toHaveClass('logo-svg');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo).toHaveAttribute('fill', 'currentColor');
    expect(logo.textContent).toBe('');
  });

  it("con logo 'texto' pinta el nombre corto de brand.config.js, decorativo", () => {
    BRAND.logo = 'texto';
    const logo = pintar();
    expect(logo.tagName.toLowerCase()).toBe('span');
    expect(logo).toHaveClass('logo-svg', 'logo-texto');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo.textContent).toBe(BRAND.nombreCorto);
    expect(logo.querySelector('svg')).toBeNull();
  });

  it('sin clase, el logo en texto lleva solo la suya', () => {
    BRAND.logo = 'texto';
    const { container } = render(<Logo />);
    expect(container.firstChild.className).toBe('logo-texto');
  });

  it('la marca dice qué logo usa', () => {
    expect(['dibujo', 'texto']).toContain(logoDeLaMarca);
  });
});
