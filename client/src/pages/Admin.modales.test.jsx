// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen lo que hacen
// hoy los dos modales de edición (mueble y categoría), aunque algo no guste. Desde el primer commit
// del refactor no se tocan; si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMuebles, getCategorias, updateMueble, updateCategoria } from '../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

const SOFA = {
  id: 'm1',
  nombre: 'Sofá chester',
  categoria: 'Mesas',
  categoria_id: 12,
  descripcion: 'Sofá de tres plazas',
  estado: null,
  precio_venta: 900,
  precio_alquiler_dia: 30,
  imagenes: ['https://img.test/sofa-1.jpg', 'https://img.test/sofa-2.jpg']
};
const SIN_DATOS = {
  id: 'm2',
  nombre: 'Baúl antiguo',
  categoria: 'Lámparas',
  categoria_id: 21,
  descripcion: null,
  estado: 'vendido',
  precio_venta: 0,
  precio_alquiler_dia: null,
  imagenes: []
};
const CATEGORIAS_CON_IMAGEN = CATEGORIAS.map((c) =>
  c.id === 12 ? { ...c, imagen_url: 'https://img.test/mesas.jpg' } : c
);

const foto = (nombre) => new File(['x'], nombre, { type: 'image/jpeg' });

// El modal se localiza por su título, y cada campo por el texto de su <label> (que no está
// asociada con htmlFor): se sube al .field-group que comparten. HTML congelado (diseño, sección 8).
const modal = (titulo) =>
  within(screen.getByRole('heading', { level: 3, name: titulo }).closest('.admin-modal-content'));
const campo = (titulo, etiqueta) =>
  modal(titulo).getByText(etiqueta).closest('.field-group').querySelector('input, select, textarea');
const dialogo = (titulo) =>
  within(screen.getByRole('heading', { level: 3, name: titulo }).closest('.confirm-box'));
const enviado = (mock) => mock.mock.calls[0][1];

const abrirEditorMueble = async (pieza = SOFA) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles: [pieza], categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  const filaPieza = screen.getByRole('checkbox', { name: `Seleccionar ${pieza.nombre}` }).closest('.inventory-list-item');
  await user.click(within(filaPieza).getByRole('button', { name: 'Editar' }));
  return { user, ...utils };
};
const P = 'Editar Producto';

const abrirEditorCategoria = async (nombreTarjeta) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ categorias: CATEGORIAS_CON_IMAGEN });
  await irAPestana(user, 'Gestionar Categorías');
  const tarjeta = screen.getByRole('heading', { level: 3, name: nombreTarjeta }).closest('.cat-card');
  await user.click(within(tarjeta).getByRole('button', { name: 'Editar' }));
  return { user, ...utils };
};
const C = 'Editar Categoría';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Modal de edición de mueble — al abrir', () => {
  it('trae los datos de la pieza; el alquiler sale de precio_alquiler_dia y un estado vacío como "Disponible"', async () => {
    await abrirEditorMueble();

    expect(campo(P, 'Nombre del Mueble:')).toHaveValue('Sofá chester');
    expect(campo(P, 'Categoría:')).toHaveValue('Mesas');
    expect(campo(P, 'Descripción:')).toHaveValue('Sofá de tres plazas');
    expect(campo(P, 'Venta (€):')).toHaveValue(900);
    expect(campo(P, 'Alquiler (€/día):')).toHaveValue(30);
    expect(campo(P, 'Estado:')).toHaveValue('disponible');
  });

  it('enseña las fotos actuales con su botón para quitarlas', async () => {
    await abrirEditorMueble();

    expect(modal(P).getByRole('img', { name: 'Mueble 0' })).toHaveAttribute('src', 'https://img.test/sofa-1.jpg');
    expect(modal(P).getByRole('img', { name: 'Mueble 1' })).toHaveAttribute('src', 'https://img.test/sofa-2.jpg');
  });

  it('el selector de categoría agrupa las específicas bajo su general, como el de "Añadir mueble"', async () => {
    await abrirEditorMueble();

    const grupos = [...campo(P, 'Categoría:').querySelectorAll('optgroup')].map((g) => ({
      general: g.label,
      especificas: [...g.querySelectorAll('option')].map((o) => o.value)
    }));
    expect(grupos).toEqual([
      { general: 'Decoración y hogar', especificas: ['Lámparas'] },
      { general: 'Mobiliario', especificas: ['Mesas', 'Sillas'] }
    ]);
  });

  it('una pieza sin descripción abre con el campo vacío, y la descripción es obligatoria', async () => {
    // Todas las piezas reales tienen la descripción a NULL (24 sep): para guardar cualquiera de
    // ellas desde el modal, el navegador obliga a escribir una descripción.
    await abrirEditorMueble(SIN_DATOS);

    expect(campo(P, 'Descripción:')).toHaveValue('');
    expect(campo(P, 'Descripción:')).toBeRequired();
    expect(campo(P, 'Nombre del Mueble:')).toBeRequired();
    expect(campo(P, 'Categoría:')).toBeRequired();
    expect(modal(P).queryByRole('img')).not.toBeInTheDocument();
  });

  it('"Cerrar" cierra el modal sin guardar', async () => {
    const { user } = await abrirEditorMueble();

    await user.click(modal(P).getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('heading', { level: 3, name: P })).not.toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
  });
});

describe('Modal de edición de mueble — guardar', () => {
  it('sin cambios, manda todos los campos, el id de la categoría y las fotos actuales; avisa, cierra y recarga', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirEditorMueble();

    await user.click(modal(P).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Producto actualizado correctamente', 'success'));
    expect(updateMueble).toHaveBeenCalledTimes(1);
    expect(updateMueble.mock.calls[0][0]).toBe('m1');
    const datos = enviado(updateMueble);
    expect(datos).toBeInstanceOf(FormData);
    expect(datos.get('nombre')).toBe('Sofá chester');
    expect(datos.get('categoria')).toBe('Mesas');
    expect(datos.get('categoria_id')).toBe('12');
    expect(datos.get('descripcion')).toBe('Sofá de tres plazas');
    expect(datos.get('precio_venta')).toBe('900');
    expect(datos.get('precio_alquiler')).toBe('30');
    expect(datos.get('estado')).toBe('disponible');
    expect(JSON.parse(datos.get('imagenes_existentes'))).toEqual(['https://img.test/sofa-1.jpg', 'https://img.test/sofa-2.jpg']);
    expect(datos.has('imagenes')).toBe(false);

    expect(screen.queryByRole('heading', { level: 3, name: P })).not.toBeInTheDocument();
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(getMuebles).toHaveBeenLastCalledWith({ fresco: true });
  });

  it('manda lo editado y las fotos nuevas', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirEditorMueble();

    await user.clear(campo(P, 'Nombre del Mueble:'));
    await user.type(campo(P, 'Nombre del Mueble:'), 'Sofá restaurado');
    await user.selectOptions(campo(P, 'Categoría:'), 'Sillas');
    await user.selectOptions(campo(P, 'Estado:'), 'alquilado');
    await user.upload(modal(P).getByText('Añadir más imágenes (Opcional):').parentElement.querySelector('input'), [
      foto('nueva-1.jpg'),
      foto('nueva-2.jpg')
    ]);
    await user.click(modal(P).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    const datos = enviado(updateMueble);
    expect(datos.get('nombre')).toBe('Sofá restaurado');
    expect(datos.get('categoria')).toBe('Sillas');
    expect(datos.get('categoria_id')).toBe('11');
    expect(datos.get('estado')).toBe('alquilado');
    expect(datos.getAll('imagenes').map((f) => f.name)).toEqual(['nueva-1.jpg', 'nueva-2.jpg']);
  });

  it('los precios vacíos se mandan como texto vacío, también un precio 0', async () => {
    // CARACTERIZACIÓN: guardar sin tocar los precios cambia la base de datos si uno era 0: sale
    // como "" y el servidor lo guarda como NULL. La descripción, al ser obligatoria, hay que
    // escribirla para poder guardar una pieza que no la tenía.
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirEditorMueble(SIN_DATOS);

    await user.type(campo(P, 'Descripción:'), 'Baúl');
    await user.click(modal(P).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    const datos = enviado(updateMueble);
    expect(datos.get('precio_venta')).toBe('');
    expect(datos.get('precio_alquiler')).toBe('');
    expect(datos.get('estado')).toBe('vendido');
    expect(JSON.parse(datos.get('imagenes_existentes'))).toEqual([]);
  });

  it('quitar una foto pide confirmación, la quita solo de la vista previa y se guarda sin ella', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirEditorMueble();

    const miniatura = modal(P).getByRole('img', { name: 'Mueble 1' }).closest('.image-thumb');
    await user.click(within(miniatura).getByRole('button'));
    const confirmacion = dialogo('Eliminar Imagen de Producto');
    expect(
      confirmacion.getByText(
        '¿Estás seguro de que deseas eliminar esta imagen de este producto? Se quitará de la previsualización actual.'
      )
    ).toBeInTheDocument();
    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(modal(P).queryByRole('img', { name: 'Mueble 1' })).not.toBeInTheDocument());
    expect(modal(P).getByRole('img', { name: 'Mueble 0' })).toHaveAttribute('src', 'https://img.test/sofa-1.jpg');
    expect(updateMueble).not.toHaveBeenCalled();

    await user.click(modal(P).getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    expect(JSON.parse(enviado(updateMueble).get('imagenes_existentes'))).toEqual(['https://img.test/sofa-1.jpg']);
  });

  it('cancelar la confirmación deja la foto', async () => {
    const { user } = await abrirEditorMueble();

    const miniatura = modal(P).getByRole('img', { name: 'Mueble 0' }).closest('.image-thumb');
    await user.click(within(miniatura).getByRole('button'));
    await user.click(dialogo('Eliminar Imagen de Producto').getByRole('button', { name: 'Cancelar' }));

    expect(modal(P).getByRole('img', { name: 'Mueble 0' })).toBeInTheDocument();
  });

  it('mientras guarda, "Guardar Cambios" está desactivado', async () => {
    let terminar;
    updateMueble.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    const { user } = await abrirEditorMueble();

    await user.click(modal(P).getByRole('button', { name: 'Guardar Cambios' }));

    expect(modal(P).getByRole('button', { name: 'Guardar Cambios' })).toBeDisabled();
    await act(async () => terminar({ success: true }));
    expect(screen.queryByRole('heading', { level: 3, name: P })).not.toBeInTheDocument();
  });

  it('si falla, avisa del error, el modal sigue abierto con lo escrito y no recarga', async () => {
    updateMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirEditorMueble();
    await user.clear(campo(P, 'Nombre del Mueble:'));
    await user.type(campo(P, 'Nombre del Mueble:'), 'Nombre nuevo');

    await user.click(modal(P).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Error al actualizar el producto', 'error'));
    expect(campo(P, 'Nombre del Mueble:')).toHaveValue('Nombre nuevo');
    expect(modal(P).getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
    expect(getMuebles).toHaveBeenCalledTimes(1);
  });
});

describe('Modal de edición de categoría', () => {
  it('trae el nombre, su categoría general y la imagen actual', async () => {
    await abrirEditorCategoria('Mesas');

    expect(campo(C, 'Nombre de la Categoría:')).toHaveValue('Mesas');
    expect(campo(C, 'Categoría general (opcional):')).toHaveValue('1');
    expect(modal(C).getByRole('img', { name: 'Categoría' })).toHaveAttribute('src', 'https://img.test/mesas.jpg');
  });

  it('el selector de general ofrece las generales menos ella misma', async () => {
    await abrirEditorCategoria('Mobiliario (general)');

    expect(campo(C, 'Categoría general (opcional):')).toHaveValue('');
    expect([...campo(C, 'Categoría general (opcional):').options].map((o) => [o.value, o.textContent])).toEqual([
      ['', '— Es una categoría general —'],
      ['2', 'Dentro de: Decoración y hogar']
    ]);
  });

  it('sin imagen nueva, manda nombre, general e imagen_url; avisa, cierra y recarga las categorías', async () => {
    updateCategoria.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirEditorCategoria('Mesas');

    await user.clear(campo(C, 'Nombre de la Categoría:'));
    await user.type(campo(C, 'Nombre de la Categoría:'), 'Mesas y consolas');
    await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Categoría actualizada correctamente', 'success'));
    expect(updateCategoria.mock.calls[0][0]).toBe(12);
    const datos = enviado(updateCategoria);
    expect(datos.get('nombre')).toBe('Mesas y consolas');
    expect(datos.get('categoria_padre_id')).toBe('1');
    expect(datos.get('imagen_url')).toBe('https://img.test/mesas.jpg');
    expect(datos.has('imagen')).toBe(false);
    expect(screen.queryByRole('heading', { level: 3, name: C })).not.toBeInTheDocument();
    expect(getCategorias).toHaveBeenCalledTimes(2);
  });

  it('con imagen nueva, manda el archivo en vez de imagen_url', async () => {
    updateCategoria.mockResolvedValue({ success: true });
    const { user } = await abrirEditorCategoria('Mesas');

    await user.upload(modal(C).getByText('Reemplazar Imagen (Opcional):').parentElement.querySelector('input'), foto('nueva.jpg'));
    await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateCategoria).toHaveBeenCalledTimes(1));
    const datos = enviado(updateCategoria);
    expect(datos.get('imagen').name).toBe('nueva.jpg');
    expect(datos.has('imagen_url')).toBe(false);
  });

  it('pasarla a general manda categoria_padre_id vacío', async () => {
    updateCategoria.mockResolvedValue({ success: true });
    const { user } = await abrirEditorCategoria('Mesas');

    await user.selectOptions(campo(C, 'Categoría general (opcional):'), '');
    await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateCategoria).toHaveBeenCalledTimes(1));
    expect(enviado(updateCategoria).get('categoria_padre_id')).toBe('');
  });

  it('quitar la imagen pide confirmación y se guarda con imagen_url vacía', async () => {
    updateCategoria.mockResolvedValue({ success: true });
    const { user } = await abrirEditorCategoria('Mesas');

    await user.click(within(modal(C).getByRole('img', { name: 'Categoría' }).closest('.image-thumb')).getByRole('button'));
    const confirmacion = dialogo('Eliminar Imagen de Categoría');
    expect(confirmacion.getByText('¿Estás seguro de que deseas eliminar la imagen representativa de esta categoría?')).toBeInTheDocument();
    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(modal(C).queryByRole('img', { name: 'Categoría' })).not.toBeInTheDocument());
    await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(updateCategoria).toHaveBeenCalledTimes(1));
    expect(enviado(updateCategoria).get('imagen_url')).toBe('');
  });

  it('si falla, avisa del error y el modal sigue abierto', async () => {
    updateCategoria.mockResolvedValue(null);
    const { user, showToast } = await abrirEditorCategoria('Mesas');

    await user.click(modal(C).getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Error al actualizar la categoría', 'error'));
    expect(screen.getByRole('heading', { level: 3, name: C })).toBeInTheDocument();
    expect(getCategorias).toHaveBeenCalledTimes(1);
  });

  it('"Cerrar" cierra sin guardar', async () => {
    const { user } = await abrirEditorCategoria('Mesas');

    await user.click(modal(C).getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('heading', { level: 3, name: C })).not.toBeInTheDocument();
    expect(updateCategoria).not.toHaveBeenCalled();
  });
});
