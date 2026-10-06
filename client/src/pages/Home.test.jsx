import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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
    // CAMBIADO A PROPÓSITO (6 oct 2026, H49): ya no hay una <img> por foto desde el principio (solo la que se
    // ve y las ya vistas), así que las fotos se buscan por su archivo y no por su posición.
    const foto = (archivo) => document.querySelector(`.hero-slide-img[src="/img/${archivo}.webp"]`);
    expect(foto('hero-almacen')).toHaveClass('is-active');

    await user.click(screen.getByRole('button', { name: 'Ver foto 3 de 4' }));
    expect(foto('hero-sillones')).toHaveClass('is-active');
    expect(foto('hero-almacen')).not.toHaveClass('is-active');
    expect(screen.getByRole('button', { name: 'Ver foto 3 de 4' })).toHaveAttribute('aria-current', 'true');
  });
});

describe('Home — fotos del hero por tamaño de pantalla (H42)', () => {
  it('cada foto es un <picture>: 800 px en el móvil, 1200 px hasta 1200 de pantalla y el original por encima', async () => {
    await renderHome();
    // CAMBIADO A PROPÓSITO (6 oct 2026, H49): las fotos solo existen cuando se piden. Se enseñan las cuatro
    // pulsando sus puntos, para comprobar la estructura de cada una.
    for (const n of [2, 3, 4]) fireEvent.click(screen.getByRole('button', { name: `Ver foto ${n} de 4` }));
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
    for (const n of [2, 3, 4]) fireEvent.click(screen.getByRole('button', { name: `Ver foto ${n} de 4` }));
    const imgs = [...document.querySelectorAll('.hero-slide-img')];

    expect(imgs[0]).toHaveAttribute('fetchpriority', 'high');
    expect(imgs[0]).not.toHaveAttribute('loading');
    expect(imgs.slice(1).every((img) => img.getAttribute('loading') === 'lazy')).toBe(true);
  });
});

describe('Home — las fotos del hero se piden cuando hacen falta (H49)', () => {
  const imgs = () => [...document.querySelectorAll('.hero-slide-img')].map((i) => i.getAttribute('src').replace('/img/hero-', '').replace('.webp', ''));
  const activa = () => document.querySelector('.hero-slide-img.is-active').getAttribute('src').replace('/img/hero-', '').replace('.webp', '');
  const pasar = (ms) => act(() => { vi.advanceTimersByTime(ms); });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('al cargar solo hay la primera foto (y su versión de móvil como <source>): no se piden las otras tres', async () => {
    await renderHome();

    expect(imgs()).toEqual(['almacen']);
    expect(document.querySelectorAll('.hero-image-box picture')).toHaveLength(1);
    expect(document.querySelector('.hero-image-box source').getAttribute('srcset')).toBe('/img/hero-almacen-800.webp');
    // Y ninguna de las otras fotos aparece en ningún atributo del documento.
    for (const otra of ['aerea', 'sillones', 'showroom']) expect(document.body.innerHTML).not.toContain(`hero-${otra}`);
  });

  it('la siguiente se pide 3 s después de mostrar la actual, antes de que le toque (a los 5,5 s)', async () => {
    await renderHome();

    await pasar(2900);
    expect(imgs()).toEqual(['almacen']);

    await pasar(200); // 3,1 s
    expect(imgs()).toEqual(['almacen', 'aerea']);
    expect(activa()).toBe('almacen'); // pedida, pero todavía no se ve

    await pasar(2500); // 5,6 s: le toca
    expect(activa()).toBe('aerea');
    expect(imgs()).toEqual(['almacen', 'aerea']); // la anterior se queda (el fundido de salida)
  });

  it('cada cambio pide la siguiente: tras mostrar la 2.ª, a los 3 s se pide la 3.ª', async () => {
    await renderHome();
    await pasar(5600); // ya se ve la 2.ª
    expect(imgs()).toEqual(['almacen', 'aerea']);

    await pasar(3100);
    expect(imgs()).toEqual(['almacen', 'aerea', 'sillones']);
    expect(activa()).toBe('aerea');
  });

  it('al pulsar el punto de una foto que no se había pedido, sale en ese mismo momento', async () => {
    await renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Ver foto 4 de 4' }));

    expect(activa()).toBe('showroom');
    expect(imgs()).toEqual(['almacen', 'showroom']); // la que se veía se queda, para el fundido
  });

  it('las que ya se han visto no se quitan: no se vuelven a pedir al dar la vuelta', async () => {
    await renderHome();
    // Una vuelta entera, intervalo a intervalo (de golpe, React agruparía los cuatro cambios en uno: en el
    // navegador cada cambio es una tarea distinta).
    for (let i = 0; i < 4; i += 1) await pasar(5500);

    expect(activa()).toBe('almacen');
    expect(imgs().sort()).toEqual(['aerea', 'almacen', 'showroom', 'sillones']);
    expect(document.querySelectorAll('.hero-image-box picture')).toHaveLength(4);
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
