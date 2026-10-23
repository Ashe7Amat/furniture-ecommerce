import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortadaTab from './PortadaTab';
import { ToastContext } from '../../../context/ToastContext';
import * as api from '../../../services/api';

vi.mock('../../../services/api');

const MUEBLES_PRUEBA = [
  {
    id: 'm1',
    nombre: 'Aparador Nórdico de Roble',
    referencia: 'NAV-APA-001',
    categoria: 'Aparadores',
    imagenes: ['https://img.test/aparador.webp']
  },
  {
    id: 'm2',
    nombre: 'Mesa de Centro Rústica',
    referencia: 'NAV-MES-002',
    categoria: 'Mesas',
    imagenes: ['https://img.test/mesa.webp']
  },
  {
    id: 'm3',
    nombre: 'Sillón Orejero Vintage',
    referencia: 'NAV-SIL-003',
    categoria: 'Sillones',
    imagenes: ['https://img.test/sillon.webp']
  }
];

describe('PortadaTab — Pestaña de Portada en el Panel de Administración', () => {
  let showToastMock;

  const renderPortadaTab = (props = {}) => {
    showToastMock = vi.fn();
    return render(
      <ToastContext.Provider value={{ showToast: showToastMock }}>
        <PortadaTab muebles={MUEBLES_PRUEBA} {...props} />
      </ToastContext.Provider>
    );
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra estado de carga inicialmente y luego el estado vacío si no hay destacados', async () => {
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: []
    });

    renderPortadaTab();

    expect(screen.getByText('Cargando piezas destacadas...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Portada' })).toBeInTheDocument();
    });

    expect(screen.getByText('No hay ningún mueble destacado seleccionado.')).toBeInTheDocument();
    expect(screen.getByText('0 muebles seleccionados')).toBeInTheDocument();
  });

  it('muestra las piezas destacadas cuando ya existen en la configuración', async () => {
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: ['m1', 'm2']
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    });

    expect(screen.getByText('Mesa de Centro Rústica')).toBeInTheDocument();
    expect(screen.getByText('2 muebles seleccionados')).toBeInTheDocument();
  });

  it('permite buscar y añadir un mueble a la lista de destacados', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: ['m1']
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    });

    const buscador = screen.getByLabelText('Buscar muebles para añadir a destacados');
    await user.type(buscador, 'orejero');

    // Debe mostrar la sugerencia del Sillón Orejero
    const sugerencias = await screen.findByRole('region', { name: 'Resultados de búsqueda' });
    expect(within(sugerencias).getByText('Sillón Orejero Vintage')).toBeInTheDocument();

    // Clic en destacar
    const btnDestacar = within(sugerencias).getByRole('button', { name: 'Añadir Sillón Orejero Vintage a destacados' });
    await user.click(btnDestacar);

    // Debe añadirse a la lista y limpiarse el buscador
    expect(buscador.value).toBe('');
    expect(screen.getByText('2 muebles seleccionados')).toBeInTheDocument();
    expect(screen.getByText('Sillón Orejero Vintage')).toBeInTheDocument();
  });

  it('permite quitar y reordenar un mueble de la lista de destacados', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: ['m1', 'm2']
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    });

    // Mover m1 abajo
    const btnBajar = screen.getByRole('button', { name: 'Mover Aparador Nórdico de Roble abajo' });
    await user.click(btnBajar);

    // Quitar m1 de destacados
    const btnQuitar = screen.getByRole('button', { name: 'Quitar Aparador Nórdico de Roble de destacados' });
    await user.click(btnQuitar);

    expect(screen.queryByText('Aparador Nórdico de Roble')).not.toBeInTheDocument();
    expect(screen.getByText('1 mueble seleccionado')).toBeInTheDocument();
  });

  it('llama a actualizarAjustesHome al hacer clic en Guardar cambios y muestra toast de éxito', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: ['m1', 'm2']
    });
    api.actualizarAjustesHome.mockResolvedValueOnce({
      success: true,
      data: { productos_destacados: ['m1', 'm2'] }
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    });

    const btnGuardar = screen.getByRole('button', { name: 'Guardar cambios de la portada' });
    await user.click(btnGuardar);

    expect(api.actualizarAjustesHome).toHaveBeenCalledWith({
      productos_destacados: ['m1', 'm2']
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Piezas destacadas guardadas correctamente', 'success');
    });
  });

  it('muestra toast de error si la llamada de Guardar cambios falla', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: []
    });
    api.actualizarAjustesHome.mockResolvedValueOnce(null);

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Portada' })).toBeInTheDocument();
    });

    const btnGuardar = screen.getByRole('button', { name: 'Guardar cambios de la portada' });
    await user.click(btnGuardar);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Error al guardar las piezas destacadas', 'error');
    });
  });

  it('el botón Ver portada enlaza a la raíz en una nueva pestaña', async () => {
    api.getAjustesHome.mockResolvedValueOnce({
      productos_destacados: []
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Portada' })).toBeInTheDocument();
    });

    const enlacePortada = screen.getByRole('link', { name: 'Ver portada de la tienda en una pestaña nueva' });
    expect(enlacePortada).toHaveAttribute('href', '/');
    expect(enlacePortada).toHaveAttribute('target', '_blank');
  });
});
