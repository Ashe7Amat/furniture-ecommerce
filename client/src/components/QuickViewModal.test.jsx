import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuickViewModal from './QuickViewModal';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { PLACEHOLDER_IMG } from '../utils/images';

const muebleBase = (extra = {}) => ({
  id: 'm1',
  nombre: 'Silla de roble',
  categoria: 'Sillas',
  descripcion: 'Restaurada a mano',
  precio_venta: 90,
  estado: 'disponible',
  ...extra
});

const renderModal = ({
  mueble = muebleBase(),
  onClose = vi.fn(),
  addToCart = vi.fn(),
  toggleFavorite = vi.fn(),
  isFavorite = () => false
} = {}) => {
  const utils = render(
    <MemoryRouter>
      <CartContext.Provider value={{ addToCart }}>
        <FavoritesContext.Provider value={{ toggleFavorite, isFavorite }}>
          <QuickViewModal mueble={mueble} onClose={onClose} />
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
  return { ...utils, onClose, addToCart, toggleFavorite };
};

beforeEach(() => {
  document.body.style.overflow = '';
});

describe('QuickViewModal — contenido', () => {
  it('muestra nombre, categoría, descripción y precio de venta', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Silla de roble' })).toBeInTheDocument();
    expect(screen.getByText('Sillas')).toBeInTheDocument();
    expect(screen.getByText('Restaurada a mano')).toBeInTheDocument();
    expect(screen.getByText('90 €')).toBeInTheDocument();
  });

  it('sin descripción, no muestra ningún párrafo de descripción', () => {
    renderModal({ mueble: muebleBase({ descripcion: undefined }) });
    expect(screen.queryByText('Restaurada a mano')).not.toBeInTheDocument();
  });

  it('sin precio de venta pero con precio de alquiler, lo muestra en €/día', () => {
    renderModal({ mueble: muebleBase({ precio_venta: undefined, precio_alquiler_dia: 12 }) });
    expect(screen.getByText('12 €/día')).toBeInTheDocument();
  });

  it('sin ningún precio, muestra "Consultar precio"', () => {
    renderModal({ mueble: muebleBase({ precio_venta: undefined, precio_alquiler_dia: undefined }) });
    expect(screen.getByText('Consultar precio')).toBeInTheDocument();
  });

  it('sin imágenes, usa el placeholder', () => {
    renderModal({ mueble: muebleBase({ imagenes: [] }) });
    expect(screen.getByAltText('Silla de roble')).toHaveAttribute('src', PLACEHOLDER_IMG);
  });
});

describe('QuickViewModal — estado de disponibilidad', () => {
  it('disponible: el botón de añadir a la cesta está habilitado y funciona', async () => {
    const user = userEvent.setup();
    const { addToCart, onClose } = renderModal({ mueble: muebleBase({ estado: 'disponible' }) });

    const boton = screen.getByRole('button', { name: 'Añadir a la cesta' });
    expect(boton).not.toBeDisabled();

    await user.click(boton);

    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), 'compra');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('vendido: muestra la insignia "Vendido" y el botón "Agotado" deshabilitado', () => {
    renderModal({ mueble: muebleBase({ estado: 'vendido' }) });
    expect(screen.getByText('Vendido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
  });

  it('alquilado: muestra la insignia "Alquilado" y el botón "Alquilado" deshabilitado', () => {
    renderModal({ mueble: muebleBase({ estado: 'alquilado' }) });
    // getByText fallaría aquí por ambigüedad (la insignia y el botón dicen lo mismo), así
    // que se localiza la insignia por su clase dentro del diálogo (portal a document.body).
    expect(screen.getByRole('dialog').querySelector('.qv-status-tag.rented')).toHaveTextContent('Alquilado');
    expect(screen.getByRole('button', { name: 'Alquilado' })).toBeDisabled();
  });
});

describe('QuickViewModal — favoritos', () => {
  it('sin ser favorito, el botón invita a añadir y llama a toggleFavorite al pulsarlo', async () => {
    const user = userEvent.setup();
    const { toggleFavorite } = renderModal({ isFavorite: () => false });

    const boton = screen.getByRole('button', { name: 'Añadir a favoritos' });
    expect(boton).not.toHaveClass('active');

    await user.click(boton);
    expect(toggleFavorite).toHaveBeenCalledWith('m1');
  });

  it('siendo ya favorito, el botón lo indica con la clase activa', () => {
    renderModal({ isFavorite: () => true });
    expect(screen.getByRole('button', { name: 'En favoritos ✓' })).toHaveClass('active');
  });
});

describe('QuickViewModal — cierre y accesibilidad', () => {
  it('el botón de cerrar recibe el foco al montar', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('el botón de cerrar llama a onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('la tecla Escape llama a onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic en el fondo (fuera de la tarjeta) llama a onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic dentro de la tarjeta no llama a onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByText('Sillas'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('bloquea el scroll del fondo al montar y lo restaura al desmontar', () => {
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('"Ver ficha completa" enlaza a la página del mueble y cierra el modal al pulsarlo', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const enlace = screen.getByText('Ver ficha completa →');
    expect(enlace).toHaveAttribute('href', '/mueble/m1');

    await user.click(enlace);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
