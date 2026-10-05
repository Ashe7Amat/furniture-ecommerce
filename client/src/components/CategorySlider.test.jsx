// CategorySlider (las categorías generales encima del catálogo). No tenía tests (tarea 5 de la
// sesión del 5 oct 2026, cobertura).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CategorySlider from './CategorySlider';
import { getCategorias } from '../services/api';
import { PLACEHOLDER_IMG } from '../utils/images';

vi.mock('../services/api');

const CATEGORIAS = [
  { id: 1, nombre: 'Mobiliario', categoria_padre_id: null, imagen_url: '/img/mobiliario.webp' },
  { id: 2, nombre: 'Decoración y hogar', categoria_padre_id: null, imagen_url: null },
  { id: 20, nombre: 'Sillas', categoria_padre_id: 1, imagen_url: null }
];

const RutaActual = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="ruta">{decodeURIComponent(pathname + search)}</span>;
};

const montar = async (ruta = '/catalogo') => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="*" element={<><CategorySlider /><RutaActual /></>} />
        </Routes>
      </MemoryRouter>
    );
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  getCategorias.mockResolvedValue(CATEGORIAS);
});

describe('CategorySlider', () => {
  it('enseña solo las categorías generales, con su foto o la genérica', async () => {
    await montar();

    expect(screen.getByText('Mobiliario')).toBeInTheDocument();
    expect(screen.getByText('Decoración y hogar')).toBeInTheDocument();
    expect(screen.queryByText('Sillas')).not.toBeInTheDocument();
    // CAMBIADO A PROPÓSITO (5 oct 2026, H41): la foto lleva alt vacío (el nombre ya lo da la etiqueta
    // del botón), así que se busca por el botón y no por el texto alternativo.
    const foto = (nombre) => screen.getByRole('button', { name: nombre }).querySelector('img');
    expect(foto('Mobiliario')).toHaveAttribute('src', '/img/mobiliario.webp');
    expect(foto('Mobiliario')).toHaveAttribute('alt', '');
    expect(foto('Decoración y hogar')).toHaveAttribute('src', PLACEHOLDER_IMG);
  });

  it('pulsar una categoría filtra el catálogo por ella (con el nombre codificado en la URL)', async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByText('Decoración y hogar'));

    expect(screen.getByTestId('ruta')).toHaveTextContent('/catalogo?categoria=Decoración y hogar');
  });

  it('la categoría de la URL sale marcada, y pulsarla otra vez quita el filtro', async () => {
    const user = userEvent.setup();
    await montar('/catalogo?categoria=Mobiliario');

    expect(screen.getByText('Mobiliario').closest('.category-item')).toHaveClass('active');
    expect(screen.getByText('Decoración y hogar').closest('.category-item')).not.toHaveClass('active');

    await user.click(screen.getByText('Mobiliario'));

    expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/catalogo$/);
  });

  it('cada categoría es un botón con su nombre, y aria-pressed dice cuál es el filtro puesto (H41)', async () => {
    await montar('/catalogo?categoria=Mobiliario');

    const mobiliario = screen.getByRole('button', { name: 'Mobiliario' });
    expect(mobiliario).toHaveAttribute('type', 'button');
    expect(mobiliario).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Decoración y hogar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('con el teclado: se llega con el tabulador y se activa con Enter (H41)', async () => {
    const user = userEvent.setup();
    await montar();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Mobiliario' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Decoración y hogar' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('ruta')).toHaveTextContent('/catalogo?categoria=Decoración y hogar');
  });

  it('con el teclado: se activa con Espacio, y Espacio sobre la activa quita el filtro (H41)', async () => {
    const user = userEvent.setup();
    await montar();

    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByTestId('ruta')).toHaveTextContent('/catalogo?categoria=Mobiliario');

    expect(screen.getByRole('button', { name: 'Mobiliario' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/catalogo$/);
  });

  it('sin categorías, o si la API no devuelve una lista, no pinta nada', async () => {
    getCategorias.mockResolvedValue([]);
    await montar();
    expect(document.querySelector('.category-slider-wrapper')).toBeNull();

    getCategorias.mockResolvedValue(null);
    await montar();
    expect(document.querySelector('.category-slider-wrapper')).toBeNull();
  });
});
