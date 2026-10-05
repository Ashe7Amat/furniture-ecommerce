// H40: los estados vacíos del catálogo tienen una salida y la 404 enlaza a Contacto. Los de Mi
// cuenta están en Profile.test.jsx, y "Limpiar búsqueda" en Header.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Catalog from './Catalog';
import NotFound from './NotFound';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getMuebles, getCategorias } from '../services/api';

vi.mock('../services/api');

const pieza = (id, nombre, categoria, estado = 'disponible') => ({
  id, nombre, categoria, descripcion: '', imagenes: [], estado, referencia: null,
  precio_venta: null, precio_alquiler_dia: null
});
const MUEBLES = [pieza('a', 'Aparador', 'Mesas'), pieza('b', 'Banco', 'Sillas', 'vendido')];

const RutaActual = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="ruta">{pathname + search}</span>;
};

const montarCatalogo = async (ruta, { muebles = MUEBLES } = {}) => {
  getMuebles.mockResolvedValue(muebles);
  getCategorias.mockResolvedValue([]);
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <CartContext.Provider value={{ addToCart: vi.fn() }}>
        <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn(), isFavorite: () => false }}>
          <Routes>
            <Route path="*" element={<><Catalog /><RutaActual /></>} />
          </Routes>
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe('Catálogo — estados vacíos (H40)', () => {
  it('una categoría sin piezas ofrece "Ver todo el catálogo", que quita el filtro y enseña todo', async () => {
    const user = userEvent.setup();
    await montarCatalogo('/catalogo?categoria=Lámparas');

    expect(await screen.findByRole('heading', { name: 'No hay productos en esta categoría' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todo el catálogo' }));

    expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/catalogo$/);
    expect(await screen.findByRole('heading', { level: 3, name: 'Aparador' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Banco' })).toBeInTheDocument();
  });

  it('sin favoritos: corazón en vez de caja y "Explorar catálogo", que lleva al catálogo completo', async () => {
    const user = userEvent.setup();
    await montarCatalogo('/catalogo?favorites=true');

    const titulo = await screen.findByRole('heading', { name: 'Aún no tienes favoritos' });
    expect(titulo.closest('.empty-state')).toHaveClass('empty-state--favoritos');
    await user.click(screen.getByRole('button', { name: 'Explorar catálogo' }));

    expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/catalogo$/);
    expect(await screen.findByRole('heading', { level: 3, name: 'Aparador' })).toBeInTheDocument();
  });

  it('"Ver todo el catálogo" también quita el filtro "Disponible"', async () => {
    const user = userEvent.setup();
    await montarCatalogo('/catalogo?categoria=Sillas');
    expect(await screen.findByRole('heading', { level: 3, name: 'Banco' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Disponible' }));
    expect(screen.getByRole('heading', { name: 'No hay productos en esta categoría' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todo el catálogo' }));

    expect(screen.getByRole('checkbox', { name: 'Disponible' })).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 3, name: 'Banco' })).toBeInTheDocument();
  });

  it('si el catálogo entero está vacío no hay filtro que quitar: sin botón', async () => {
    await montarCatalogo('/catalogo', { muebles: [] });

    expect(await screen.findByRole('heading', { name: 'No hay productos en esta categoría' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver todo el catálogo' })).not.toBeInTheDocument();
  });
});

describe('404 (H40)', () => {
  it('enlaza al inicio, al catálogo y a Contacto', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Ver el catálogo completo →' })).toHaveAttribute('href', '/catalogo');
    expect(screen.getByRole('link', { name: 'Escríbenos' })).toHaveAttribute('href', '/contacto');
  });
});
