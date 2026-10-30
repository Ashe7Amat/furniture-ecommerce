// La pastilla de estado de cada fila del inventario (el menú desplegable que cambia disponible /
// vendido / alquilado). La pestaña se monta sola, con su vista de useInventarioVista, sin el panel
// entero (los tests Admin.*.test.jsx no se tocan).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import InventarioTab from './InventarioTab';
import useInventarioVista from '../hooks/useInventarioVista';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  updateMueble: vi.fn(),
  deleteMueble: vi.fn(),
  duplicarMueble: vi.fn(),
  exportarCatalogoCsv: vi.fn()
}));

const MUEBLES = [
  { id: 'm1', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001', estado: 'disponible', categoria: 'Sillas', imagenes: [] },
  { id: 'm2', nombre: 'Mesa Bistro', referencia: 'NAV-MES-002', estado: 'raro', categoria: 'Mesas', imagenes: [] }
];

const Pestana = ({ recargarMuebles }) => {
  const vista = useInventarioVista(MUEBLES);
  return (
    <InventarioTab
      vista={vista}
      muebles={MUEBLES}
      categorias={[]}
      recargarMuebles={recargarMuebles}
      confirmarBorrado={vi.fn()}
      abrirEditorMueble={vi.fn()}
    />
  );
};

const montar = () => {
  const showToast = vi.fn();
  const recargarMuebles = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast }}>
      <Pestana recargarMuebles={recargarMuebles} />
    </ToastContext.Provider>
  );
  return { showToast, recargarMuebles };
};

const pastilla = (nombre) => screen.getByRole('button', { name: new RegExp(`^Estado de ${nombre}:`) });
const menu = (nombre) => screen.queryByRole('listbox', { name: `Cambiar estado de ${nombre}` });

describe('InventarioTab — pastilla de estado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('un estado desconocido se enseña como «Disponible»', () => {
    montar();
    expect(pastilla('Mesa Bistro')).toHaveAccessibleName('Estado de Mesa Bistro: Disponible. Clic para cambiar');
  });

  it('abre el menú, marca el estado actual y se cierra con Escape o al pulsar fuera', () => {
    montar();
    fireEvent.click(pastilla('Silla Tolix'));
    expect(pastilla('Silla Tolix')).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu('Silla Tolix')).getByRole('option', { selected: true })).toHaveTextContent('Disponible');

    // Una tecla que no es Escape no lo cierra; pulsar dentro tampoco.
    fireEvent.keyDown(document, { key: 'a' });
    fireEvent.mouseDown(menu('Silla Tolix'));
    expect(menu('Silla Tolix')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu('Silla Tolix')).not.toBeInTheDocument();

    fireEvent.click(pastilla('Silla Tolix'));
    fireEvent.mouseDown(document.body);
    expect(menu('Silla Tolix')).not.toBeInTheDocument();
  });

  it('elegir el mismo estado solo cierra el menú', () => {
    montar();
    fireEvent.click(pastilla('Silla Tolix'));
    fireEvent.click(screen.getByRole('button', { name: 'Disponible' }));
    expect(menu('Silla Tolix')).not.toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
  });

  it('elegir otro estado lo guarda, dice «Guardando…» mientras tanto y recarga', async () => {
    let terminar;
    updateMueble.mockReturnValue(new Promise((r) => (terminar = r)));
    const { showToast, recargarMuebles } = montar();
    fireEvent.click(pastilla('Silla Tolix'));
    fireEvent.click(screen.getByRole('button', { name: 'Vendido' }));

    expect(updateMueble).toHaveBeenCalledWith('m1', { estado: 'vendido' });
    expect(pastilla('Silla Tolix')).toBeDisabled();
    expect(pastilla('Silla Tolix')).toHaveTextContent('Guardando…');

    terminar({ id: 'm1' });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado actualizado', 'success'));
    expect(recargarMuebles).toHaveBeenCalled();
    expect(pastilla('Silla Tolix')).toBeEnabled();
  });

  it('si no se guarda, avisa del error', async () => {
    updateMueble.mockResolvedValue(null);
    const { showToast, recargarMuebles } = montar();
    fireEvent.click(pastilla('Silla Tolix'));
    fireEvent.click(screen.getByRole('button', { name: 'Alquilado' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Error al cambiar estado', 'error'));
    expect(recargarMuebles).not.toHaveBeenCalled();
  });

  it('el selector nativo (móvil) también cambia el estado', async () => {
    updateMueble.mockResolvedValue({ id: 'm2' });
    const { showToast } = montar();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado de Mesa Bistro' }), {
      target: { value: 'vendido' }
    });
    expect(updateMueble).toHaveBeenCalledWith('m2', { estado: 'vendido' });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado actualizado', 'success'));
  });
});
