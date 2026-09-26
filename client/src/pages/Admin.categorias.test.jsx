// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen lo que hace
// hoy la pestaña "Gestionar Categorías", aunque algo no guste. Desde el primer commit del refactor
// no se tocan; si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCategorias, createCategoria, deleteCategoria } from '../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

const stats = (totalProductos, disponibles, vendidos, alquilados, valorTotalVenta) => ({
  totalProductos,
  disponibles,
  vendidos,
  alquilados,
  valorTotalVenta
});

// Como CATEGORIAS del ayudante, con estadísticas distintas en dos de ellas, una categoría sin
// estadísticas y una "huérfana" (su categoría general no existe).
const CON_STATS = [
  ...CATEGORIAS.map((c) => (c.id === 11 ? { ...c, stats: stats(4, 2, 1, 1, '850,00 €') } : c)),
  { id: 13, nombre: 'Sofás', categoria_padre_id: 1, imagen_url: null },
  { id: 99, nombre: 'Huérfana', categoria_padre_id: 777, imagen_url: null, stats: stats(0, 0, 0, 0, '0,00 €') }
];

const abrirCategorias = async (categorias = CON_STATS) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ categorias });
  await irAPestana(user, 'Gestionar Categorías');
  return { user, ...utils };
};

// Depende del HTML congelado (diseño de la tarea 4, sección 8): cada grupo es un .cat-group con
// su título, y cada categoría una .cat-card con su nombre en un <h3>.
const grupos = () =>
  [...document.querySelectorAll('.cat-group')].map((g) => ({
    general: g.querySelector('.cat-group-title').textContent,
    tarjetas: [...g.querySelectorAll('.cat-card h3')].map((h) => h.textContent)
  }));
const tarjeta = (nombre) => within(screen.getByRole('heading', { level: 3, name: nombre }).closest('.cat-card'));
const campoNombre = () => screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)');
const selectorPadre = () => screen.getByDisplayValue('— Es una categoría general —');
const selectorImagen = () => document.getElementById('categoria-file-input');
const dialogo = (titulo) =>
  within(screen.getByRole('heading', { level: 3, name: titulo }).closest('.confirm-box'));
const imagen = () => new File(['x'], 'categoria.jpg', { type: 'image/jpeg' });

// Como en Admin.crear.test.jsx: jsdom no cuenta los archivos de userEvent.upload al validar el
// `required` del selector de imagen, así que el formulario se envía con su evento submit.
const crear = () =>
  act(async () => {
    fireEvent.submit(campoNombre().closest('form'));
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Categorías — listado', () => {
  it('agrupa por categoría general: primero la general (marcada) y luego sus específicas, en el orden de la API', async () => {
    await abrirCategorias();

    expect(screen.getByRole('heading', { level: 2, name: 'Gestionar Categorías' })).toBeInTheDocument();
    expect(grupos()).toEqual([
      { general: 'Decoración y hogar', tarjetas: ['Decoración y hogar (general)', 'Lámparas'] },
      { general: 'Mobiliario', tarjetas: ['Mobiliario (general)', 'Mesas', 'Sillas', 'Sofás'] }
    ]);
  });

  it('una categoría cuya general no existe no aparece en ningún grupo', async () => {
    // CARACTERIZACIÓN: la "Huérfana" (categoria_padre_id que no es de ninguna general) existe en
    // los datos, pero la pantalla no la enseña ni deja editarla o borrarla.
    await abrirCategorias();

    expect(screen.queryByText(/Huérfana/)).not.toBeInTheDocument();
  });

  it('cada tarjeta enseña sus estadísticas, o "Cargando analíticas..." si no llegaron', async () => {
    await abrirCategorias();

    const sillas = tarjeta('Sillas');
    expect(sillas.getByText('Productos totales:', { exact: false })).toHaveTextContent('Productos totales: 4');
    expect(sillas.getByText('Stock: 2 disponibles · 1 vendidos · 1 alquilados')).toBeInTheDocument();
    expect(sillas.getByText('850,00 €')).toBeInTheDocument();

    expect(tarjeta('Sofás').getByText('Cargando analíticas...')).toBeInTheDocument();
  });

  it('cada tarjeta, general o específica, tiene sus botones de editar y borrar', async () => {
    await abrirCategorias();

    for (const nombre of ['Mobiliario (general)', 'Mesas']) {
      expect(tarjeta(nombre).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(tarjeta(nombre).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    }
  });
});

describe('Categorías — crear', () => {
  it('el selector de "categoría general" ofrece ser general o ir dentro de una de las generales', async () => {
    await abrirCategorias();

    expect([...selectorPadre().options].map((o) => [o.value, o.textContent])).toEqual([
      ['', '— Es una categoría general —'],
      ['2', 'Dentro de: Decoración y hogar'],
      ['1', 'Dentro de: Mobiliario']
    ]);
    expect(campoNombre()).toBeRequired();
    expect(selectorImagen()).toBeRequired();
  });

  it('crea una categoría general: manda nombre, padre vacío e imagen; avisa, vacía el formulario y recarga', async () => {
    createCategoria.mockResolvedValue({ success: true, data: { id: 50 } });
    const { user, showToast } = await abrirCategorias();

    await user.type(campoNombre(), 'Exterior');
    await user.upload(selectorImagen(), imagen());
    await crear();

    expect(createCategoria).toHaveBeenCalledTimes(1);
    const enviado = createCategoria.mock.calls[0][0];
    expect(enviado).toBeInstanceOf(FormData);
    expect(enviado.get('nombre')).toBe('Exterior');
    expect(enviado.get('categoria_padre_id')).toBe('');
    expect(enviado.get('imagen').name).toBe('categoria.jpg');

    expect(showToast).toHaveBeenCalledWith('Categoría creada correctamente', 'success');
    expect(campoNombre()).toHaveValue('');
    expect(selectorPadre()).toHaveValue('');
    expect(getCategorias).toHaveBeenCalledTimes(2);
    expect(getCategorias).toHaveBeenLastCalledWith({ fresco: true });
  });

  it('crea una categoría dentro de otra: manda el id de la general', async () => {
    createCategoria.mockResolvedValue({ success: true, data: { id: 51 } });
    const { user } = await abrirCategorias();

    await user.type(campoNombre(), 'Taburetes');
    await user.selectOptions(selectorPadre(), '1');
    await crear();

    expect(createCategoria.mock.calls[0][0].get('categoria_padre_id')).toBe('1');
    // Sin imagen elegida no se manda el campo (la obligatoriedad la pone el navegador, no el código).
    expect(createCategoria.mock.calls[0][0].has('imagen')).toBe(false);
  });

  it('si falla, avisa del error y conserva lo escrito', async () => {
    createCategoria.mockResolvedValue(null);
    const { user, showToast } = await abrirCategorias();

    await user.type(campoNombre(), 'Exterior');
    await user.selectOptions(selectorPadre(), '2');
    await crear();

    expect(showToast).toHaveBeenCalledWith('Error al crear la categoría', 'error');
    expect(campoNombre()).toHaveValue('Exterior');
    expect(document.querySelector('.cat-add-form select')).toHaveValue('2');
    expect(getCategorias).toHaveBeenCalledTimes(1);
  });

  it('sin nombre no llama a la API', async () => {
    await abrirCategorias();

    await crear();

    expect(createCategoria).not.toHaveBeenCalled();
  });

  it('"Crear Categoría" no se desactiva mientras se crea: dos envíos seguidos hacen dos altas', async () => {
    // CARACTERIZACIÓN: comportamiento actual discutible (H14): el botón no se desactiva durante el
    // envío, así que un doble clic manda dos altas antes de que vuelva la primera.
    let terminar;
    createCategoria.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    const { user } = await abrirCategorias();
    await user.type(campoNombre(), 'Exterior');

    await crear();
    expect(screen.getByRole('button', { name: 'Crear Categoría' })).toBeEnabled();
    await crear();

    expect(createCategoria).toHaveBeenCalledTimes(2);
    await act(async () => terminar({ success: true }));
  });
});

describe('Categorías — borrar', () => {
  it('pide confirmación y, al confirmar, borra, avisa y recarga', async () => {
    deleteCategoria.mockResolvedValue({ success: true, message: 'Categoría eliminada.' });
    const { user, showToast } = await abrirCategorias();

    await user.click(tarjeta('Mesas').getByRole('button', { name: 'Eliminar' }));
    const confirmacion = dialogo('Eliminar Categoría');
    expect(
      confirmacion.getByText('¿Deseas eliminar esta categoría? Si tiene muebles asociados podrían quedarse sin categoría.')
    ).toBeInTheDocument();
    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Categoría eliminada', 'success'));
    expect(deleteCategoria).toHaveBeenCalledWith(12);
    expect(getCategorias).toHaveBeenCalledTimes(2);
  });

  it('también se puede borrar una categoría general', async () => {
    deleteCategoria.mockResolvedValue({ success: true });
    const { user } = await abrirCategorias();

    await user.click(tarjeta('Mobiliario (general)').getByRole('button', { name: 'Eliminar' }));
    await user.click(dialogo('Eliminar Categoría').getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(deleteCategoria).toHaveBeenCalledWith(1));
  });

  it('avisa de éxito aunque falle', async () => {
    // CARACTERIZACIÓN: comportamiento actual incorrecto (H12): enseña éxito aunque deleteCategoria devuelva null.
    deleteCategoria.mockResolvedValue(null);
    const { user, showToast } = await abrirCategorias();

    await user.click(tarjeta('Mesas').getByRole('button', { name: 'Eliminar' }));
    await user.click(dialogo('Eliminar Categoría').getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Categoría eliminada', 'success'));
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('cancelar la confirmación no borra nada', async () => {
    const { user } = await abrirCategorias();

    await user.click(tarjeta('Mesas').getByRole('button', { name: 'Eliminar' }));
    await user.click(dialogo('Eliminar Categoría').getByRole('button', { name: 'Cancelar' }));

    expect(deleteCategoria).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { level: 3, name: 'Eliminar Categoría' })).not.toBeInTheDocument();
  });
});

describe('Categorías — editar', () => {
  it('el lápiz de una tarjeta abre el modal de edición con esa categoría', async () => {
    const { user } = await abrirCategorias();

    await user.click(tarjeta('Mesas').getByRole('button', { name: 'Editar' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Editar Categoría' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mesas')).toBeInTheDocument();
  });
});
