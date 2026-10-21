// "Duplicar" en las filas de "Gestionar Inventario" (21 oct 2026). No son tests de caracterización
// (los Admin.*.test.jsx, congelados desde la tarea 4): describen lo nuevo. La copia la hace el
// servidor (POST /api/muebles/:id/duplicar, ver server/src/__tests__/duplicarMueble.test.js); aquí
// se comprueba el panel. scripts/mutantes/duplicar.js los usa para la comprobación por mutación.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMuebles, duplicarMueble, updateMueble, createMueble } from '../../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';

vi.mock('../../services/api');

const ORIGINAL = {
  id: 'm2',
  nombre: 'Silla Thonet',
  categoria: 'Sillas',
  categoria_id: 11,
  descripcion: 'Madera curvada, restaurada.',
  estado: 'vendido',
  precio_venta: 1250,
  precio_alquiler_dia: 30,
  imagenes: ['https://img.test/m2.jpg'],
  referencia: 'NAV-SIL-002'
};
const CATALOGO = [
  { ...ORIGINAL, id: 'm1', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001', estado: 'disponible' },
  ORIGINAL
];
// Lo que devuelve el servidor: la fila insertada, con todas sus columnas.
const COPIA = {
  ...ORIGINAL,
  id: 'nueva-1',
  nombre: 'Silla Thonet (Copia)',
  estado: 'disponible',
  disponible: true,
  imagenes: [],
  referencia: 'NAV-SIL-003',
  created_at: '2026-10-21T09:00:00Z'
};
const MENSAJE = '¿Duplicar Silla Thonet? Se creará una nueva pieza con la misma información excepto las fotos.';

const abrirInventario = async () => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles: CATALOGO, categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  return { user, ...utils };
};
const fila = (nombre) =>
  within(screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` }).closest('.inventory-list-item'));
const dialogo = () => within(screen.getByRole('heading', { level: 3, name: 'Duplicar pieza' }).closest('.confirm-box'));
const editor = () => within(screen.getByRole('heading', { level: 3, name: 'Editar Producto' }).closest('.admin-modal-content'));
const pedirDuplicar = async (user, nombre = 'Silla Thonet') => {
  await user.click(fila(nombre).getByRole('button', { name: 'Duplicar' }));
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Inventario — duplicar pieza', () => {
  it('cada fila tiene "Duplicar", y pide confirmación antes de hacer nada', async () => {
    const { user } = await abrirInventario();
    expect(fila('Silla Tolix').getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();

    await pedirDuplicar(user);

    expect(dialogo().getByText(MENSAJE)).toBeInTheDocument();
    expect(dialogo().getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();
    expect(duplicarMueble).not.toHaveBeenCalled();
  });

  it('al confirmar, el servidor crea la copia, avisa con su referencia nueva, recarga y abre su editor', async () => {
    duplicarMueble.mockResolvedValue({ data: { success: true, data: [COPIA] }, error: null, status: 201 });
    const { user, showToast } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Pieza duplicada (NAV-SIL-003)', 'success'));
    expect(duplicarMueble).toHaveBeenCalledTimes(1);
    expect(duplicarMueble).toHaveBeenCalledWith('m2');
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(getMuebles).toHaveBeenLastCalledWith({ fresco: true });
    // El editor que se abre es el de la pieza nueva: su nombre, su referencia y sin fotos.
    expect(editor().getByDisplayValue('Silla Thonet (Copia)')).toBeInTheDocument();
    expect(editor().getByDisplayValue('NAV-SIL-003')).toBeInTheDocument();
    expect(editor().getByDisplayValue('Madera curvada, restaurada.')).toBeInTheDocument();
    expect(editor().queryByRole('img')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Duplicar pieza' })).not.toBeInTheDocument());
  });

  it('la pieza original no cambia: no se edita ni se crea nada desde el panel', async () => {
    duplicarMueble.mockResolvedValue({ data: { success: true, data: [COPIA] }, error: null, status: 201 });
    const { user } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(editor().getByDisplayValue('Silla Thonet (Copia)')).toBeInTheDocument());

    expect(updateMueble).not.toHaveBeenCalled();
    expect(createMueble).not.toHaveBeenCalled();
    expect(fila('Silla Thonet').getByText('NAV-SIL-002')).toBeInTheDocument();
    expect(fila('Silla Thonet').getByRole('combobox')).toHaveValue('vendido');
  });

  it('una copia sin referencia (categoría sin código) avisa sin ella', async () => {
    duplicarMueble.mockResolvedValue({ data: { success: true, data: [{ ...COPIA, referencia: null }] }, error: null, status: 201 });
    const { user, showToast } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Pieza duplicada', 'success'));
  });

  it('"Cancelar" no duplica nada', async () => {
    const { user } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Cancelar' }));

    expect(duplicarMueble).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { level: 3, name: 'Duplicar pieza' })).not.toBeInTheDocument();
  });

  it('un segundo clic en "Duplicar" mientras se duplica no crea otra copia', async () => {
    let responder;
    duplicarMueble.mockImplementation(() => new Promise((r) => { responder = r; }));
    const { user } = await abrirInventario();

    await pedirDuplicar(user);
    const confirmar = dialogo().getByRole('button', { name: 'Duplicar' });
    await user.click(confirmar);
    await user.click(confirmar);
    responder({ data: { success: true, data: [COPIA] }, error: null, status: 201 });

    await waitFor(() => expect(editor().getByDisplayValue('Silla Thonet (Copia)')).toBeInTheDocument());
    expect(duplicarMueble).toHaveBeenCalledTimes(1);
  });
});

describe('Inventario — duplicar pieza: errores', () => {
  it.each([
    [409, 'No se pudo dar una referencia nueva a la copia porque se estaban creando otras piezas a la vez. Vuelve a intentarlo.'],
    [500, 'Error al duplicar el mueble.'],
    [404, 'Mueble no encontrado.'],
    [0, 'No se pudo conectar con el servidor. Revisa tu conexión.']
  ])('si el servidor responde %s, enseña su motivo, no recarga y no abre ningún editor', async (status, error) => {
    duplicarMueble.mockResolvedValue({ data: null, error, status });
    const { user, showToast } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(error, 'error'));
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'success');
    expect(getMuebles).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 3, name: 'Editar Producto' })).not.toBeInTheDocument();
  });

  it('una respuesta sin la pieza nueva cuenta como error', async () => {
    duplicarMueble.mockResolvedValue({ data: { success: true, data: [] }, error: null, status: 201 });
    const { user, showToast } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('No se pudo duplicar la pieza.', 'error'));
    expect(screen.queryByRole('heading', { level: 3, name: 'Editar Producto' })).not.toBeInTheDocument();
  });

  it('después de un error se puede volver a intentar', async () => {
    duplicarMueble
      .mockResolvedValueOnce({ data: null, error: 'Error al duplicar el mueble.', status: 500 })
      .mockResolvedValueOnce({ data: { success: true, data: [COPIA] }, error: null, status: 201 });
    const { user } = await abrirInventario();

    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Duplicar pieza' })).not.toBeInTheDocument());
    await pedirDuplicar(user);
    await user.click(dialogo().getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(editor().getByDisplayValue('Silla Thonet (Copia)')).toBeInTheDocument());
    expect(duplicarMueble).toHaveBeenCalledTimes(2);
  });
});
