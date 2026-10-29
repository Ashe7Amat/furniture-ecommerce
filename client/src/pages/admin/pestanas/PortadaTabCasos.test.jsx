// Pestaña Portada: errores al cargar y al guardar, piezas destacadas que ya no están en el
// catálogo y búsquedas por categoría. El resto está en PortadaTab.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PortadaTab from './PortadaTab';
import { ToastContext } from '../../../context/ToastContext';
import { getAjustesHome, actualizarAjustesHome } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  getAjustesHome: vi.fn(),
  actualizarAjustesHome: vi.fn()
}));

const MUEBLES = [
  { id: 'm1', nombre: 'Aparador', referencia: 'NAV-APA-001', categoria: 'Aparadores', imagenes: ['https://img.test/a.webp'] },
  { id: 'm2', nombre: 'Taburete', referencia: null, categoria: null, imagenes: [] },
  { id: 'm3', nombre: 'Mesa baja', referencia: 'NAV-MES-003', categoria: 'Mesas', imagenes: [] }
];

const montar = async (props = {}) => {
  const showToast = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast }}>
      <PortadaTab muebles={MUEBLES} {...props} />
    </ToastContext.Provider>
  );
  await screen.findByRole('heading', { name: 'Gestión de Portada' });
  await waitFor(() => expect(screen.queryByText('Cargando piezas destacadas...')).not.toBeInTheDocument());
  return { showToast };
};
const lista = () => screen.queryByRole('list', { name: 'Lista de muebles destacados' });
const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios de la portada' }));

describe('PortadaTab — casos restantes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('si la carga falla, lo avisa y deja la lista vacía', async () => {
    getAjustesHome.mockRejectedValue(new Error('red'));
    const { showToast } = await montar();
    expect(showToast).toHaveBeenCalledWith('No se pudieron cargar los ajustes de portada', 'error');
    expect(screen.getByText('No hay ningún mueble destacado seleccionado.')).toBeInTheDocument();
  });

  it('sin ajustes (null) o sin lista, empieza sin destacados', async () => {
    getAjustesHome.mockResolvedValue({ productos_destacados: 'nada' });
    await montar();
    expect(screen.getByText('0 muebles seleccionados')).toBeInTheDocument();
  });

  it('una pieza destacada que ya no está en el catálogo se enseña con su id', async () => {
    getAjustesHome.mockResolvedValue({ productos_destacados: ['abcdef1234567890', 'm2'] });
    await montar();
    const filas = within(lista()).getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('Pieza #abcdef12');
    expect(filas[0]).toHaveTextContent('Ref: — · Sin categoría');
    // Sin referencia ni categoría
    expect(filas[1]).toHaveTextContent('Taburete');
    expect(filas[1]).toHaveTextContent('Sin categoría');
    expect(filas[1]).not.toHaveTextContent('Ref:');
    expect(screen.getByText('2 muebles seleccionados')).toBeInTheDocument();
  });

  it('busca por categoría, no repite las ya destacadas y la cruz limpia la búsqueda', async () => {
    getAjustesHome.mockResolvedValue({ productos_destacados: ['m1'] });
    await montar();
    const buscador = screen.getByRole('textbox', { name: 'Buscar muebles para añadir a destacados' });

    fireEvent.change(buscador, { target: { value: 'mesas' } });
    const resultados = screen.getByRole('region', { name: 'Resultados de búsqueda' });
    expect(within(resultados).getByText('Mesa baja')).toBeInTheDocument();
    expect(within(resultados).getByText('Ref: NAV-MES-003 · Mesas')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'aparador' } });
    expect(screen.getByText('No se encontraron muebles que coincidan con "aparador"')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'tabur' } });
    expect(within(screen.getByRole('region', { name: 'Resultados de búsqueda' })).getByText('Sin categoría')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(buscador).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Resultados de búsqueda' })).not.toBeInTheDocument();
  });

  it('guardar: con la lista del servidor la usa; sin ella deja la suya', async () => {
    getAjustesHome.mockResolvedValue({ productos_destacados: ['m1', 'm3'] });
    const { showToast } = await montar();

    actualizarAjustesHome.mockResolvedValueOnce({ success: true, data: { productos_destacados: ['m3'] } });
    guardar();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Piezas destacadas guardadas correctamente', 'success')
    );
    expect(actualizarAjustesHome).toHaveBeenCalledWith({ productos_destacados: ['m1', 'm3'] });
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(1);

    actualizarAjustesHome.mockResolvedValueOnce({ success: true });
    guardar();
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(2));
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('guardar: si el servidor no confirma o la petición lanza, avisa', async () => {
    getAjustesHome.mockResolvedValue({ productos_destacados: [] });
    const { showToast } = await montar();

    actualizarAjustesHome.mockResolvedValueOnce(null);
    guardar();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Error al guardar las piezas destacadas', 'error')
    );

    actualizarAjustesHome.mockRejectedValueOnce(new Error('red'));
    guardar();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Error de conexión al guardar los ajustes', 'error')
    );
  });

  it('mientras guarda, el botón dice «Guardando...»', async () => {
    getAjustesHome.mockResolvedValue({ productos_destacados: [] });
    await montar();
    let terminar;
    actualizarAjustesHome.mockReturnValue(new Promise((r) => (terminar = r)));
    guardar();
    expect(await screen.findByRole('button', { name: 'Guardar cambios de la portada' })).toHaveTextContent('Guardando...');
    terminar({ success: true });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardar cambios de la portada' })).toHaveTextContent('Guardar cambios')
    );
  });

  it('sin contexto de avisos no se rompe', async () => {
    getAjustesHome.mockRejectedValue(new Error('red'));
    render(
      <ToastContext.Provider value={{}}>
        <PortadaTab />
      </ToastContext.Provider>
    );
    expect(await screen.findByText('No hay ningún mueble destacado seleccionado.')).toBeInTheDocument();
  });
});
