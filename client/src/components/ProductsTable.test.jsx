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

  it('sin ningún precio (o con los precios ocultos), "Consultar precio" en venta y en la tarjeta móvil; "—" en alquiler', () => {
    renderProductsTable([{ id: '3', nombre: 'Bidón antiguo', categoria: 'Bidones', estado: 'disponible', imagenes: [], precio_venta: null, precio_alquiler_dia: null }]);
    const fila = screen.getAllByRole('row')[1];

    expect(fila.querySelector('.products-table-col-precio').textContent).toBe('Consultar precio');
    expect(fila.querySelector('.products-table-col-alquiler').textContent).toBe('—');
    expect(fila.querySelector('.products-table-col-precio-movil').textContent).toBe('Consultar precio');
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

// H10: la tabla se lee bien con un lector de pantalla. Dos cosas que jsdom sí puede comprobar
// (no aplica el CSS, así que la geometría se comprobó aparte, en el navegador):
//   - cada celda cuelga directamente de su fila: ni contenedores intermedios ni `display:
//     contents`, que algunos lectores no tratan bien;
//   - cada columna tiene una cabecera con nombre. Antes, las de la foto y el botón llevaban
//     aria-hidden, y el lector se quedaba con 5 cabeceras para 7 celdas: anunciaba la foto como
//     "Nombre", el nombre como "Categoría", y así hasta el final.
describe('ProductsTable — accesibilidad de la tabla (H10)', () => {
  // La celda del precio de la tarjeta móvil no tiene columna: en escritorio está oculta con
  // display:none (Catalog.css), y en móvil no hay fila de cabecera.
  const celdasConColumna = (fila) =>
    within(fila)
      .getAllByRole('cell')
      .filter((celda) => !celda.classList.contains('products-table-col-precio-movil'));

  it('cada celda es hija directa de su fila, sin contenedores intermedios', () => {
    renderProductsTable(productosDePrueba);

    const [cabecera, ...filas] = screen.getAllByRole('row');
    within(cabecera)
      .getAllByRole('columnheader')
      .forEach((c) => expect(c.parentElement).toBe(cabecera));
    filas.forEach((fila) => {
      const celdas = within(fila).getAllByRole('cell');
      expect(celdas).toHaveLength(8);
      celdas.forEach((celda) => expect(celda.parentElement).toBe(fila));
      // y la fila no tiene más hijos que sus celdas
      expect(fila.children).toHaveLength(celdas.length);
    });
  });

  it('todas las columnas tienen una cabecera con nombre, también la de la foto y la del botón', () => {
    renderProductsTable(productosDePrueba);

    const nombres = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(nombres).toEqual(['Foto', 'Nombre', 'Categoría', 'Precio venta', 'Precio alquiler/día', 'Estado', 'Acción']);
  });

  it('cada celda cae bajo la cabecera de su columna', () => {
    renderProductsTable(productosDePrueba);

    const cabeceras = screen.getAllByRole('columnheader').map((c) => c.textContent);
    const [, filaBaul, filaSilla] = screen.getAllByRole('row');
    const deColumna = (fila, nombre) => celdasConColumna(fila)[cabeceras.indexOf(nombre)];

    [filaBaul, filaSilla].forEach((fila) => expect(celdasConColumna(fila)).toHaveLength(cabeceras.length));
    expect(within(deColumna(filaBaul, 'Foto')).getByRole('img')).toHaveAttribute('alt', 'Baúl de viaje');
    expect(deColumna(filaBaul, 'Nombre')).toHaveTextContent('Baúl de viaje');
    expect(deColumna(filaBaul, 'Categoría')).toHaveTextContent('Baúles');
    expect(deColumna(filaBaul, 'Precio venta')).toHaveTextContent('110 €');
    expect(deColumna(filaSilla, 'Precio alquiler/día')).toHaveTextContent('8 €/día');
    expect(deColumna(filaSilla, 'Estado')).toHaveTextContent('Alquilado');
    expect(within(deColumna(filaSilla, 'Acción')).getByRole('button')).toHaveAccessibleName('Ver Silla nórdica');
  });
});
