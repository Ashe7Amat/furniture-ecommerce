// /admin?editar={id} (21 oct 2026): el enlace «Editar en panel» de la barra de modo admin de la ficha
// pública abre el editor de esa pieza. No son tests de caracterización (los Admin.*.test.jsx,
// congelados): Admin.jsx recibe el id de AdminRuta.jsx, que es quien lee la URL.
// scripts/mutantes/modo-admin.js los usa para la comprobación por mutación.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import AdminRuta from '../AdminRuta';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import { getMuebles, getCategorias, getPedidos, getMensajes, updateMueble } from '../../services/api';
import { ADMIN, CATEGORIAS, respuestaPedidos } from '../adminTestUtils';

vi.mock('../../services/api');

const mueble = (id, nombre) => ({
  id, nombre, referencia: `NAV-SIL-00${id.slice(-1)}`, categoria: 'Sillas', estado: 'disponible', imagenes: [], descripcion: 'Restaurada'
});
const CATALOGO = [mueble('m1', 'Silla Thonet'), mueble('m2', 'Mesa de roble')];

const Ubicacion = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="ubicacion">{pathname + search}</p>
      <button type="button" onClick={() => navigate(-1)}>Atrás</button>
    </>
  );
};

const montar = async (url, { muebles = CATALOGO } = {}) => {
  if (muebles !== null) getMuebles.mockResolvedValue(muebles);
  getCategorias.mockResolvedValue(CATEGORIAS);
  getPedidos.mockImplementation(async (opciones) => respuestaPedidos([], opciones));
  getMensajes.mockResolvedValue([]);
  const showToast = vi.fn();
  const user = userEvent.setup();
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/inicio', url]} initialIndex={1}>
        <AuthContext.Provider value={{ user: ADMIN }}>
          <ToastContext.Provider value={{ showToast }}>
            <Routes>
              <Route path="/admin" element={<><AdminRuta /><Ubicacion /></>} />
              <Route path="/inicio" element={<Ubicacion />} />
            </Routes>
          </ToastContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  });
  return { user, showToast };
};
const editor = () => screen.queryByRole('heading', { level: 3, name: 'Editar Producto' })?.closest('.admin-modal-content');
const ubicacion = () => screen.getByTestId('ubicacion').textContent;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Panel — /admin?editar={id}', () => {
  it('abre el editor de esa pieza, en "Gestionar Inventario"', async () => {
    await montar('/admin?editar=m2');

    expect(within(editor()).getByDisplayValue('Mesa de roble')).toBeInTheDocument();
    expect(within(editor()).getByDisplayValue('NAV-SIL-002')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Gestionar Inventario' })).toBeInTheDocument();
    expect(ubicacion()).toBe('/admin?editar=m2');
  });

  it('sin el parámetro, el panel es el de siempre', async () => {
    await montar('/admin');

    expect(editor()).toBeUndefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('espera a que llegue el inventario', async () => {
    let responder;
    getMuebles.mockReturnValue(new Promise((r) => { responder = r; }));
    await montar('/admin?editar=m1', { muebles: null });
    expect(editor()).toBeUndefined();

    await act(async () => responder(CATALOGO));

    expect(within(editor()).getByDisplayValue('Silla Thonet')).toBeInTheDocument();
  });

  it('al cerrar el editor, ?editar sale de la URL sin dejar otra entrada en el historial', async () => {
    const { user } = await montar('/admin?editar=m2&otro=1');

    await user.click(within(editor()).getByRole('button', { name: 'Cerrar' }));

    expect(editor()).toBeUndefined();
    expect(ubicacion()).toBe('/admin?otro=1');
    await user.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(ubicacion()).toBe('/inicio');
  });

  it('al guardar, se cierra, sale de la URL y no se vuelve a abrir al recargar el inventario', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await montar('/admin?editar=m2');

    await user.click(within(editor()).getByRole('button', { name: /Guardar/ }));

    expect(updateMueble).toHaveBeenCalledWith('m2', expect.any(FormData));
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(editor()).toBeUndefined();
    expect(ubicacion()).toBe('/admin');
  });

  it('con el editor abierto desde la lista, cerrar no toca la URL', async () => {
    const { user } = await montar('/admin?otro=1');
    await user.click(screen.getByRole('button', { name: 'Gestionar Inventario' }));
    await user.click(within(screen.getByRole('checkbox', { name: 'Seleccionar Silla Thonet' }).closest('.inventory-list-item')).getByRole('button', { name: 'Editar' }));

    await user.click(within(editor()).getByRole('button', { name: 'Cerrar' }));

    expect(ubicacion()).toBe('/admin?otro=1');
  });

  it('si la pieza no está, lo avisa y quita ?editar de la URL', async () => {
    const { showToast } = await montar('/admin?editar=no-existe');

    expect(editor()).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('No se ha encontrado la pieza que querías editar', 'error');
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(ubicacion()).toBe('/admin');
  });

  it('con el inventario vacío (o si no carga), también lo avisa', async () => {
    const { showToast } = await montar('/admin?editar=m1', { muebles: [] });

    expect(showToast).toHaveBeenCalledWith('No se ha encontrado la pieza que querías editar', 'error');
  });
});
