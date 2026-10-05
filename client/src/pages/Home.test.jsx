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

describe('Home — fotos del hero por tamaño de pantalla (H42)', () => {
  it('cada foto es un <picture>: 800 px en el móvil, 1200 px hasta 1200 de pantalla y el original por encima', async () => {
    await renderHome();
    const fotos = [...document.querySelectorAll('.hero-image-box picture')].map((picture) => ({
      fuentes: [...picture.querySelectorAll('source')].map((s) => [s.getAttribute('media'), s.getAttribute('srcset')]),
      img: picture.querySelector('img.hero-slide-img').getAttribute('src')
    }));

    const MOVIL = '(max-width: 767.98px)';
    const TABLETA = '(max-width: 1200px)';
    expect(fotos).toEqual([
      {
        fuentes: [[MOVIL, '/img/hero-almacen-800.webp'], [TABLETA, '/img/hero-almacen-1200.webp']],
        img: '/img/hero-almacen.webp'
      },
      {
        fuentes: [[MOVIL, '/img/hero-aerea-800.webp'], [TABLETA, '/img/hero-aerea-1200.webp']],
        img: '/img/hero-aerea.webp'
      },
      {
        fuentes: [[MOVIL, '/img/hero-sillones-800.webp'], [TABLETA, '/img/hero-sillones-1200.webp']],
        img: '/img/hero-sillones.webp'
      },
      // Vertical y de 1200 de ancho: sin versión de 1200, hasta 1200 de pantalla sirve el original.
      { fuentes: [[MOVIL, '/img/hero-showroom-800.webp']], img: '/img/hero-showroom.webp' }
    ]);
  });

  it('la primera foto sigue pidiéndose con prioridad alta y sin carga diferida; las demás, diferidas', async () => {
    await renderHome();
    const imgs = [...document.querySelectorAll('.hero-slide-img')];

    expect(imgs[0]).toHaveAttribute('fetchpriority', 'high');
    expect(imgs[0]).not.toHaveAttribute('loading');
    expect(imgs.slice(1).every((img) => img.getAttribute('loading') === 'lazy')).toBe(true);
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
