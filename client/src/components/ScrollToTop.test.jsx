import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';

afterEach(() => {
  vi.restoreAllMocks();
});

const pintar = () =>
  render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <ScrollToTop />
      <Link to="/mueble/m1">Ver ficha</Link>
      <Link to="/catalogo?categoria=Sillas">Filtrar</Link>
      <Routes>
        <Route path="*" element={<p>Página</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('ScrollToTop', () => {
  it('al cambiar de página sube arriba del todo al momento, sin animación', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    pintar();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });

    fireEvent.click(screen.getByRole('link', { name: 'Ver ficha' }));

    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('si solo cambia la query (p. ej. un filtro del catálogo), no mueve la página', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    pintar();

    fireEvent.click(screen.getByRole('link', { name: 'Filtrar' }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
