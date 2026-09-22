import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductsTable from './ProductsTable';
import ProductCard from './ProductCard';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';

// Contextos "de mentira", igual que en ProductCard.test.jsx: QuickViewModal (montado por
// ProductsTable al abrir la vista rápida) usa CartContext y FavoritesContext directamente
// por useContext, así que sin un Provider (aunque sea de mentira) rompería al desestructurar
// `undefined`.
const cartContext = { addToCart: vi.fn() };
const favContext = { toggleFavorite: vi.fn(), isFavorite: () => false };

const renderProductsTable = (productos) =>
  render(
    <MemoryRouter>
      <CartContext.Provider value={cartContext}>
        <FavoritesContext.Provider value={favContext}>
          <ProductsTable productos={productos} />
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );

const productosDePrueba = [
  {
    id: '1',
    nombre: 'Baúl de viaje',
    categoria: 'Baúles',
    descripcion: 'Restaurado a mano',
    precio_venta: 110,
    estado: 'disponible',
    imagenes: [],
  },
  {
    id: '2',
    nombre: 'Silla nórdica',
    categoria: 'Sillas',
    descripcion: 'De roble',
    precio_alquiler_dia: 8,
    estado: 'alquilado',
    imagenes: [],
  },
];

describe('ProductsTable', () => {
  it('renderiza los mismos productos que la cuadrícula (ProductCard) para los mismos datos', () => {
    const { unmount } = renderProductsTable(productosDePrueba);
    productosDePrueba.forEach((p) => {
      expect(screen.getByText(p.nombre)).toBeInTheDocument();
    });
    unmount();

    render(
      <MemoryRouter>
        <CartContext.Provider value={cartContext}>
          <FavoritesContext.Provider value={favContext}>
            {productosDePrueba.map((p) => <ProductCard key={p.id} mueble={p} />)}
          </FavoritesContext.Provider>
        </CartContext.Provider>
      </MemoryRouter>
    );
    productosDePrueba.forEach((p) => {
      expect(screen.getByText(p.nombre)).toBeInTheDocument();
    });
  });

  it('muestra el precio exacto, sin duplicar el símbolo € (formatPrice no lo incluye)', () => {
    // Bug concreto que se comprueba aquí: formatPrice (utils/format.js) devuelve solo el
    // número (toLocaleString sin `style: 'currency'`), así que el " €"/" €/día" lo añade
    // este componente -- si formatPrice alguna vez empezara a incluirlo, este test lo
    // pillaría como "110 € €" en vez de fallar en silencio.
    renderProductsTable(productosDePrueba);
    const filas = screen.getAllByRole('row'); // [cabecera, Baúl de viaje, Silla nórdica]

    const filaBaul = filas[1];
    expect(filaBaul.querySelector('.products-table-col-precio').textContent).toBe('110 €');
    expect(filaBaul.querySelector('.products-table-col-alquiler').textContent).toBe('—');
    expect(filaBaul.querySelector('.products-table-col-precio-movil').textContent).toBe('110 €');

    const filaSilla = filas[2];
    expect(filaSilla.querySelector('.products-table-col-precio').textContent).toBe('—');
    expect(filaSilla.querySelector('.products-table-col-alquiler').textContent).toBe('8 €/día');
    expect(filaSilla.querySelector('.products-table-col-precio-movil').textContent).toBe('8 €/día');
  });

  it('muestra el badge de estado correcto por fila', () => {
    renderProductsTable(productosDePrueba);
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Alquilado')).toBeInTheDocument();
  });

  it('el botón "Ver" tiene el aria-label con el nombre del producto', () => {
    renderProductsTable(productosDePrueba);
    expect(screen.getByRole('button', { name: 'Ver Baúl de viaje' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver Silla nórdica' })).toBeInTheDocument();
  });

  it('el click en cualquier parte de la fila abre el QuickViewModal del producto de esa fila', async () => {
    renderProductsTable(productosDePrueba);

    // getAllByRole('row') incluye la fila de cabecera (índice 0); la primera fila de datos
    // (Baúl de viaje) es la [1].
    const filas = screen.getAllByRole('row');
    await userEvent.click(filas[1]);

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    // Con el modal abierto, "Baúl de viaje" aparece dos veces en el documento (la celda de
    // la fila y el título del modal): se busca solo dentro del diálogo para no chocar.
    expect(within(dialogo).getByText('Baúl de viaje')).toBeInTheDocument();
  });

  it('el click en el botón "Ver" también abre el QuickViewModal', async () => {
    renderProductsTable(productosDePrueba);

    await userEvent.click(screen.getByRole('button', { name: 'Ver Silla nórdica' }));

    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('Silla nórdica')).toBeInTheDocument();
  });

  it('el botón "Ver" es focusable y se activa por teclado (Tab + Enter)', async () => {
    renderProductsTable(productosDePrueba);

    const verBtn = screen.getByRole('button', { name: 'Ver Baúl de viaje' });
    verBtn.focus();
    expect(verBtn).toHaveFocus();

    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('las filas no son focusables: solo el botón "Ver" tiene un punto de parada de foco', () => {
    renderProductsTable(productosDePrueba);

    screen.getAllByRole('row').forEach((fila) => {
      expect(fila).not.toHaveAttribute('tabindex');
    });
  });
});
