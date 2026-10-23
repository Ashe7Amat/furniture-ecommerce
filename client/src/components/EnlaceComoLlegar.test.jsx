import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EnlaceComoLlegar from './EnlaceComoLlegar';
import Footer from './Footer';
import Contact from '../pages/Contact';
import { AuthContext } from '../context/AuthContext';
import { URL_COMO_LLEGAR } from '../utils/direccion';

const comoLlegar = () => screen.getByRole('link', { name: /Cómo llegar/ });

describe('EnlaceComoLlegar', () => {
  it('abre la dirección de la nave en Google Maps, en otra pestaña y sin acceso a esta', () => {
    render(<EnlaceComoLlegar />);
    const enlace = comoLlegar();
    expect(enlace).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Carrer%20del%20Plom%2C%2032-34%2C%2008038%20Barcelona');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    expect(enlace).toHaveAccessibleName(/se abre en otra pestaña/);
  });

  it('no incrusta ningún mapa: la página no carga nada de Google hasta que se pulsa', () => {
    const { container } = render(<EnlaceComoLlegar />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('sale en el pie de página y en Contacto', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: null }}>
          <Footer />
        </AuthContext.Provider>
      </MemoryRouter>
    );
    expect(comoLlegar()).toHaveAttribute('href', URL_COMO_LLEGAR);
    unmount();

    render(
      <MemoryRouter initialEntries={['/contacto']}>
        <Contact />
      </MemoryRouter>
    );
    expect(comoLlegar()).toHaveAttribute('href', URL_COMO_LLEGAR);
  });
});
