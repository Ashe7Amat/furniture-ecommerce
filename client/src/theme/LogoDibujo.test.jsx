import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LogoDibujo from './LogoDibujo';

// El logotipo dibujado de Nave 5 (components/Logo.jsx lo pinta si BRAND.logo es 'dibujo') es un SVG
// decorativo: el nombre accesible lo pone el enlace del Header. Se comprueba la forma del dibujo que
// importa para que se vea bien: viewBox ajustado, solo rellenos y la A sin el hueco de abajo como
// subcamino aparte (dejaba una línea bajo la A). Un cliente con otro dibujo cambia este test con él.
const pintar = () => render(<LogoDibujo className="logo-svg" />).container.querySelector('svg');

describe('LogoDibujo', () => {
  it('se pinta como SVG decorativo, con la clase recibida y el color del texto', () => {
    const svg = pintar();
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('logo-svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg.textContent).toBe('');
  });

  it('el viewBox está ajustado al dibujo: empieza en 0 0', () => {
    const [x, y] = pintar().getAttribute('viewBox').split(' ').map(Number);
    expect([x, y]).toEqual([0, 0]);
  });

  it('una forma rellena por cada letra y el 5, sin trazos con grosor', () => {
    const svg = pintar();
    const formas = svg.querySelectorAll('path');
    expect(formas).toHaveLength(5);
    for (const forma of formas) {
      expect(forma).not.toHaveAttribute('stroke');
      expect(forma).not.toHaveAttribute('fill', 'none');
    }
  });

  it('la A tiene solo dos subcaminos: el contorno (con el hueco de abajo incluido) y el ojo', () => {
    const a = pintar().querySelectorAll('path')[1];
    expect(a).toHaveAttribute('fill-rule', 'evenodd');
    expect(a.getAttribute('d').match(/M/g)).toHaveLength(2);
  });
});
