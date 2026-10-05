// Catálogo: el selector "Ordenar por precio" con y sin precios (fase C). Con los precios ocultos
// (MOSTRAR_PRECIOS), todas las piezas llegan sin precio y ordenar por precio no haría nada.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Catalog from './Catalog';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getMuebles, getCategorias } from '../services/api';

vi.mock('../services/api');

const pieza = (id, nombre, precio_venta = null, precio_alquiler_dia = null) => ({
  id, nombre, categoria: 'Sillas', descripcion: '', imagenes: [], estado: 'disponible', referencia: null,
  precio_venta, precio_alquiler_dia
});
const SIN_PRECIOS = [pieza('a', 'Aparador'), pieza('b', 'Banco'), pieza('c', 'Cómoda')];

const montar = async (muebles) => {
  getMuebles.mockResolvedValue(muebles);
  getCategorias.mockResolvedValue([]);
  render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <CartContext.Provider value={{ addToCart: vi.fn() }}>
        <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn(), isFavorite: () => false }}>
          <Catalog />
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
  // CAMBIADO A PROPÓSITO (5 oct 2026, H43): el nombre de cada pieza es un h2 (antes h3, que saltaba
  // un nivel después del h1 del catálogo).
  await screen.findByRole('heading', { level: 2, name: muebles[0].nombre });
};
const selectorOrden = () => screen.queryByLabelText('Ordenar por precio');
const nombres = () => [...document.querySelectorAll('.product-title')].map((h) => h.textContent);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe('Catalog — "Ordenar por precio" (fase C)', () => {
  it('sin ningún precio en el catálogo (precios ocultos), el selector no sale', async () => {
    await montar(SIN_PRECIOS);
    expect(selectorOrden()).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Precio: Menor a Mayor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Precio: Mayor a Menor' })).not.toBeInTheDocument();
  });

  it('con precios, el selector sale con sus tres opciones y ordena', async () => {
    const user = userEvent.setup();
    await montar([pieza('a', 'Aparador', 300), pieza('b', 'Banco', 100), pieza('c', 'Cómoda', 200)]);

    expect(selectorOrden()).toBeInTheDocument();
    expect([...selectorOrden().options].map((o) => o.value)).toEqual(['recomendados', 'menor', 'mayor']);

    await user.selectOptions(selectorOrden(), 'menor');
    expect(nombres()).toEqual(['Banco', 'Cómoda', 'Aparador']);
    await user.selectOptions(selectorOrden(), 'mayor');
    expect(nombres()).toEqual(['Aparador', 'Cómoda', 'Banco']);
  });

  it('con una mezcla (algunas con precio, otras sin), el selector sale', async () => {
    await montar([pieza('a', 'Aparador'), pieza('b', 'Banco', null, 15), pieza('c', 'Cómoda')]);
    expect(selectorOrden()).toBeInTheDocument();
  });

  it('mientras carga, el selector se queda (no aparece y desaparece al llegar los datos)', async () => {
    getMuebles.mockReturnValue(new Promise(() => {}));
    getCategorias.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/catalogo']}>
        <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn(), isFavorite: () => false }}>
          <Catalog />
        </FavoritesContext.Provider>
      </MemoryRouter>
    );
    await act(async () => {}); // deja que CategorySlider reciba sus categorías (vacías)
    expect(selectorOrden()).toBeInTheDocument();
  });
});
