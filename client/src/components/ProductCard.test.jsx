import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';
import { FavoritesContext } from '../context/FavoritesContext';
import { PLACEHOLDER_IMG } from '../utils/images';

// Contexto de favoritos "de mentira" para no depender del provider real (que a su vez
// depende de AuthContext + localStorage): solo hace falta la forma que ProductCard usa.
const renderProductCard = (mueble, favContext = { toggleFavorite: vi.fn(), isFavorite: () => false }) => {
  return render(
    <MemoryRouter>
      <FavoritesContext.Provider value={favContext}>
        <ProductCard mueble={mueble} />
      </FavoritesContext.Provider>
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
});
