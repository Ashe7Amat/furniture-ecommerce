// Arreglo de H24 (29 sep 2026): el panel reduce las fotos en el navegador antes de subirlas
// (utils/imagen.js). Vercel rechaza las peticiones de más de 4,5 MB, y todas las fotos de un mueble
// van en la misma. NO son tests de caracterización: describen el comportamiento nuevo.
//
// jsdom no sabe decodificar imágenes ni dibujar en un canvas, así que aquí se simula un navegador
// que sí: createImageBitmap devuelve una foto de 4032 × 3024 (la de un móvil) y canvas.toBlob, un
// JPEG de 400 KB. Sin esa simulación (el resto de tests del panel), las fotos se suben tal cual.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMueble, updateMueble, createCategoria, updateCategoria } from '../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

const MB = 1024 * 1024;
const LIMITE_VERCEL = 4.5 * MB;
const fotoDeMovil = (nombre, peso = 6 * MB) => new File([new Uint8Array(peso)], nombre, { type: 'image/jpeg' });

const PIEZA = {
  id: 'p1',
  nombre: 'Pieza 01',
  categoria: 'Sillas',
  categoria_id: 11,
  descripcion: 'Una pieza',
  estado: 'disponible',
  precio_venta: 100,
  precio_alquiler_dia: null,
  imagenes: []
};

// Navegador simulado. Si `manual` es true, cada createImageBitmap se queda esperando hasta que el
// test llama a `siguiente()`: así se ve el mensaje de progreso de cada foto.
const simularNavegador = ({ manual = false } = {}) => {
  const esperando = [];
  const bitmap = () => ({ width: 4032, height: 3024, close: () => {} });
  vi.stubGlobal('createImageBitmap', vi.fn(() => {
    if (!manual) return Promise.resolve(bitmap());
    return new Promise((resolve) => esperando.push(() => resolve(bitmap())));
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, drawImage() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((alTerminar, tipo) =>
    alTerminar(new Blob([new Uint8Array(400 * 1024)], { type: tipo }))
  );
  return { siguiente: () => act(async () => esperando.shift()()) };
};

const enviar = (elemento) =>
  act(async () => {
    fireEvent.submit(elemento.closest('form'));
  });
const modal = () => within(document.querySelector('.admin-modal-content'));
const selectorDelModal = () => document.querySelector('.admin-modal-content input[type="file"]');
const pesoTotal = (archivos) => archivos.reduce((total, a) => total + a.size, 0);

const abrirCrear = async () => {
  const user = userEvent.setup();
  await renderAdmin({ categorias: CATEGORIAS });
  await irAPestana(user, 'Añadir Mueble');
  await user.type(screen.getByPlaceholderText('Nombre del mueble'), 'Aparador');
  await user.type(screen.getByPlaceholderText('Descripción detallada'), 'De roble');
  return user;
};

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('H24 — las fotos se reducen antes de subirlas', () => {
  it('"Añadir mueble": tres fotos de móvil (18 MB) llegan a createMueble reducidas, por debajo del límite de Vercel', async () => {
    simularNavegador();
    createMueble.mockResolvedValue({ success: true });
    const user = await abrirCrear();
    const fotos = [fotoDeMovil('a.jpg'), fotoDeMovil('b.jpg'), fotoDeMovil('c.jpg')];
    expect(pesoTotal(fotos)).toBeGreaterThan(LIMITE_VERCEL); // sin reducir, Vercel la rechazaría
    await user.upload(document.getElementById('mueble-file-input'), fotos);

    await enviar(screen.getByRole('button', { name: 'Guardar Producto' }));

    const subidas = createMueble.mock.calls[0][0].getAll('imagenes');
    expect(subidas.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(subidas.every((f) => f.type === 'image/jpeg' && f.size === 400 * 1024)).toBe(true);
    expect(pesoTotal(subidas)).toBeLessThan(LIMITE_VERCEL);
  });

  it('"Añadir mueble": mientras reduce, dice por qué foto va, y después vuelve a "Guardando producto..."', async () => {
    const navegador = simularNavegador({ manual: true });
    let terminar;
    createMueble.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    const user = await abrirCrear();
    await user.upload(document.getElementById('mueble-file-input'), [fotoDeMovil('a.jpg'), fotoDeMovil('b.jpg'), fotoDeMovil('c.jpg')]);
    const boton = screen.getByRole('button', { name: 'Guardar Producto' });

    await enviar(boton);
    expect(screen.getByText('Optimizando imágenes... 1/3')).toBeInTheDocument();
    expect(boton).toBeDisabled(); // un segundo envío no sale mientras reduce
    await navegador.siguiente();
    expect(screen.getByText('Optimizando imágenes... 2/3')).toBeInTheDocument();
    await navegador.siguiente();
    expect(screen.getByText('Optimizando imágenes... 3/3')).toBeInTheDocument();
    expect(createMueble).not.toHaveBeenCalled(); // no se sube nada hasta tener todas
    await navegador.siguiente();

    expect(screen.getByText('Guardando producto...')).toBeInTheDocument();
    expect(createMueble).toHaveBeenCalledTimes(1);
    await act(async () => terminar({ success: true }));
  });

  it('"Añadir mueble": un segundo envío mientras reduce no crea otro mueble', async () => {
    const navegador = simularNavegador({ manual: true });
    createMueble.mockResolvedValue({ success: true });
    const user = await abrirCrear();
    await user.upload(document.getElementById('mueble-file-input'), [fotoDeMovil('a.jpg')]);
    const boton = screen.getByRole('button', { name: 'Guardar Producto' });

    await enviar(boton);
    expect(screen.getByText('Optimizando imagen...')).toBeInTheDocument();
    await enviar(boton);
    await navegador.siguiente();

    expect(createMueble).toHaveBeenCalledTimes(1);
  });

  it('"Añadir mueble": si ni reduciéndolas caben (aquí el navegador no puede reducirlas), no se manda nada y se explica por qué', async () => {
    // Sin simularNavegador(): como en un navegador sin createImageBitmap ni img.decode, se quedan los
    // originales, 6 MB entre las dos.
    const showToast = vi.fn();
    const user = userEvent.setup();
    await renderAdmin({ categorias: CATEGORIAS, showToast });
    await irAPestana(user, 'Añadir Mueble');
    await user.upload(document.getElementById('mueble-file-input'), [fotoDeMovil('a.jpg', 3 * MB), fotoDeMovil('b.jpg', 3 * MB)]);
    const boton = screen.getByRole('button', { name: 'Guardar Producto' });

    await enviar(boton);

    expect(createMueble).not.toHaveBeenCalled();
    expect(screen.getByText(/Las fotos pesan demasiado para subirlas juntas \(6 MB de un máximo de 4 MB\)/)).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Las fotos pesan demasiado', 'error');
    expect(boton).toBeEnabled(); // se puede quitar alguna y volver a intentarlo
  });

  it('modal de edición de mueble: las fotos nuevas se reducen; las que ya tenía no se tocan', async () => {
    simularNavegador();
    updateMueble.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    await renderAdmin({ muebles: [{ ...PIEZA, imagenes: ['https://img.test/p1.jpg'] }], categorias: CATEGORIAS });
    await irAPestana(user, 'Gestionar Inventario');
    const fila = screen.getByRole('checkbox', { name: 'Seleccionar Pieza 01' }).closest('.inventory-list-item');
    await user.click(within(fila).getByRole('button', { name: 'Editar' }));
    await user.upload(selectorDelModal(), [fotoDeMovil('nueva-1.jpg'), fotoDeMovil('nueva-2.jpg')]);

    await enviar(modal().getByRole('button', { name: 'Guardar Cambios' }));

    const datos = updateMueble.mock.calls[0][1];
    expect(JSON.parse(datos.get('imagenes_existentes'))).toEqual(['https://img.test/p1.jpg']);
    const subidas = datos.getAll('imagenes');
    expect(subidas.map((f) => f.name)).toEqual(['nueva-1.jpg', 'nueva-2.jpg']);
    expect(pesoTotal(subidas)).toBeLessThan(LIMITE_VERCEL);
  });

  it('categoría nueva: una sola foto de móvil de 6 MB (ya por encima del límite) se sube reducida', async () => {
    simularNavegador();
    createCategoria.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    await renderAdmin({ categorias: CATEGORIAS });
    await irAPestana(user, 'Gestionar Categorías');
    await user.type(screen.getByPlaceholderText('Nueva categoría (Ej: Sofás)'), 'Exterior');
    await user.upload(document.getElementById('categoria-file-input'), fotoDeMovil('exterior.jpg'));

    await enviar(screen.getByRole('button', { name: 'Crear Categoría' }));

    const imagen = createCategoria.mock.calls[0][0].get('imagen');
    expect(imagen.name).toBe('exterior.jpg');
    expect(imagen.size).toBeLessThan(LIMITE_VERCEL);
  });

  it('modal de edición de categoría: la foto nueva se sube reducida', async () => {
    simularNavegador();
    updateCategoria.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    await renderAdmin({ categorias: CATEGORIAS });
    await irAPestana(user, 'Gestionar Categorías');
    const tarjeta = screen.getByRole('heading', { level: 3, name: 'Mesas' }).closest('.cat-card');
    await user.click(within(tarjeta).getByRole('button', { name: 'Editar' }));
    await user.upload(selectorDelModal(), fotoDeMovil('mesas.jpg'));

    await enviar(modal().getByRole('button', { name: 'Guardar Cambios' }));

    const imagen = updateCategoria.mock.calls[0][1].get('imagen');
    expect(imagen.name).toBe('mesas.jpg');
    expect(imagen.size).toBeLessThan(LIMITE_VERCEL);
  });
});
