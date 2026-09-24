import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './Header';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getCategorias, getMuebles } from '../services/api';

// getCategorias/getMuebles llaman a fetch contra la API real -- se mockean siempre, igual
// que Stripe/Resend/Supabase en el servidor.
vi.mock('../services/api', () => ({
  getCategorias: vi.fn().mockResolvedValue([]),
  getMuebles: vi.fn().mockResolvedValue([])
}));

// Muestra la ruta actual como texto, para comprobar los navigate() del Header (logout,
// resultados de búsqueda) sin tener que mockear react-router-dom.
const MarcadorDeRuta = () => <span data-testid="ruta-actual">{useLocation().pathname}</span>;

const renderHeader = async ({
  user = null,
  logout = vi.fn(),
  showToast = vi.fn(),
  favorites = [],
  cartItems = [],
  toggleCart = vi.fn(),
  ruta = '/'
} = {}) => {
  let utils;
  // El Header carga las categorías al montar (getCategorias().then(...)); se envuelve en un
  // act async para que esa promesa (ya resuelta, mockeada) se asiente antes de comprobar nada.
  await act(async () => {
    utils = render(
      <MemoryRouter initialEntries={[ruta]}>
        <AuthContext.Provider value={{ user, logout, login: vi.fn(), loading: false }}>
          <ToastContext.Provider value={{ showToast }}>
            <FavoritesContext.Provider value={{ favorites, toggleFavorite: vi.fn(), isFavorite: () => false }}>
              <CartContext.Provider value={{ cartItems, toggleCart }}>
                <Routes>
                  <Route path="*" element={<><Header /><MarcadorDeRuta /></>} />
                </Routes>
              </CartContext.Provider>
            </FavoritesContext.Provider>
          </ToastContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  });
  return { ...utils, showToast, logout, toggleCart };
};

beforeEach(() => {
  localStorage.clear();
  // jsdom no implementa matchMedia -- lo necesita el estado inicial del tema.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  getCategorias.mockResolvedValue([]);
  getMuebles.mockResolvedValue([]);
});

describe('Header — sesión', () => {
  it('sin usuario logueado, muestra el enlace a "Cuenta" (login), no un nombre', async () => {
    await renderHeader({ user: null });
    expect(screen.getByRole('link', { name: 'Cuenta' })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/^Hola,/)).not.toBeInTheDocument();
  });

  it('con usuario logueado con nombre, saluda por el nombre', async () => {
    await renderHeader({ user: { email: 'ana@example.com', nombre: 'Ana', rol: 'cliente' } });
    expect(screen.getByText('Hola, Ana')).toBeInTheDocument();
  });

  it('con usuario logueado sin nombre, saluda con la parte del email antes de la @', async () => {
    await renderHeader({ user: { email: 'buyer99@example.com', rol: 'cliente' } });
    expect(screen.getByText('Hola, buyer99')).toBeInTheDocument();
  });

  it('el menú de cuenta muestra "Panel Admin" solo si el usuario es admin', async () => {
    const user = userEvent.setup();
    await renderHeader({ user: { email: 'a@a.com', nombre: 'Admin', rol: 'admin' } });

    await user.click(screen.getByRole('button', { name: 'Cuenta' }));
    expect(screen.getByText('Panel Admin')).toBeInTheDocument();
  });

  it('sin rol admin, el menú de cuenta no ofrece "Panel Admin"', async () => {
    const user = userEvent.setup();
    await renderHeader({ user: { email: 'c@c.com', nombre: 'Cliente', rol: 'cliente' } });

    await user.click(screen.getByRole('button', { name: 'Cuenta' }));
    expect(screen.queryByText('Panel Admin')).not.toBeInTheDocument();
  });

  it('"Cerrar Sesión" llama a logout(), avisa con un toast y navega al inicio', async () => {
    const user = userEvent.setup();
    const { showToast, logout } = await renderHeader({
      user: { email: 'c@c.com', nombre: 'Cliente', rol: 'cliente' },
      ruta: '/cuenta'
    });

    await user.click(screen.getByRole('button', { name: 'Cuenta' }));
    await user.click(screen.getByText('Cerrar Sesión'));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Sesión cerrada'), 'success');
    expect(screen.getByTestId('ruta-actual')).toHaveTextContent('/');
  });
});

describe('Header — favoritos y cesta', () => {
  it('sin favoritos, no muestra la insignia', async () => {
    await renderHeader({ favorites: [] });
    const enlace = screen.getByRole('link', { name: 'Favoritos' });
    expect(within(enlace).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('con favoritos, muestra la insignia con la cantidad', async () => {
    await renderHeader({ favorites: ['m1', 'm2'] });
    expect(within(screen.getByRole('link', { name: 'Favoritos' })).getByText('2')).toBeInTheDocument();
  });

  it('con la cesta vacía, no muestra la insignia', async () => {
    await renderHeader({ cartItems: [] });
    expect(within(screen.getByRole('button', { name: 'Cesta' })).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('con productos en la cesta, muestra la cantidad y el clic llama a toggleCart', async () => {
    const user = userEvent.setup();
    const { toggleCart } = await renderHeader({ cartItems: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });

    const boton = screen.getByRole('button', { name: 'Cesta' });
    expect(within(boton).getByText('3')).toBeInTheDocument();

    await user.click(boton);
    expect(toggleCart).toHaveBeenCalledTimes(1);
  });
});

describe('Header — tema claro/oscuro', () => {
  it('sin tema guardado ni preferencia del sistema, arranca en modo claro', async () => {
    await renderHeader();
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('con "dark" guardado en localStorage, arranca en modo oscuro', async () => {
    localStorage.setItem('nave5Theme', 'dark');
    await renderHeader();
    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('al pulsar el botón de tema, cambia de claro a oscuro y lo guarda en localStorage', async () => {
    const user = userEvent.setup();
    await renderHeader();

    await user.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }));

    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('nave5Theme')).toBe('dark');
  });
});

describe('Header — buscador', () => {
  it('al abrir el buscador, carga el catálogo una sola vez', async () => {
    const user = userEvent.setup();
    await renderHeader();

    await user.click(screen.getByText('¿Qué estás buscando?'));

    expect(getMuebles).toHaveBeenCalledTimes(1);
  });

  it('filtra los resultados por nombre sin distinguir mayúsculas, y al elegir uno navega a su ficha', async () => {
    getMuebles.mockResolvedValue([
      { id: 'm1', nombre: 'Silla de roble', categoria: 'Sillas', precio_venta: 90 },
      { id: 'm2', nombre: 'Mesa de centro', categoria: 'Mesas', precio_venta: 120 }
    ]);
    const user = userEvent.setup();
    await renderHeader({ ruta: '/catalogo' });

    await user.click(screen.getByText('¿Qué estás buscando?'));
    const input = screen.getByPlaceholderText('¿Qué estás buscando?');
    await user.type(input, 'SILLA');

    expect(screen.getByText('Silla de roble')).toBeInTheDocument();
    expect(screen.queryByText('Mesa de centro')).not.toBeInTheDocument();

    await user.click(screen.getByText('Silla de roble'));

    expect(screen.getByTestId('ruta-actual')).toHaveTextContent('/producto/m1');
  });

  it('sin coincidencias, muestra un mensaje de "no encontrado" con el término buscado', async () => {
    getMuebles.mockResolvedValue([{ id: 'm1', nombre: 'Silla de roble', categoria: 'Sillas' }]);
    const user = userEvent.setup();
    await renderHeader();

    await user.click(screen.getByText('¿Qué estás buscando?'));
    await user.type(screen.getByPlaceholderText('¿Qué estás buscando?'), 'armario');

    expect(screen.getByText(/No se encontraron resultados/)).toBeInTheDocument();
    expect(screen.getByText('armario')).toBeInTheDocument();
  });
});
