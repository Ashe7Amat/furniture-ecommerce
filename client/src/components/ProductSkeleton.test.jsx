import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProductSkeleton from './ProductSkeleton';

// Componente puramente estático (sin props ni estado): el único comportamiento que tiene
// es la estructura que pinta, así que el test se limita a comprobar esa forma.
describe('ProductSkeleton', () => {
  it('renderiza la estructura de una tarjeta de producto en modo "cargando"', () => {
    const { container } = render(<ProductSkeleton />);

    const tarjeta = container.querySelector('.product-card.skeleton-card');
    expect(tarjeta).toBeInTheDocument();
    expect(tarjeta.querySelector('.skeleton-image')).toBeInTheDocument();
    expect(tarjeta.querySelector('.skeleton-title')).toBeInTheDocument();
    expect(tarjeta.querySelector('.skeleton-desc')).toBeInTheDocument();
    expect(tarjeta.querySelector('.skeleton-price')).toBeInTheDocument();
  });

  it('no muestra ningún texto real (es solo un marcador visual)', () => {
    const { container } = render(<ProductSkeleton />);
    expect(container.textContent).toBe('');
  });
});
