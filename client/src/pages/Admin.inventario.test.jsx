// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen lo que hace
// hoy la pestaña "Gestionar Inventario", aunque algo no guste. Desde el primer commit del
// refactor no se tocan; si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMuebles, updateMueble, deleteMueble } from '../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

const mueble = (id, nombre, extra = {}) => ({
  id,
  nombre,
  categoria: 'Sillas',
  categoria_id: 11,
  estado: 'disponible',
  precio_venta: 100,
  precio_alquiler_dia: null,
  imagenes: [`https://img.test/${id}.jpg`],
  ...extra
});

// En el orden en que llegan de la API, que es el de "Más recientes".
const CATALOGO = [
  mueble('m1', 'Silla Tolix', { precio_venta: 1250 }),
  mueble('m2', 'Mesa de roble', { categoria: 'Mesas', categoria_id: 12, estado: 'vendido', precio_venta: 300 }),
  mueble('m3', 'Lámpara de pie', {
    categoria: 'Lámparas',
    categoria_id: 21,
    estado: null,
    precio_venta: null,
    precio_alquiler_dia: 40,
    imagenes: []
  }),
  mueble('m4', 'Aparador', { categoria: null, categoria_id: null, estado: 'alquilado', precio_venta: null, imagenes: null }),
  mueble('m5', 'Banco de iglesia', { categoria: 'Mesas', categoria_id: 12, precio_venta: 12500 })
];

// 25 piezas "Pieza 01".."Pieza 25", para la paginación (20 por página).
const muchas = (n) =>
  Array.from({ length: n }, (_, i) => mueble(`p${i + 1}`, `Pieza ${String(i + 1).padStart(2, '0')}`));

const abrirInventario = async (muebles = CATALOGO) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles, categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  return { user, ...utils };
};

// Depende de las clases .inventory-list-item/.inv-name y del orden de los <select> de la barra
// de herramientas: el HTML está congelado por el diseño de la tarea 4 (sección 8). Los <select>
// no tienen <label>.
const nombresVisibles = () =>
  [...document.querySelectorAll('.inventory-list-item .inv-name')].map((el) => el.textContent);
const filtros = () => {
  const [categoria, estado, orden] = document.querySelectorAll('.admin-toolbar select');
  return { categoria, estado, orden };
};
const casilla = (nombre) => screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` });
const fila = (nombre) => within(casilla(nombre).closest('.inventory-list-item'));
const casillaDePagina = () => screen.getByRole('checkbox', { name: 'Seleccionar todos' });
// El diálogo de confirmación (ConfirmModal) se localiza por su título.
const dialogo = (titulo) =>
  within(screen.getByRole('heading', { level: 3, name: titulo }).closest('.confirm-box'));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Inventario — listado', () => {
  it('cabecera con el recuento, y cada fila con nombre, categoría, estado y precio', async () => {
    await abrirInventario();

    expect(screen.getByRole('heading', { level: 2, name: 'Gestionar Inventario' })).toBeInTheDocument();
    expect(screen.getByText('5 de 5 productos')).toBeInTheDocument();
    expect(nombresVisibles()).toEqual(['Silla Tolix', 'Mesa de roble', 'Lámpara de pie', 'Aparador', 'Banco de iglesia']);

    expect(fila('Silla Tolix').getByText('Sillas')).toBeInTheDocument();
    expect(fila('Silla Tolix').getByText('1250€')).toBeInTheDocument();
    expect(fila('Banco de iglesia').getByText('12.500€')).toBeInTheDocument();
    // Sin precio de venta, el de alquiler; sin ninguno, una raya. Sin categoría, otra raya.
    expect(fila('Lámpara de pie').getByText('40€/día')).toBeInTheDocument();
    expect(fila('Aparador').getAllByText('—')).toHaveLength(2);
  });

  it('el estado de cada fila es un selector; una pieza sin estado sale como "Disponible"', async () => {
    await abrirInventario();

    expect(fila('Mesa de roble').getByRole('combobox')).toHaveValue('vendido');
    expect(fila('Aparador').getByRole('combobox')).toHaveValue('alquilado');
    expect(fila('Lámpara de pie').getByRole('combobox')).toHaveValue('disponible');
  });

  it('usa la primera foto de cada pieza, o la imagen genérica si no tiene (lista vacía o null)', async () => {
    await abrirInventario();

    expect(fila('Silla Tolix').getByRole('img')).toHaveAttribute('src', 'https://img.test/m1.jpg');
    expect(fila('Lámpara de pie').getByRole('img')).toHaveAttribute('src', '/img/sin-imagen.svg');
    expect(fila('Aparador').getByRole('img')).toHaveAttribute('src', '/img/sin-imagen.svg');
  });

  it('sin productos, "0 de 0" y el mensaje de que nada coincide', async () => {
    await abrirInventario([]);

    expect(screen.getByText('0 de 0 productos')).toBeInTheDocument();
    expect(screen.getByText('No hay productos que coincidan con estos filtros.')).toBeInTheDocument();
  });
});

describe('Inventario — búsqueda y filtros', () => {
  it('la búsqueda filtra por nombre, sin distinguir mayúsculas y sin contar los espacios de los lados', async () => {
    const { user } = await abrirInventario();
    const buscador = screen.getByPlaceholderText('Buscar por nombre...');

    await user.type(buscador, 'LÁMPARA');
    expect(nombresVisibles()).toEqual(['Lámpara de pie']);
    expect(screen.getByText('1 de 5 productos')).toBeInTheDocument();

    await user.clear(buscador);
    await user.type(buscador, '  mesa ');
    expect(nombresVisibles()).toEqual(['Mesa de roble']);
  });

  it('el filtro de categoría ofrece todas las categorías (también las generales) y compara el nombre exacto', async () => {
    const { user } = await abrirInventario();
    const opciones = [...filtros().categoria.options].map((o) => o.textContent);
    expect(opciones).toEqual(['Todas las categorías', 'Decoración y hogar', 'Lámparas', 'Mesas', 'Mobiliario', 'Sillas']);

    await user.selectOptions(filtros().categoria, 'Mesas');
    expect(nombresVisibles()).toEqual(['Mesa de roble', 'Banco de iglesia']);
  });

  it('elegir una categoría general no enseña nada: las piezas llevan el nombre de su categoría específica', async () => {
    const { user } = await abrirInventario();

    await user.selectOptions(filtros().categoria, 'Mobiliario');

    expect(nombresVisibles()).toEqual([]);
    expect(screen.getByText('No hay productos que coincidan con estos filtros.')).toBeInTheDocument();
  });

  it('el filtro de estado cuenta una pieza sin estado como "disponible"', async () => {
    const { user } = await abrirInventario();

    await user.selectOptions(filtros().estado, 'disponible');
    expect(nombresVisibles()).toEqual(['Silla Tolix', 'Lámpara de pie', 'Banco de iglesia']);

    await user.selectOptions(filtros().estado, 'vendido');
    expect(nombresVisibles()).toEqual(['Mesa de roble']);

    await user.selectOptions(filtros().estado, 'alquilado');
    expect(nombresVisibles()).toEqual(['Aparador']);
  });

  it('los filtros se combinan entre sí', async () => {
    const { user } = await abrirInventario();

    await user.selectOptions(filtros().categoria, 'Mesas');
    await user.selectOptions(filtros().estado, 'disponible');

    expect(nombresVisibles()).toEqual(['Banco de iglesia']);
    expect(screen.getByText('1 de 5 productos')).toBeInTheDocument();
  });

  it('"Limpiar filtros" solo aparece con algún filtro u orden distinto, y lo deja todo como al principio', async () => {
    const { user } = await abrirInventario();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Buscar por nombre...'), 'a');
    await user.selectOptions(filtros().categoria, 'Mesas');
    await user.selectOptions(filtros().estado, 'vendido');
    await user.selectOptions(filtros().orden, 'nombre');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getByPlaceholderText('Buscar por nombre...')).toHaveValue('');
    expect(filtros().categoria).toHaveValue('');
    expect(filtros().estado).toHaveValue('');
    expect(filtros().orden).toHaveValue('recientes');
    expect(nombresVisibles()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('cambiar solo el orden también hace aparecer "Limpiar filtros"', async () => {
    const { user } = await abrirInventario();

    await user.selectOptions(filtros().orden, 'precio_desc');

    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
  });
});

describe('Inventario — orden', () => {
  it('"Más recientes" es el orden en que llegan de la API', async () => {
    await abrirInventario();

    expect(filtros().orden).toHaveValue('recientes');
    expect(nombresVisibles()).toEqual(['Silla Tolix', 'Mesa de roble', 'Lámpara de pie', 'Aparador', 'Banco de iglesia']);
  });

  it('"Nombre A-Z" ordena alfabéticamente', async () => {
    const { user } = await abrirInventario();

    await user.selectOptions(filtros().orden, 'nombre');

    expect(nombresVisibles()).toEqual(['Aparador', 'Banco de iglesia', 'Lámpara de pie', 'Mesa de roble', 'Silla Tolix']);
  });

  it('por precio ordena por el de venta; sin precio de venta cuenta como 0 (y los empates mantienen el orden de la API)', async () => {
    const { user } = await abrirInventario();

    await user.selectOptions(filtros().orden, 'precio_asc');
    expect(nombresVisibles()).toEqual(['Lámpara de pie', 'Aparador', 'Mesa de roble', 'Silla Tolix', 'Banco de iglesia']);

    await user.selectOptions(filtros().orden, 'precio_desc');
    expect(nombresVisibles()).toEqual(['Banco de iglesia', 'Silla Tolix', 'Mesa de roble', 'Lámpara de pie', 'Aparador']);
  });
});

describe('Inventario — paginación', () => {
  it('enseña 20 por página, con "Anterior" desactivado en la primera y "Siguiente" en la última', async () => {
    const { user } = await abrirInventario(muchas(25));

    expect(nombresVisibles()).toHaveLength(20);
    expect(nombresVisibles()[0]).toBe('Pieza 01');
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Siguiente →' }));

    expect(nombresVisibles()).toEqual(['Pieza 21', 'Pieza 22', 'Pieza 23', 'Pieza 24', 'Pieza 25']);
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '← Anterior' }));
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
  });

  it('con 20 piezas o menos no hay paginación', async () => {
    await abrirInventario(muchas(20));

    expect(nombresVisibles()).toHaveLength(20);
    expect(screen.queryByText(/^Página/)).not.toBeInTheDocument();
  });

  it('cambiar un filtro vuelve a la página 1', async () => {
    const { user } = await abrirInventario(muchas(45));
    await user.click(screen.getByRole('button', { name: 'Siguiente →' }));
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();

    await user.selectOptions(filtros().estado, 'disponible');

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('si la página en la que estabas deja de existir (p. ej. tras borrar), se enseña la última que queda', async () => {
    deleteMueble.mockResolvedValue({ success: true });
    const { user } = await abrirInventario(muchas(21));
    await user.click(screen.getByRole('button', { name: 'Siguiente →' }));
    expect(nombresVisibles()).toEqual(['Pieza 21']);

    getMuebles.mockResolvedValue(muchas(20)); // lo que devolverá la recarga tras el borrado
    await user.click(fila('Pieza 21').getByRole('button', { name: 'Eliminar' }));
    await user.click(dialogo('Eliminar Mueble').getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(nombresVisibles()).toHaveLength(20));
    expect(nombresVisibles()[0]).toBe('Pieza 01');
    expect(screen.queryByText(/^Página/)).not.toBeInTheDocument();
  });
});

describe('Inventario — selección', () => {
  it('marcar filas enseña la barra de acciones en lote con el recuento (singular y plural)', async () => {
    const { user } = await abrirInventario();
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();

    await user.click(casilla('Silla Tolix'));
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();

    await user.click(casilla('Aparador'));
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    expect(casilla('Silla Tolix')).toBeChecked();

    await user.click(casilla('Silla Tolix'));
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
  });

  it('"Seleccionar todos" marca solo la página visible, y un segundo clic la desmarca', async () => {
    const { user } = await abrirInventario(muchas(25));

    await user.click(casillaDePagina());
    expect(screen.getByText('20 seleccionados')).toBeInTheDocument();
    expect(casillaDePagina()).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Siguiente →' }));
    expect(casillaDePagina()).not.toBeChecked();
    expect(casilla('Pieza 21')).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: '← Anterior' }));
    await user.click(casillaDePagina());
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
  });

  it('la selección se conserva al cambiar de página y se suma a la de otras páginas', async () => {
    const { user } = await abrirInventario(muchas(25));
    await user.click(casilla('Pieza 01'));

    await user.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await user.click(casillaDePagina());
    expect(screen.getByText('6 seleccionados')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← Anterior' }));
    expect(casilla('Pieza 01')).toBeChecked();
  });

  it('"Cancelar" en la barra de acciones vacía la selección', async () => {
    const { user } = await abrirInventario();
    await user.click(casilla('Silla Tolix'));
    await user.click(casilla('Aparador'));

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
    expect(casilla('Silla Tolix')).not.toBeChecked();
  });
});

describe('Inventario — acciones en lote', () => {
  it('"Aplicar estado" cambia el estado de cada seleccionada, avisa, vacía la selección y recarga', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();
    await user.click(casilla('Silla Tolix'));
    await user.click(casilla('Banco de iglesia'));

    await user.selectOptions(screen.getByDisplayValue('Marcar disponible'), 'vendido');
    await user.click(screen.getByRole('button', { name: 'Aplicar estado' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado actualizado en 2 productos', 'success'));
    expect(updateMueble).toHaveBeenCalledTimes(2);
    expect(updateMueble).toHaveBeenCalledWith('m1', { estado: 'vendido' });
    expect(updateMueble).toHaveBeenCalledWith('m5', { estado: 'vendido' });
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(getMuebles).toHaveBeenLastCalledWith({ fresco: true });
  });

  it('"Aplicar estado" con una sola pieza avisa en singular', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();
    await user.click(casilla('Aparador'));

    await user.click(screen.getByRole('button', { name: 'Aplicar estado' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado actualizado en 1 producto', 'success'));
    expect(updateMueble).toHaveBeenCalledWith('m4', { estado: 'disponible' });
  });

  it('"Aplicar estado" avisa de éxito aunque falle', async () => {
    // CARACTERIZACIÓN: comportamiento actual incorrecto (H12): enseña éxito aunque updateMueble devuelva null.
    updateMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirInventario();
    await user.click(casilla('Silla Tolix'));

    await user.click(screen.getByRole('button', { name: 'Aplicar estado' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado actualizado en 1 producto', 'success'));
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('"Eliminar seleccionados" pide confirmación y, al confirmar, borra cada una, avisa, vacía la selección y recarga', async () => {
    deleteMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();
    await user.click(casilla('Silla Tolix'));
    await user.click(casilla('Aparador'));

    await user.click(screen.getByRole('button', { name: 'Eliminar seleccionados' }));
    const confirmacion = dialogo('Eliminar productos seleccionados');
    expect(confirmacion.getByText('¿Seguro que quieres eliminar 2 productos de forma permanente?')).toBeInTheDocument();
    expect(deleteMueble).not.toHaveBeenCalled();

    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('2 productos eliminados', 'success'));
    expect(deleteMueble).toHaveBeenCalledTimes(2);
    expect(deleteMueble).toHaveBeenCalledWith('m1');
    expect(deleteMueble).toHaveBeenCalledWith('m4');
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
    expect(getMuebles).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 3, name: 'Eliminar productos seleccionados' })).not.toBeInTheDocument()
    );
  });

  it('con una sola pieza, la confirmación y el aviso van en singular', async () => {
    deleteMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();
    await user.click(casilla('Aparador'));

    await user.click(screen.getByRole('button', { name: 'Eliminar seleccionados' }));
    const confirmacion = dialogo('Eliminar productos seleccionados');
    expect(confirmacion.getByText('¿Seguro que quieres eliminar 1 producto de forma permanente?')).toBeInTheDocument();
    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('1 producto eliminado', 'success'));
  });

  it('"Eliminar seleccionados" avisa de éxito aunque falle', async () => {
    // CARACTERIZACIÓN: comportamiento actual incorrecto (H12): enseña éxito aunque deleteMueble devuelva null.
    deleteMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirInventario();
    await user.click(casilla('Silla Tolix'));

    await user.click(screen.getByRole('button', { name: 'Eliminar seleccionados' }));
    await user.click(dialogo('Eliminar productos seleccionados').getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('1 producto eliminado', 'success'));
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('cancelar la confirmación no borra nada y mantiene la selección', async () => {
    const { user } = await abrirInventario();
    await user.click(casilla('Silla Tolix'));

    await user.click(screen.getByRole('button', { name: 'Eliminar seleccionados' }));
    await user.click(dialogo('Eliminar productos seleccionados').getByRole('button', { name: 'Cancelar' }));

    expect(deleteMueble).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { level: 3, name: 'Eliminar productos seleccionados' })).not.toBeInTheDocument();
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
  });
});

describe('Inventario — acciones por fila', () => {
  it('cambiar el estado en la fila lo guarda al momento, avisa y recarga', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();

    await user.selectOptions(fila('Silla Tolix').getByRole('combobox'), 'alquilado');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado actualizado', 'success'));
    expect(updateMueble).toHaveBeenCalledWith('m1', { estado: 'alquilado' });
    expect(getMuebles).toHaveBeenCalledTimes(2);
  });

  it('si falla el cambio de estado en la fila, avisa del error y no recarga', async () => {
    updateMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirInventario();

    await user.selectOptions(fila('Silla Tolix').getByRole('combobox'), 'vendido');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Error al cambiar estado', 'error'));
    expect(getMuebles).toHaveBeenCalledTimes(1);
  });

  it('"Eliminar" en la fila pide confirmación y, al confirmar, borra, avisa, recarga y cierra el diálogo', async () => {
    deleteMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Mesa de roble').getByRole('button', { name: 'Eliminar' }));
    const confirmacion = dialogo('Eliminar Mueble');
    expect(
      confirmacion.getByText('¿Estás seguro de que quieres eliminar de forma permanente este mueble del catálogo?')
    ).toBeInTheDocument();
    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mueble eliminado con éxito', 'success'));
    expect(deleteMueble).toHaveBeenCalledWith('m2');
    expect(getMuebles).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Eliminar Mueble' })).not.toBeInTheDocument());
  });

  it('"Eliminar" en la fila avisa de éxito aunque falle', async () => {
    // CARACTERIZACIÓN: comportamiento actual incorrecto (H12): enseña éxito aunque deleteMueble devuelva null.
    deleteMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Mesa de roble').getByRole('button', { name: 'Eliminar' }));
    await user.click(dialogo('Eliminar Mueble').getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mueble eliminado con éxito', 'success'));
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('cancelar la confirmación de la fila no borra nada', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Mesa de roble').getByRole('button', { name: 'Eliminar' }));
    await user.click(dialogo('Eliminar Mueble').getByRole('button', { name: 'Cancelar' }));

    expect(deleteMueble).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { level: 3, name: 'Eliminar Mueble' })).not.toBeInTheDocument();
  });

  it('"Editar" en la fila abre el modal de edición con los datos de esa pieza', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Mesa de roble').getByRole('button', { name: 'Editar' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Editar Producto' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mesa de roble')).toBeInTheDocument();
  });
});
