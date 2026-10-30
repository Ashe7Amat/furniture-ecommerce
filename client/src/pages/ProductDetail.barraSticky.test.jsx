// Ficha de un mueble: la barra inferior que aparece al pasar de largo el botón principal (con
// IntersectionObserver o, sin él, con el scroll), las fotos .webp cuando están optimizadas y una
// disponibilidad que falla de forma inesperada. El resto está en ProductDetail.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebleById, getDisponibilidad } from '../services/api';

vi.mock('../services/api');

const MUEBLE = {
  id: 'a1b2c3d4-0000-4000-8000-000000000000',
  nombre: 'Aparador de roble',
  categoria: 'Mesas y mobiliario',
  descripcion: 'Restaurado en el taller',
  precio_venta: 1250,
  precio_alquiler_dia: 40,
  imagenes: ['https://img.test/1.jpg', 'https://img.test/2.jpg'],
  estado: 'disponible',
  referencia: 'NAV-MES-004'
};

const montar = async (mueble = MUEBLE) => {
  getMuebleById.mockResolvedValue(mueble);
  const user = userEvent.setup();
  const { unmount } = render(
    <MemoryRouter initialEntries={[`/mueble/${mueble.id}`]}>
      <CartContext.Provider value={{ addToCart: vi.fn(), cestaLlena: false }}>
        <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
          <Routes>
            <Route path="/mueble/:id" element={<ProductDetail />} />
          </Routes>
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { level: 1 });
  return { user, unmount };
};

const barra = () => screen.queryByRole('complementary', { name: 'Acciones del producto' });

// IntersectionObserver falso: guarda el callback para lanzarlo a mano.
let observadores;
class ObservadorFalso {
  constructor(callback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    observadores.push(this);
  }
  observe() {}
}
const cruzar = (isIntersecting, top) =>
  act(() => {
    observadores.at(-1).callback([{ isIntersecting, boundingClientRect: { top } }]);
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_RESERVAS_ACTIVAS', '');
  observadores = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--alto-barra-sticky');
});

describe('ProductDetail — barra inferior con IntersectionObserver', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
  });

  it('aparece solo al pasar de largo el botón principal, y deja sitio a la barra de admin', async () => {
    const { user } = await montar();
    expect(barra()).not.toBeInTheDocument();

    // Todavía por debajo de la pantalla: no sale.
    cruzar(false, 900);
    expect(barra()).not.toBeInTheDocument();

    cruzar(false, -50);
    expect(barra()).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--alto-barra-sticky')).toBe('72px');
    expect(document.querySelector('.pd-container')).toHaveClass('con-barra-sticky');
    expect(within(barra()).getByText('Ref. NAV-MES-004')).toBeInTheDocument();
    expect(within(barra()).getByRole('img')).toHaveAttribute('src', 'https://img.test/1.jpg');

    await user.click(within(barra()).getByRole('button', { name: 'Solicitar información' }));
    expect(screen.getByRole('dialog', { name: 'Solicitar información' })).toBeInTheDocument();

    cruzar(true, 10);
    expect(barra()).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--alto-barra-sticky')).toBe('');
  });

  it('una pieza vendida dice «Agotado»; sin referencia no la enseña', async () => {
    await montar({ ...MUEBLE, estado: 'vendido', referencia: null });
    cruzar(false, -1);
    expect(within(barra()).getByRole('button', { name: 'Agotado' })).toBeDisabled();
    expect(within(barra()).queryByText(/Ref\./)).not.toBeInTheDocument();
  });

  it('una pieza alquilada dice «Alquilado»', async () => {
    await montar({ ...MUEBLE, estado: 'alquilado' });
    cruzar(false, -1);
    expect(within(barra()).getByRole('button', { name: 'Alquilado' })).toBeDisabled();
  });

  it('al salir de la ficha deja de observar', async () => {
    const { unmount } = await montar();
    const observador = observadores.at(-1);
    unmount();
    expect(observador.disconnect).toHaveBeenCalled();
  });
});

describe('ProductDetail — barra inferior sin IntersectionObserver', () => {
  it('se decide con el scroll según dónde queda el botón principal', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    await montar();
    const cta = document.querySelector('.pd-actions-form');

    cta.getBoundingClientRect = () => ({ bottom: 300 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(barra()).not.toBeInTheDocument();

    cta.getBoundingClientRect = () => ({ bottom: -10 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(barra()).toBeInTheDocument();
  });
});

describe('ProductDetail — fotos .webp optimizadas', () => {
  it('con VITE_WEBP_OPTIMIZADAS, la foto principal y las miniaturas llevan sus variantes .webp', async () => {
    vi.stubEnv('VITE_WEBP_OPTIMIZADAS', 'true');
    await montar();
    const principal = document.querySelector('.pd-main-image-picture source');
    expect(principal).toHaveAttribute(
      'srcset',
      'https://img.test/1-400.webp 400w, https://img.test/1-800.webp 800w, https://img.test/1-1200.webp 1200w'
    );
    const miniaturas = document.querySelectorAll('.pd-thumbnail-picture source');
    expect(miniaturas).toHaveLength(2);
    expect(miniaturas[1]).toHaveAttribute('srcset', 'https://img.test/2-400.webp 400w');
  });

  it('una foto SVG no tiene variantes: <img> sin <picture>', async () => {
    vi.stubEnv('VITE_WEBP_OPTIMIZADAS', 'true');
    await montar({ ...MUEBLE, imagenes: ['https://img.test/1.svg', 'https://img.test/2.svg'] });
    expect(document.querySelector('picture')).toBeNull();
    expect(document.querySelectorAll('.pd-thumbnail-img')).toHaveLength(2);
  });
});

describe('ProductDetail — disponibilidad con las reservas encendidas', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
  });

  it('si la petición se rechaza, la ficha sigue sin calendario', async () => {
    getDisponibilidad.mockRejectedValue(new Error('red'));
    await montar();
    await waitFor(() => expect(getDisponibilidad).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole('region', { name: 'Alquilar por fechas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
  });

  it('si la función no devuelve una promesa, no se rompe', async () => {
    getDisponibilidad.mockReturnValue(undefined);
    await montar();
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
  });
});
