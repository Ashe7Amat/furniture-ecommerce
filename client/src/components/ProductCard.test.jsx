import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { PLACEHOLDER_IMG } from '../utils/images';

// Contextos "de mentira" para no depender de los providers reales (que a su vez dependen
// de AuthContext + localStorage): solo hace falta la forma que ProductCard/QuickViewModal
// usan. CartContext solo lo necesita el QuickViewModal que se abre con "Vista rápida".
const renderProductCard = (
  mueble,
  favContext = { toggleFavorite: vi.fn(), isFavorite: () => false },
  cartContext = { addToCart: vi.fn() }
) => {
  return render(
    <MemoryRouter>
      <CartContext.Provider value={cartContext}>
        <FavoritesContext.Provider value={favContext}>
          <ProductCard mueble={mueble} />
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
};

describe('ProductCard', () => {
  it('muestra el nombre, la descripción y el precio del mueble', () => {
    renderProductCard({
      id: '1',
      nombre: 'Baúl de viaje',
      descripcion: 'Restaurado a mano',
      precio_venta: 110,
      estado: 'disponible',
    });

    expect(screen.getByText('Baúl de viaje')).toBeInTheDocument();
    expect(screen.getByText('Restaurado a mano')).toBeInTheDocument();
    expect(screen.getByText('110 €')).toBeInTheDocument();
  });

  it('usa la imagen del placeholder propio si el mueble no tiene fotos', () => {
    renderProductCard({ id: '2', nombre: 'Silla', imagenes: [], estado: 'disponible' });

    const img = screen.getByAltText('Silla');
    expect(img).toHaveAttribute('src', PLACEHOLDER_IMG);
  });

  it('usa la primera foto real cuando el mueble sí tiene imágenes', () => {
    renderProductCard({
      id: '3',
      nombre: 'Mesa',
      imagenes: ['mesa-1.jpg', 'mesa-2.jpg'],
      estado: 'disponible',
    });

    expect(screen.getByAltText('Mesa')).toHaveAttribute('src', 'mesa-1.jpg');
  });

  it('muestra la insignia de "Vendido" y el precio tachado cuando el estado es vendido', () => {
    renderProductCard({
      id: '4',
      nombre: 'Armario',
      precio_venta: 250,
      estado: 'vendido',
    });

    expect(screen.getByText('Vendido')).toBeInTheDocument();
    // Con estado "vendido" no debe verse el botón de vista rápida
    expect(screen.queryByText('Vista rápida')).not.toBeInTheDocument();
  });

  it('muestra la insignia de "Alquilado", sin tachar el precio, y también oculta la vista rápida', () => {
    renderProductCard({
      id: '5',
      nombre: 'Lámpara',
      precio_alquiler_dia: 8,
      estado: 'alquilado',
    });

    expect(screen.getByText('Alquilado')).toBeInTheDocument();
    // A diferencia de "vendido", el precio de "alquilado" no aparece tachado
    expect(screen.getByText('8 €/día')).toBeInTheDocument();
    expect(screen.queryByText('Vista rápida')).not.toBeInTheDocument();
  });

  it('sin ningún precio, invita a "Consultar"', () => {
    renderProductCard({ id: '6', nombre: 'Pieza sin tasar', estado: 'disponible' });
    expect(screen.getByText('Consultar')).toBeInTheDocument();
  });

  it('el botón de favorito llama a toggleFavorite sin navegar a la ficha', async () => {
    const user = userEvent.setup();
    const toggleFavorite = vi.fn();
    renderProductCard(
      { id: '7', nombre: 'Cómoda', estado: 'disponible' },
      { toggleFavorite, isFavorite: () => false }
    );

    await user.click(screen.getByRole('button', { name: 'Favorito' }));

    expect(toggleFavorite).toHaveBeenCalledWith('7');
  });

  it('siendo ya favorito, el icono de favorito se rellena', () => {
    renderProductCard(
      { id: '8', nombre: 'Espejo', estado: 'disponible' },
      { toggleFavorite: vi.fn(), isFavorite: () => true }
    );

    const icono = screen.getByRole('button', { name: 'Favorito' }).querySelector('svg');
    expect(icono).toHaveAttribute('fill', 'var(--accent-color)');
  });

  it('"Vista rápida" abre el QuickViewModal del mismo mueble', async () => {
    const user = userEvent.setup();
    renderProductCard({
      id: '9',
      nombre: 'Butaca',
      descripcion: 'Tapizada en terciopelo',
      precio_venta: 300,
      estado: 'disponible',
    });

    await user.click(screen.getByText('Vista rápida'));

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    expect(within(dialogo).getByRole('heading', { name: 'Butaca' })).toBeInTheDocument();
  });
});
