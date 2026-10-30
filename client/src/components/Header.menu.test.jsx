// Cabecera: el menú lateral (enlaces, submenú de productos con «Volver» y cerrar), el menú de la
// cuenta al pulsar fuera y el buscador con piezas solo de alquiler o un catálogo que no llega.
// El resto está en Header.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './Header';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getCategorias, getMuebles } from '../services/api';

vi.mock('../services/api', () => ({
  getCategorias: vi.fn(),
  getMuebles: vi.fn()
}));

const Ruta = () => <span data-testid="ruta">{useLocation().pathname}</span>;

const pintar = async ({ user = null } = {}) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={{ user, logout: vi.fn(), login: vi.fn(), loading: false }}>
          <ToastContext.Provider value={{ showToast: vi.fn() }}>
            <FavoritesContext.Provider
              value={{
                favorites: [],
                toggleFavorite: vi.fn(),
                isFavorite: () => false
              }}
            >
              <CartContext.Provider value={{ cartItems: [], toggleCart: vi.fn() }}>
                <Routes>
                  <Route
                    path="*"
                    element={
                      <>
                        <Header />
                        <Ruta />
                      </>
                    }
                  />
                </Routes>
              </CartContext.Provider>
            </FavoritesContext.Provider>
          </ToastContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  });
};

const panel = (clase) => document.querySelector(`.mega-menu-panel.${clase}`);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // jsdom no implementa matchMedia (el tema inicial lo usa).
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
  getCategorias.mockResolvedValue([
    { id: 1, nombre: 'Sillas', categoria_padre_id: null },
    { id: 2, nombre: 'Sillas de bistró', categoria_padre_id: 1 }
  ]);
  getMuebles.mockResolvedValue([]);
});

describe('Header — menú lateral', () => {
  it('«Novedades» e «Inspiración» navegan y cierran el menú', async () => {
    await pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    expect(panel('primary-panel')).toHaveClass('open');
    fireEvent.click(screen.getByRole('button', { name: 'Novedades' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/catalogo');
    expect(panel('primary-panel')).not.toHaveClass('open');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspiración' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/sobre-nosotros');
  });

  it('el submenú de productos vuelve con «‹ Volver» y se cierra con su cruz', async () => {
    await pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    expect(panel('secondary-panel')).toHaveClass('open');
    expect(panel('primary-panel')).toHaveClass('shifted');

    fireEvent.click(screen.getByRole('button', { name: '‹ Volver' }));
    expect(panel('secondary-panel')).not.toHaveClass('open');

    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    fireEvent.click(
      within(panel('secondary-panel')).getByRole('button', {
        name: 'Cerrar el menú'
      })
    );
    expect(panel('secondary-panel')).not.toHaveClass('open');
    expect(panel('primary-panel')).not.toHaveClass('open');
  });

  it('una categoría específica lleva al catálogo filtrado por ella', async () => {
    await pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    fireEvent.click(
      within(panel('secondary-panel')).getByRole('button', {
        name: 'Sillas de bistró'
      })
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/catalogo');
    expect(panel('secondary-panel')).not.toHaveClass('open');
  });
});

describe('Header — menú de la cuenta', () => {
  it('se cierra al pulsar fuera, no al pulsar dentro', async () => {
    await pintar({ user: { email: 'ana@ejemplo.com', rol: 'cliente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta' }));
    expect(screen.getByText('Mi Cuenta')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Mi Cuenta'));
    expect(screen.getByText('Mi Cuenta')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Mi Cuenta')).not.toBeInTheDocument();
  });
});

describe('Header — buscador', () => {
  it('una pieza solo de alquiler enseña su precio por día; una sin precios, nada', async () => {
    getMuebles.mockResolvedValue([
      {
        id: 'a',
        nombre: 'Silla de alquiler',
        categoria: 'Sillas',
        precio_alquiler_dia: 12
      },
      { id: 'b', nombre: 'Silla sin precio', categoria: 'Sillas' }
    ]);
    await pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en el catálogo' }), {
      target: { value: 'silla' }
    });
    const resultados = document.querySelectorAll('.search-live-item');
    expect(resultados).toHaveLength(2);
    expect(resultados[0].querySelector('.search-live-price')).toHaveTextContent('12 €/día');
    expect(resultados[1].querySelector('.search-live-price')).toHaveTextContent('');
  });

  it('si el catálogo no llega como lista, no hay resultados', async () => {
    getMuebles.mockResolvedValue(null);
    await pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en el catálogo' }), {
      target: { value: 'silla' }
    });
    expect(screen.getByText(/No se encontraron resultados/)).toBeInTheDocument();
  });
});
