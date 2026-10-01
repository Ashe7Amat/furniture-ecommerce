import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useScrollReveal } from './useScrollReveal';

// jsdom no tiene matchMedia ni IntersectionObserver: se simulan en cada test. El observador
// simulado guarda su callback para que el test decida cuándo "entra" el elemento en pantalla.
const Caja = () => {
  const ref = useScrollReveal();
  return <div ref={ref} data-testid="caja" />;
};
const CajaSinRef = () => {
  useScrollReveal();
  return <div data-testid="caja" />;
};

const preferirMenosMovimiento = (prefiere) =>
  vi.stubGlobal('matchMedia', vi.fn((consulta) => ({ matches: prefiere && consulta === '(prefers-reduced-motion: reduce)' })));

const instalarObservador = () => {
  const observadores = [];
  class ObservadorFalso {
    constructor(callback, opciones) {
      this.callback = callback;
      this.opciones = opciones;
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
      observadores.push(this);
    }
  }
  vi.stubGlobal('IntersectionObserver', ObservadorFalso);
  return observadores;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useScrollReveal', () => {
  it('con prefers-reduced-motion, el elemento se muestra enseguida, sin observar nada', () => {
    preferirMenosMovimiento(true);
    const observadores = instalarObservador();

    render(<Caja />);

    expect(screen.getByTestId('caja')).toHaveClass('is-in');
    expect(observadores).toHaveLength(0);
  });

  it('sin IntersectionObserver (navegadores antiguos), el elemento se muestra enseguida', () => {
    preferirMenosMovimiento(false);

    render(<Caja />);

    expect(screen.getByTestId('caja')).toHaveClass('is-in');
  });

  it('con IntersectionObserver, espera a que el elemento entre en pantalla (15% visible)', () => {
    preferirMenosMovimiento(false);
    const observadores = instalarObservador();

    render(<Caja />);
    const caja = screen.getByTestId('caja');

    expect(caja).not.toHaveClass('is-in');
    expect(observadores).toHaveLength(1);
    expect(observadores[0].opciones).toEqual({ threshold: 0.15 });
    expect(observadores[0].observe).toHaveBeenCalledWith(caja);
  });

  it('mientras no entra en pantalla no cambia nada; al entrar, se muestra y deja de observarse', () => {
    preferirMenosMovimiento(false);
    const observadores = instalarObservador();
    render(<Caja />);
    const [observador] = observadores;
    const caja = screen.getByTestId('caja');

    act(() => observador.callback([{ isIntersecting: false }]));
    expect(caja).not.toHaveClass('is-in');
    expect(observador.unobserve).not.toHaveBeenCalled();

    act(() => observador.callback([{ isIntersecting: true }]));
    expect(caja).toHaveClass('is-in');
    expect(observador.unobserve).toHaveBeenCalledWith(caja);
  });

  it('al desmontar, desconecta el observador', () => {
    preferirMenosMovimiento(false);
    const observadores = instalarObservador();
    const { unmount } = render(<Caja />);

    unmount();

    expect(observadores[0].disconnect).toHaveBeenCalled();
  });

  it('si la ref no se pone en ningún elemento, no hace nada (ni falla)', () => {
    preferirMenosMovimiento(false);
    const observadores = instalarObservador();

    render(<CajaSinRef />);

    expect(screen.getByTestId('caja')).not.toHaveClass('is-in');
    expect(observadores).toHaveLength(0);
  });
});
