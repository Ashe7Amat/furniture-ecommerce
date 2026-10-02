// A6: la referencia del mueble bajo su nombre en los cuatro sitios del catálogo público (tarjeta,
// lista, vista rápida y ficha). Si la pieza no tiene referencia (las anteriores a A4), no se pinta
// nada: ni el texto ni un hueco vacío.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReferenciaProducto from './ReferenciaProducto';
import ProductCard from './ProductCard';
import ProductsTable from './ProductsTable';
import QuickViewModal from './QuickViewModal';
import ProductDetail from '../pages/ProductDetail';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebleById } from '../services/api';

vi.mock('../services/api');

const CON_REF = {
  id: 'm1',
  nombre: 'Baúl de viaje',
  descripcion: 'Restaurado a mano',
  categoria: 'Baúles y maletas',
  precio_venta: 110,
  imagenes: [],
  estado: 'disponible',
  referencia: 'NAV-BAU-007'
};
const SIN_REF = { ...CON_REF, id: 'm2', nombre: 'Bidón antiguo', referencia: null };

const conContextos = (contenido) => (
  <MemoryRouter>
    <CartContext.Provider value={{ addToCart: vi.fn() }}>
      <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn(), isFavorite: () => false }}>
        {contenido}
      </FavoritesContext.Provider>
    </CartContext.Provider>
  </MemoryRouter>
);
const referencias = () => [...document.querySelectorAll('.ref-producto')].map((el) => el.textContent);

describe('ReferenciaProducto', () => {
  it('pinta "Ref." y la referencia, con su clase y la que se le pase', () => {
    render(<ReferenciaProducto referencia="NAV-SIL-001" className="extra" />);
    const ref = screen.getByText('Ref. NAV-SIL-001');
    expect(ref).toHaveClass('ref-producto', 'extra');
  });

  it.each([null, undefined, ''])('sin referencia (%s) no pinta nada', (referencia) => {
    const { container } = render(<ReferenciaProducto referencia={referencia} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('la referencia en el catálogo público (A6)', () => {
  it('ProductCard: bajo el nombre; sin referencia, nada', () => {
    render(conContextos(<><ProductCard mueble={CON_REF} /><ProductCard mueble={SIN_REF} /></>));

    const ref = screen.getByText('Ref. NAV-BAU-007');
    expect(ref.previousElementSibling).toHaveTextContent('Baúl de viaje');
    expect(referencias()).toEqual(['Ref. NAV-BAU-007']);
  });

  it('ProductsTable: en la celda del nombre, debajo; sin referencia, la celda es solo el nombre', () => {
    render(conContextos(<ProductsTable productos={[CON_REF, SIN_REF]} />));

    const [, filaConRef, filaSinRef] = screen.getAllByRole('row');
    const celdaConRef = filaConRef.querySelector('.products-table-col-nombre');
    expect(celdaConRef).toHaveTextContent('Baúl de viajeRef. NAV-BAU-007');
    expect(filaSinRef.querySelector('.products-table-col-nombre').textContent).toBe('Bidón antiguo');
    expect(referencias()).toEqual(['Ref. NAV-BAU-007']);
  });

  it('QuickViewModal: bajo el nombre; sin referencia, nada', () => {
    const { unmount } = render(conContextos(<QuickViewModal mueble={CON_REF} onClose={vi.fn()} />));
    expect(screen.getByText('Ref. NAV-BAU-007')).toHaveClass('qv-ref');
    unmount();

    render(conContextos(<QuickViewModal mueble={SIN_REF} onClose={vi.fn()} />));
    expect(referencias()).toEqual([]);
  });

  it.each([
    ['con referencia', CON_REF, ['Ref. NAV-BAU-007']],
    ['sin referencia', SIN_REF, []]
  ])('ProductDetail %s', async (_caso, mueble, esperadas) => {
    getMuebleById.mockResolvedValue(mueble);
    render(
      conContextos(
        <Routes>
          <Route path="*" element={<ProductDetail />} />
        </Routes>
      )
    );

    expect(await screen.findByRole('heading', { level: 1, name: mueble.nombre })).toBeInTheDocument();
    expect(referencias()).toEqual(esperadas);
  });
});
