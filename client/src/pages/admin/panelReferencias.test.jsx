// A5: referencias de los muebles y códigos de las categorías en el panel. No son tests de
// caracterización (los Admin.*.test.jsx, congelados desde la tarea 4): describen lo nuevo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMueble, updateMueble, createCategoria, updateCategoria } from '../../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';

vi.mock('../../services/api');

const SILLA = {
  id: 'm1',
  nombre: 'Silla Tolix',
  categoria: 'Sillas',
  descripcion: 'Metal',
  precio_venta: 120,
  precio_alquiler_dia: null,
  imagenes: [],
  estado: 'disponible',
  referencia: 'NAV-SIL-001'
};
const MESA = { ...SILLA, id: 'm2', nombre: 'Mesa de roble', categoria: 'Mesas', referencia: 'NAV-MES-007' };
const SIN_REF = { ...SILLA, id: 'm3', nombre: 'Lámpara antigua', categoria: 'Lámparas', referencia: null };

// Como CATEGORIAS del ayudante, con código en dos de ellas.
const CON_CODIGOS = CATEGORIAS.map((c) => ({ ...c, codigo: { 11: 'SIL', 12: 'MES' }[c.id] ?? null }));

const nombresVisibles = () =>
  [...document.querySelectorAll('.inventory-list-item .inv-name')].map((el) => el.textContent);
const fila = (nombre) =>
  within(screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` }).closest('.inventory-list-item'));
const modal = (titulo) =>
  within(screen.getByRole('heading', { level: 3, name: titulo }).closest('.admin-modal-content'));
const campo = (titulo, etiqueta) =>
  modal(titulo).getByText(etiqueta).closest('.field-group').querySelector('input, select, textarea');
const tarjeta = (nombre) => within(screen.getByRole('heading', { level: 3, name: nombre }).closest('.cat-card'));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Inventario — referencia', () => {
  const abrirInventario = async () => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: [SILLA, MESA, SIN_REF], categorias: CON_CODIGOS });
    await irAPestana(user, 'Gestionar Inventario');
    return { user };
  };

  it('la tabla tiene la columna "Referencia" antes de "Nombre", y cada fila su referencia (vacía si no tiene)', async () => {
    await abrirInventario();

    const cabecera = [...document.querySelector('.inventory-head-row').querySelectorAll('span')].map((s) => s.textContent);
    expect(cabecera.indexOf('Referencia')).toBe(cabecera.indexOf('Nombre') - 1);
    expect(fila('Silla Tolix').getByText('NAV-SIL-001')).toHaveClass('inv-ref');
    expect(fila('Lámpara antigua').getByText('Lámpara antigua').previousElementSibling).toHaveTextContent(/^$/);
  });

  it('el buscador encuentra por referencia, sin distinguir mayúsculas', async () => {
    const { user } = await abrirInventario();

    await user.type(screen.getByPlaceholderText('Buscar por nombre o referencia...'), 'nav-mes');
    expect(nombresVisibles()).toEqual(['Mesa de roble']);

    await user.clear(screen.getByPlaceholderText('Buscar por nombre o referencia...'));
    await user.type(screen.getByPlaceholderText('Buscar por nombre o referencia...'), '-00');
    expect(nombresVisibles()).toEqual(['Silla Tolix', 'Mesa de roble']);
  });

  it('el modal de edición enseña la referencia en solo lectura, y no la manda al guardar', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirInventario();
    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar' }));

    const ref = campo('Editar Producto', 'Referencia:');
    expect(ref).toHaveValue('NAV-SIL-001');
    expect(ref).toHaveAttribute('readonly');
    expect(ref).toHaveAccessibleDescription('No editable');

    await user.click(modal('Editar Producto').getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    expect(updateMueble.mock.calls[0][1].has('referencia')).toBe(false);
  });

  it('una pieza sin referencia la enseña vacía, con "Sin referencia" de marcador', async () => {
    const { user } = await abrirInventario();
    await user.click(fila('Lámpara antigua').getByRole('button', { name: 'Editar' }));

    const ref = campo('Editar Producto', 'Referencia:');
    expect(ref).toHaveValue('');
    expect(ref).toHaveAttribute('placeholder', 'Sin referencia');
  });
});

describe('Añadir mueble — referencia', () => {
  it('avisa de que la referencia se genera sola, y no hay campo para escribirla ni se manda', async () => {
    createMueble.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    await renderAdmin({ categorias: CON_CODIGOS });
    await irAPestana(user, 'Añadir Mueble');

    expect(screen.getByText('Se generará automáticamente (NAV-XXX-000)')).toBeInTheDocument();
    expect(document.querySelector('[name="referencia"]')).toBeNull();

    await user.type(screen.getByPlaceholderText('Nombre del mueble'), 'Silla nueva');
    await user.type(screen.getByPlaceholderText('Descripción detallada'), 'De haya');
    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Nombre del mueble').closest('form'));
    });
    await waitFor(() => expect(createMueble).toHaveBeenCalledTimes(1));
    expect(createMueble.mock.calls[0][0].has('referencia')).toBe(false);
  });
});

describe('Categorías — código', () => {
  const abrirCategorias = async () => {
    const user = userEvent.setup();
    const utils = await renderAdmin({ categorias: CON_CODIGOS });
    await irAPestana(user, 'Gestionar Categorías');
    return { user, ...utils };
  };
  const campoCodigo = () => screen.getByPlaceholderText('Ej: SOF');
  const campoNombre = () => screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)');
  const crear = () =>
    act(async () => {
      fireEvent.submit(campoNombre().closest('form'));
    });

  it('cada tarjeta enseña su código, o "Sin código"', async () => {
    await abrirCategorias();

    expect(tarjeta('Sillas').getByText('SIL')).toHaveClass('cat-codigo');
    expect(tarjeta('Mesas').getByText('MES')).toBeInTheDocument();
    expect(tarjeta('Lámparas').getByText('Sin código')).toBeInTheDocument();
  });

  it('el campo solo deja letras, en mayúsculas y como mucho tres', async () => {
    const { user } = await abrirCategorias();

    await user.type(campoCodigo(), 's0f-áa');
    expect(campoCodigo()).toHaveValue('SFA');
  });

  it('crea la categoría con su código, y vacía el campo después', async () => {
    createCategoria.mockResolvedValue({ success: true, data: { id: 60 } });
    const { user, showToast } = await abrirCategorias();

    await user.type(campoNombre(), 'Sofás');
    await user.type(campoCodigo(), 'sof');
    await crear();

    expect(createCategoria.mock.calls[0][0].get('codigo')).toBe('SOF');
    expect(showToast).toHaveBeenCalledWith('Categoría creada correctamente', 'success');
    expect(campoCodigo()).toHaveValue('');
  });

  it('sin código, no manda el campo (la categoría se crea sin código)', async () => {
    createCategoria.mockResolvedValue({ success: true, data: { id: 61 } });
    const { user } = await abrirCategorias();

    await user.type(campoNombre(), 'Sofás');
    await crear();

    expect(createCategoria.mock.calls[0][0].has('codigo')).toBe(false);
  });

  it('un código de menos de 3 letras no se manda: avisa y conserva lo escrito', async () => {
    const { user, showToast } = await abrirCategorias();

    await user.type(campoNombre(), 'Sofás');
    await user.type(campoCodigo(), 'so');
    await crear();

    const mensaje = 'El código tiene que ser de 3 letras (A-Z), por ejemplo SIL.';
    expect(createCategoria).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(mensaje, 'error');
    expect(screen.getByText(mensaje)).toHaveClass('admin-status');
    expect(campoCodigo()).toHaveValue('SO');
  });

  it('un código que ya usa otra categoría no se manda, y dice cuál lo usa', async () => {
    const { user, showToast } = await abrirCategorias();

    await user.type(campoNombre(), 'Sillones');
    await user.type(campoCodigo(), 'sil');
    await crear();

    expect(createCategoria).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Ese código ya lo usa la categoría "Sillas".', 'error');
  });

  describe('modal de edición', () => {
    const C = 'Editar Categoría';
    const abrirEditor = async (nombre) => {
      const datos = await abrirCategorias();
      await datos.user.click(tarjeta(nombre).getByRole('button', { name: 'Editar' }));
      return datos;
    };

    it('trae el código y lo manda al guardar, aunque no se cambie (su propio código no cuenta como repetido)', async () => {
      updateCategoria.mockResolvedValue({ success: true });
      const { user } = await abrirEditor('Sillas');

      expect(campo(C, 'Código de 3 letras (opcional):')).toHaveValue('SIL');
      await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

      await waitFor(() => expect(updateCategoria).toHaveBeenCalledTimes(1));
      expect(updateCategoria.mock.calls[0][1].get('codigo')).toBe('SIL');
    });

    it('vaciarlo manda el campo vacío (la categoría se queda sin código)', async () => {
      updateCategoria.mockResolvedValue({ success: true });
      const { user } = await abrirEditor('Sillas');

      await user.clear(campo(C, 'Código de 3 letras (opcional):'));
      await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

      await waitFor(() => expect(updateCategoria).toHaveBeenCalledTimes(1));
      expect(updateCategoria.mock.calls[0][1].get('codigo')).toBe('');
    });

    it('cambiarlo a uno que ya usa otra categoría no guarda, y lo dice en el modal', async () => {
      const { user, showToast } = await abrirEditor('Sillas');

      await user.clear(campo(C, 'Código de 3 letras (opcional):'));
      await user.type(campo(C, 'Código de 3 letras (opcional):'), 'mes');
      await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

      const mensaje = 'Ese código ya lo usa la categoría "Mesas".';
      expect(updateCategoria).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(mensaje, 'error');
      expect(modal(C).getByText(mensaje)).toBeInTheDocument();
    });
  });
});
