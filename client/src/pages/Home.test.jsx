import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { getMuebles, getCategorias } from '../services/api';

vi.mock('../services/api', () => ({
  getMuebles: vi.fn(),
  getCategorias: vi.fn()
}));

const renderHome = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
  });
};

beforeEach(() => {
  // jsdom no implementa matchMedia (lo usa useScrollReveal).
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  getCategorias.mockResolvedValue([]);
  getMuebles.mockResolvedValue([]);
});

describe('Home — hero', () => {
  it('el título es "Nave 5" con "Barcelona" en su propia línea, y sigue leyéndose entero', async () => {
    await renderHome();
    const titulo = screen.getByRole('heading', { level: 1, name: 'Nave 5 Barcelona' });
    expect(titulo.querySelector('.hero-title-ciudad')).toHaveTextContent('Barcelona');
    expect(screen.getByText('Almacén de ideas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descubrir' })).toHaveAttribute('href', '/catalogo');
  });

  it('el hero va fuera de .home-page (a todo el ancho) y el resto de secciones dentro', async () => {
    await renderHome();
    const hero = document.querySelector('.home-hero');
    expect(hero.closest('.home-page')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Piezas destacadas' }).closest('.home-page')).not.toBeNull();
  });

  it('los puntos del slider cambian la foto activa', async () => {
    const user = userEvent.setup();
    await renderHome();
    const fotos = () => [...document.querySelectorAll('.hero-slide-img')];
    expect(fotos()[0]).toHaveClass('is-active');

    await user.click(screen.getByRole('button', { name: 'Ver foto 3 de 4' }));
    expect(fotos()[2]).toHaveClass('is-active');
    expect(fotos()[0]).not.toHaveClass('is-active');
    expect(screen.getByRole('button', { name: 'Ver foto 3 de 4' })).toHaveAttribute('aria-current', 'true');
  });
});

describe('Home — categorías (accesibilidad)', () => {
  it('cada categoría general es un enlace a su catálogo, con su nombre (la foto no lo repite)', async () => {
    getCategorias.mockResolvedValue([
      { id: 1, nombre: 'Mobiliario', categoria_padre_id: null, imagen_url: '/img/m.webp' },
      { id: 2, nombre: 'Sillas', categoria_padre_id: 1, imagen_url: null }
    ]);
    await renderHome();

    const enlace = screen.getByRole('link', { name: 'Mobiliario' });
    expect(enlace).toHaveAttribute('href', '/catalogo?categoria=Mobiliario');
    expect(enlace.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('link', { name: 'Sillas' })).not.toBeInTheDocument();
  });
});
