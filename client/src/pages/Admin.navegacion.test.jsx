// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen qué se
// conserva hoy al cambiar de pestaña y volver, aunque algo no guste (H13, H14). Desde el primer
// commit del refactor no se tocan; si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCategorias, createMueble, createCategoria, updateMueble } from '../services/api';
import { renderAdmin, irAPestana, barraLateral, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

const mueble = (i) => ({
  id: `p${i}`,
  nombre: `Pieza ${String(i).padStart(2, '0')}`,
  categoria: 'Sillas',
  categoria_id: 11,
  descripcion: 'Una pieza',
  estado: 'disponible',
  precio_venta: 100 + i,
  precio_alquiler_dia: null,
  imagenes: []
});
const CATALOGO = Array.from({ length: 45 }, (_, i) => mueble(i + 1));
const PEDIDOS = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', estado: 'procesando', total: 100, cliente_info: {}, items: [] },
  { id: 'ffee0011-0000-4000-8000-000000000002', estado: 'enviado', total: 200, cliente_info: {}, items: [] }
];

const abrirPanel = async () => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles: CATALOGO, categorias: CATEGORIAS, pedidos: PEDIDOS });
  return { user, ...utils };
};

// Campos sin <label> asociada: por su atributo name, su placeholder o el orden de los <select> de
// la barra de herramientas (HTML congelado por el diseño de la tarea 4, sección 8).
const campo = (name) => document.querySelector(`[name="${name}"]`);
const filtrosInventario = () => {
  const [categoria, estado, orden] = document.querySelectorAll('.admin-toolbar select');
  return { categoria, estado, orden };
};
const titulo = () => screen.getByRole('heading', { level: 2 }).textContent;
const enviarFormulario = (elemento) =>
  act(async () => {
    fireEvent.submit(elemento.closest('form'));
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Navegación — barra lateral', () => {
  it('cada botón abre su pestaña y queda marcado como activo (solo él)', async () => {
    const { user } = await abrirPanel();
    const pestanas = [
      ['Añadir Mueble', 'Añadir Nuevo Producto'],
      ['Gestionar Inventario', 'Gestionar Inventario'],
      [/^Pedidos/, 'Pedidos'],
      ['Gestionar Categorías', 'Gestionar Categorías'],
      ['Resumen', 'Dashboard']
    ];

    for (const [boton, encabezado] of pestanas) {
      await irAPestana(user, boton);
      expect(titulo()).toBe(encabezado);
      const activos = barraLateral()
        .getAllByRole('button')
        .filter((b) => b.classList.contains('active'));
      expect(activos).toHaveLength(1);
      expect(activos[0]).toBe(barraLateral().getByRole('button', { name: boton }));
    }
  });
});

describe('Navegación — lo que se conserva al cambiar de pestaña y volver', () => {
  it('inventario: búsqueda, filtros, orden y página', async () => {
    const { user } = await abrirPanel();
    await irAPestana(user, 'Gestionar Inventario');
    await user.type(screen.getByPlaceholderText('Buscar por nombre...'), 'pieza');
    await user.selectOptions(filtrosInventario().estado, 'disponible');
    await user.selectOptions(filtrosInventario().orden, 'precio_desc');
    await user.click(screen.getByRole('button', { name: 'Siguiente →' }));
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();

    await irAPestana(user, /^Pedidos/);
    await irAPestana(user, 'Gestionar Inventario');

    expect(screen.getByPlaceholderText('Buscar por nombre...')).toHaveValue('pieza');
    expect(filtrosInventario().estado).toHaveValue('disponible');
    expect(filtrosInventario().orden).toHaveValue('precio_desc');
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('inventario: las piezas seleccionadas', async () => {
    const { user } = await abrirPanel();
    await irAPestana(user, 'Gestionar Inventario');
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Pieza 01' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Pieza 02' }));

    await irAPestana(user, 'Resumen');
    await irAPestana(user, 'Gestionar Inventario');

    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Pieza 01' })).toBeChecked();
  });

  it('"Añadir mueble" a medio rellenar', async () => {
    // CARACTERIZACIÓN: comportamiento actual discutible (H13): el formulario no se vacía al salir.
    const { user } = await abrirPanel();
    await irAPestana(user, 'Añadir Mueble');
    await user.type(screen.getByPlaceholderText('Nombre del mueble'), 'Silla nueva');
    await user.selectOptions(campo('categoria'), 'Mesas');
    await user.type(screen.getByPlaceholderText('Descripción detallada'), 'A medias');
    await user.type(screen.getByPlaceholderText('Precio Venta (€)'), '99');
    await user.selectOptions(campo('estado'), 'vendido');

    await irAPestana(user, 'Gestionar Categorías');
    await irAPestana(user, 'Añadir Mueble');

    expect(screen.getByPlaceholderText('Nombre del mueble')).toHaveValue('Silla nueva');
    expect(campo('categoria')).toHaveValue('Mesas');
    expect(screen.getByPlaceholderText('Descripción detallada')).toHaveValue('A medias');
    expect(screen.getByPlaceholderText('Precio Venta (€)')).toHaveValue(99);
    expect(campo('estado')).toHaveValue('vendido');
  });

  it('las fotos elegidas siguen guardadas aunque el selector se vea vacío, y se envían', async () => {
    // CARACTERIZACIÓN: rareza de H13: los archivos siguen en el estado, pero el <input type="file">
    // se ve vacío al volver (el DOM se rehízo). En un navegador, como es obligatorio, obliga a
    // elegirlos otra vez; si se envía igualmente, van las fotos de antes.
    createMueble.mockResolvedValue({ success: true });
    const { user } = await abrirPanel();
    await irAPestana(user, 'Añadir Mueble');
    await user.type(screen.getByPlaceholderText('Nombre del mueble'), 'Silla nueva');
    await user.type(screen.getByPlaceholderText('Descripción detallada'), 'Con foto');
    await user.upload(document.getElementById('mueble-file-input'), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));

    await irAPestana(user, 'Resumen');
    await irAPestana(user, 'Añadir Mueble');

    expect(document.getElementById('mueble-file-input').files).toHaveLength(0);
    await enviarFormulario(screen.getByPlaceholderText('Nombre del mueble'));
    expect(createMueble.mock.calls[0][0].getAll('imagenes').map((f) => f.name)).toEqual(['foto.jpg']);
  });

  it('"Nueva categoría" a medio rellenar', async () => {
    // CARACTERIZACIÓN: comportamiento actual discutible (H13), igual que "Añadir mueble".
    const { user } = await abrirPanel();
    await irAPestana(user, 'Gestionar Categorías');
    await user.type(screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)'), 'Exterior');
    await user.selectOptions(screen.getByDisplayValue('— Es una categoría general —'), '1');

    await irAPestana(user, 'Añadir Mueble');
    await irAPestana(user, 'Gestionar Categorías');

    expect(screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)')).toHaveValue('Exterior');
    expect(document.querySelector('.cat-add-form select')).toHaveValue('1');
  });

  it('el filtro de pedidos', async () => {
    const { user } = await abrirPanel();
    await irAPestana(user, /^Pedidos/);
    await user.selectOptions(document.querySelector('.admin-toolbar select'), 'enviado');

    await irAPestana(user, 'Resumen');
    await irAPestana(user, /^Pedidos/);

    expect(document.querySelector('.admin-toolbar select')).toHaveValue('enviado');
    expect(screen.getByText('1 de 2 pedidos')).toBeInTheDocument();
  });
});

describe('Navegación — categoría preseleccionada de "Añadir mueble" (casos B y C del diseño, sección 5)', () => {
  const crearCategoriaDesdeSuPestana = async (user, nombre) => {
    getCategorias.mockResolvedValue([
      ...CATEGORIAS,
      { id: 14, nombre, categoria_padre_id: 1, imagen_url: null, stats: CATEGORIAS[0].stats }
    ]);
    createCategoria.mockResolvedValue({ success: true, data: { id: 14 } });
    await irAPestana(user, 'Gestionar Categorías');
    await user.type(screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)'), nombre);
    await enviarFormulario(screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)'));
    await waitFor(() => expect(getCategorias).toHaveBeenCalledTimes(2));
  };

  it('caso B: la categoría que eligió el usuario no se pisa al recargar las categorías desde otra pestaña', async () => {
    const { user } = await abrirPanel();
    await irAPestana(user, 'Añadir Mueble');
    expect(campo('categoria')).toHaveValue('Lámparas'); // la preseleccionada (caso A)
    await user.selectOptions(campo('categoria'), 'Mesas');

    await crearCategoriaDesdeSuPestana(user, 'Taburetes');
    await irAPestana(user, 'Añadir Mueble');

    expect(campo('categoria')).toHaveValue('Mesas');
  });

  it('caso C: tras crear un mueble la categoría queda vacía, y la siguiente recarga de categorías la vuelve a preseleccionar', async () => {
    createMueble.mockResolvedValue({ success: true });
    const { user } = await abrirPanel();
    await irAPestana(user, 'Añadir Mueble');
    await user.type(screen.getByPlaceholderText('Nombre del mueble'), 'Silla nueva');
    await enviarFormulario(screen.getByPlaceholderText('Nombre del mueble'));
    await irAPestana(user, 'Añadir Mueble');
    expect(campo('categoria')).toHaveValue('');

    await crearCategoriaDesdeSuPestana(user, 'Taburetes');
    await irAPestana(user, 'Añadir Mueble');

    expect(campo('categoria')).toHaveValue('Lámparas');
  });
});

describe('Navegación — un solo mensaje de estado para todos los formularios (H14)', () => {
  it('el error de guardar en el modal de edición aparece después debajo de "Añadir mueble"', async () => {
    // CARACTERIZACIÓN: comportamiento actual discutible (H14): `status` es uno para todo el panel,
    // no se limpia en los fallos y solo se pinta en "Añadir mueble".
    updateMueble.mockResolvedValue(null);
    const { user } = await abrirPanel();
    await irAPestana(user, 'Gestionar Inventario');
    const fila = screen.getByRole('checkbox', { name: 'Seleccionar Pieza 01' }).closest('.inventory-list-item');
    await user.click(within(fila).getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    await irAPestana(user, 'Añadir Mueble');

    expect(screen.getByText('Error al actualizar.')).toBeInTheDocument();
  });
});
