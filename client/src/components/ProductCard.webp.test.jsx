// Tarjeta del catálogo con las fotos .webp optimizadas (VITE_WEBP_OPTIMIZADAS): <picture> con sus
// variantes, salvo que la foto no tenga (la imagen genérica). El resto está en ProductCard.test.jsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';
import { FavoritesContext } from '../context/FavoritesContext';

const pintar = (mueble) =>
  render(
    <MemoryRouter>
      <FavoritesContext.Provider value={{ toggleFavorite: vi.fn(), isFavorite: () => false }}>
        <ProductCard mueble={mueble} />
      </FavoritesContext.Provider>
    </MemoryRouter>
  );

afterEach(() => vi.unstubAllEnvs());

describe('ProductCard — fotos .webp optimizadas', () => {
  it('con variantes, <picture> con su srcset y la foto vendida en gris', () => {
    vi.stubEnv('VITE_WEBP_OPTIMIZADAS', 'true');
    const { container } = pintar({
      id: '1',
      nombre: 'Baúl',
      estado: 'vendido',
      imagenes: ['https://img.test/baul.jpg']
    });
    const fuente = container.querySelector('picture.product-picture source');
    expect(fuente.getAttribute('srcset')).toContain('-400.webp 400w');
    expect(container.querySelector('picture img')).toHaveClass('product-image--sold');
  });

  it('sin nombre, el texto alternativo es «Mueble»; sin fotos, sin <picture>', () => {
    vi.stubEnv('VITE_WEBP_OPTIMIZADAS', 'true');
    const { container } = pintar({
      id: '2',
      estado: 'disponible',
      imagenes: []
    });
    expect(container.querySelector('picture')).toBeNull();
    expect(container.querySelector('img.product-image')).toHaveAttribute('alt', 'Mueble');
  });

  it('con variantes y sin nombre, también «Mueble»', () => {
    vi.stubEnv('VITE_WEBP_OPTIMIZADAS', 'true');
    const { container } = pintar({
      id: '3',
      estado: 'disponible',
      imagenes: ['https://img.test/a.png']
    });
    expect(container.querySelector('picture img')).toHaveAttribute('alt', 'Mueble');
    expect(container.querySelector('picture img')).not.toHaveClass('product-image--sold');
  });
});
