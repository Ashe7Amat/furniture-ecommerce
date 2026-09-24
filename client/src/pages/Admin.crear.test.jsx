// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen lo que hace
// hoy la pestaña "Añadir Mueble", aunque algo no guste. Desde el primer commit del refactor no se
// tocan; si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMueble, getMuebles, getCategorias } from '../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

// Los dos <select> no tienen <label>: se localizan por su atributo name, que además es parte del
// comportamiento (handleInputChange guarda cada campo en formData según e.target.name). El selector
// de fotos, por su id, que handleSubmit usa para vaciarlo tras guardar.
const campo = (name) => document.querySelector(`[name="${name}"]`);
const selectorFotos = () => document.getElementById('mueble-file-input');
const botonGuardar = () => screen.getByRole('button', { name: 'Guardar Producto' });

const foto = (nombre) => new File(['x'], nombre, { type: 'image/jpeg' });

const EXITO = { success: true, message: 'Mueble creado con éxito', data: { id: 'nuevo' } };

const abrirCrear = async (opciones = {}) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ categorias: CATEGORIAS, ...opciones });
  await irAPestana(user, 'Añadir Mueble');
  return { user, ...utils };
};

const rellenar = async (user, {
  nombre = 'Silla Tolix',
  categoria = 'Sillas',
  descripcion = 'Silla de metal de los años 50',
  precioVenta = '350',
  precioAlquiler = '',
  estado = 'disponible',
  fotos = [foto('silla-1.jpg')]
} = {}) => {
  await user.type(screen.getByPlaceholderText('Nombre del mueble'), nombre);
  await user.selectOptions(campo('categoria'), categoria);
  await user.type(screen.getByPlaceholderText('Descripción detallada'), descripcion);
  if (precioVenta) await user.type(screen.getByPlaceholderText('Precio Venta (€)'), precioVenta);
  if (precioAlquiler) await user.type(screen.getByPlaceholderText('Precio Alquiler (€/día)'), precioAlquiler);
  await user.selectOptions(campo('estado'), estado);
  if (fotos.length) await user.upload(selectorFotos(), fotos);
};

// Envía el formulario disparando su evento submit, no con un clic en "Guardar Producto": jsdom no
// cuenta los archivos que pone userEvent.upload al validar el `required` del selector de fotos (el
// input tiene el archivo, pero jsdom lo sigue viendo vacío), así que un clic no llegaría a enviar
// nada. En un navegador real sí se envía. Que el selector es obligatorio lo comprueba su propio test.
const guardar = () => act(async () => {
  fireEvent.submit(botonGuardar().closest('form'));
});

// Lo que se mandó a createMueble en su primera llamada.
const formDataEnviado = () => createMueble.mock.calls[0][0];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Añadir mueble — formulario', () => {
  it('enseña el formulario vacío, con el estado "Disponible" por defecto', async () => {
    await abrirCrear();

    expect(screen.getByRole('heading', { level: 2, name: 'Añadir Nuevo Producto' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del mueble')).toHaveValue('');
    expect(screen.getByPlaceholderText('Descripción detallada')).toHaveValue('');
    expect(screen.getByPlaceholderText('Precio Venta (€)')).toHaveValue(null);
    expect(screen.getByPlaceholderText('Precio Alquiler (€/día)')).toHaveValue(null);
    expect(campo('estado')).toHaveValue('disponible');
    expect(botonGuardar()).toBeEnabled();
  });

  it('son obligatorios el nombre, la categoría, la descripción y las fotos; los precios y el estado, no', async () => {
    // Lo que impide enviar sin ellos es la validación del navegador (el atributo required), no
    // handleSubmit: por eso se comprueba el atributo.
    await abrirCrear();

    expect(screen.getByPlaceholderText('Nombre del mueble')).toBeRequired();
    expect(campo('categoria')).toBeRequired();
    expect(screen.getByPlaceholderText('Descripción detallada')).toBeRequired();
    expect(selectorFotos()).toBeRequired();
    expect(screen.getByPlaceholderText('Precio Venta (€)')).not.toBeRequired();
    expect(screen.getByPlaceholderText('Precio Alquiler (€/día)')).not.toBeRequired();
    expect(campo('estado')).not.toBeRequired();
  });

  it('el selector de categoría agrupa las específicas bajo su general, y las generales no se pueden elegir', async () => {
    await abrirCrear();

    const grupos = [...campo('categoria').querySelectorAll('optgroup')].map(g => ({
      general: g.label,
      especificas: [...g.querySelectorAll('option')].map(o => o.value)
    }));
    expect(grupos).toEqual([
      { general: 'Decoración y hogar', especificas: ['Lámparas'] },
      { general: 'Mobiliario', especificas: ['Mesas', 'Sillas'] }
    ]);
    // Fuera de los grupos solo está la opción vacía del principio.
    const sueltas = [...campo('categoria').children].filter(el => el.tagName === 'OPTION');
    expect(sueltas.map(o => [o.value, o.textContent])).toEqual([['', 'Selecciona una categoría']]);
  });
});

describe('Añadir mueble — categoría preseleccionada (casos A y C del diseño, sección 5)', () => {
  it('caso A: al entrar, preselecciona la primera categoría específica', async () => {
    await abrirCrear();

    expect(campo('categoria')).toHaveValue('Lámparas');
  });

  it('caso A: la preseleccionada es la primera específica en el orden de la API, aunque no sea la primera del desplegable', async () => {
    // Orden alfabético, como lo devuelve el servidor: "Aparadores" (de Mobiliario) va primero en la
    // lista, pero en el desplegable sale en el segundo grupo, detrás de "Juguetes". Pasa con los
    // datos reales (24 sep): se preselecciona "Baúles y maletas", del tercer grupo.
    await abrirCrear({
      categorias: [
        { id: 11, nombre: 'Aparadores', categoria_padre_id: 1 },
        { id: 3, nombre: 'Coleccionismo', categoria_padre_id: null },
        { id: 31, nombre: 'Juguetes', categoria_padre_id: 3 },
        { id: 1, nombre: 'Mobiliario', categoria_padre_id: null }
      ]
    });

    expect(campo('categoria').querySelector('optgroup option')).toHaveValue('Juguetes');
    expect(campo('categoria')).toHaveValue('Aparadores');
  });

  it('caso A: si solo hay categorías generales, no preselecciona nada', async () => {
    await abrirCrear({
      categorias: [
        { id: 2, nombre: 'Decoración y hogar', categoria_padre_id: null },
        { id: 1, nombre: 'Mobiliario', categoria_padre_id: null }
      ]
    });

    expect(campo('categoria')).toHaveValue('');
  });

  it('caso C: tras crear un mueble, el formulario se vacía y la categoría NO se vuelve a preseleccionar', async () => {
    createMueble.mockResolvedValue(EXITO);
    const { user } = await abrirCrear();
    await rellenar(user, { estado: 'vendido' });
    await guardar();

    await irAPestana(user, 'Añadir Mueble');

    expect(screen.getByPlaceholderText('Nombre del mueble')).toHaveValue('');
    expect(screen.getByPlaceholderText('Descripción detallada')).toHaveValue('');
    expect(screen.getByPlaceholderText('Precio Venta (€)')).toHaveValue(null);
    expect(campo('estado')).toHaveValue('disponible');
    // Se queda en "Selecciona una categoría" hasta la próxima recarga de categorías, que crear un
    // mueble no provoca.
    expect(campo('categoria')).toHaveValue('');
    expect(getCategorias).toHaveBeenCalledTimes(1);
  });
});

describe('Añadir mueble — envío', () => {
  it('manda a createMueble un FormData con los campos, el id de la categoría y todas las fotos', async () => {
    createMueble.mockResolvedValue(EXITO);
    const { user } = await abrirCrear();
    await rellenar(user, { estado: 'vendido', fotos: [foto('silla-1.jpg'), foto('silla-2.jpg')] });

    await guardar();

    expect(createMueble).toHaveBeenCalledTimes(1);
    const enviado = formDataEnviado();
    expect(enviado).toBeInstanceOf(FormData);
    expect(enviado.get('nombre')).toBe('Silla Tolix');
    expect(enviado.get('categoria')).toBe('Sillas');
    // Doble escritura de la tarea 3a: además del nombre, el id real de la categoría.
    expect(enviado.get('categoria_id')).toBe('11');
    expect(enviado.get('descripcion')).toBe('Silla de metal de los años 50');
    expect(enviado.get('precio_venta')).toBe('350');
    expect(enviado.has('precio_alquiler')).toBe(false);
    expect(enviado.get('estado')).toBe('vendido');
    expect(enviado.getAll('imagenes').map(f => f.name)).toEqual(['silla-1.jpg', 'silla-2.jpg']);
  });

  it('sin precio de venta y con precio de alquiler, manda solo el de alquiler', async () => {
    createMueble.mockResolvedValue(EXITO);
    const { user } = await abrirCrear();
    await rellenar(user, { precioVenta: '', precioAlquiler: '25' });

    await guardar();

    const enviado = formDataEnviado();
    expect(enviado.has('precio_venta')).toBe(false);
    expect(enviado.get('precio_alquiler')).toBe('25');
  });

  it('si va bien, avisa, recarga los muebles y lleva a Gestionar Inventario', async () => {
    createMueble.mockResolvedValue(EXITO);
    const { user, showToast } = await abrirCrear();
    await rellenar(user);

    await guardar();

    expect(showToast).toHaveBeenCalledWith('Producto añadido con éxito al catálogo', 'success');
    expect(getMuebles).toHaveBeenCalledTimes(2);
    // Sin caché: si no, la lista recargada podría ser la de antes de guardar.
    expect(getMuebles).toHaveBeenLastCalledWith({ fresco: true });
    expect(screen.getByRole('heading', { level: 2, name: 'Gestionar Inventario' })).toBeInTheDocument();
  });

  it('mientras guarda, enseña "Guardando producto..." y desactiva el botón', async () => {
    let terminar;
    createMueble.mockReturnValue(new Promise(resolve => { terminar = resolve; }));
    const { user } = await abrirCrear();
    await rellenar(user);

    await guardar();

    expect(screen.getByText('Guardando producto...')).toBeInTheDocument();
    expect(botonGuardar()).toBeDisabled();

    await act(async () => terminar(EXITO));
    expect(screen.getByRole('heading', { level: 2, name: 'Gestionar Inventario' })).toBeInTheDocument();
  });

  it('si falla (createMueble devuelve null), avisa, enseña el error y conserva lo escrito', async () => {
    createMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirCrear();
    await rellenar(user);

    await guardar();

    expect(showToast).toHaveBeenCalledWith('Error al guardar producto', 'error');
    expect(screen.getByText('Error al guardar en base de datos.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Añadir Nuevo Producto' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del mueble')).toHaveValue('Silla Tolix');
    expect(campo('categoria')).toHaveValue('Sillas');
    expect(botonGuardar()).toBeEnabled();
    expect(getMuebles).toHaveBeenCalledTimes(1);
  });
});

describe('Entorno de test — limitación de jsdom', () => {
  // CARACTERIZACIÓN DEL ENTORNO, no del panel: jsdom no cuenta los archivos que pone
  // userEvent.upload al validar el `required` del selector de fotos. Por eso los demás tests envían
  // con fireEvent.submit (ver guardar()) y la obligatoriedad se comprueba por el atributo required,
  // no por un envío bloqueado. Si una versión nueva de jsdom lo corrige, este test fallará: entonces
  // se actualiza (es del entorno, no del refactor) y los envíos pueden volver a hacerse con un clic.
  it('un clic en "Guardar Producto" NO envía el formulario aunque haya fotos', async () => {
    createMueble.mockResolvedValue(EXITO);
    const { user } = await abrirCrear();
    await rellenar(user);

    // El selector tiene la foto, pero jsdom lo sigue dando por vacío.
    expect(selectorFotos().files).toHaveLength(1);
    expect(selectorFotos().validity.valueMissing).toBe(true);

    await user.click(botonGuardar());

    expect(createMueble).not.toHaveBeenCalled();
  });
});
