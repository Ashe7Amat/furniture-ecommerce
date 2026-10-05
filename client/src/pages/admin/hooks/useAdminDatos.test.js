import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getMuebles, getCategorias, getPedidos, getMensajes } from '../../../services/api';
import { respuestaPedidos } from '../../adminTestUtils';
import useAdminDatos from './useAdminDatos';

vi.mock('../../../services/api');

beforeEach(() => {
  vi.resetAllMocks();
  getMuebles.mockResolvedValue([{ id: 'm1' }]);
  getCategorias.mockResolvedValue([{ id: 1 }]);
  // CAMBIADO A PROPÓSITO (5 oct 2026, H37): getPedidos devuelve una página con su total, no la lista.
  getPedidos.mockImplementation(async (opciones) => respuestaPedidos([{ id: 'p1', estado: 'procesando' }], opciones));
  getMensajes.mockResolvedValue([{ id: 'c1', leido: false }]);
});

const montar = async (user) => {
  let hook;
  await act(async () => {
    hook = renderHook(({ usuario }) => useAdminDatos(usuario), { initialProps: { usuario: user } });
  });
  return hook;
};

describe('useAdminDatos', () => {
  it('con usuario, carga los tres listados una vez; muebles y categorías sin caché', async () => {
    const { result } = await montar({ email: 'a@a.com' });

    expect(result.current.muebles).toEqual([{ id: 'm1' }]);
    expect(result.current.categorias).toEqual([{ id: 1 }]);
    expect(result.current.pedidos).toEqual([{ id: 'p1', estado: 'procesando' }]);
    expect(result.current.infoPedidos).toEqual({ total: 1, pagina: 1, totalPaginas: 1, pendientes: 1 });
    expect(getPedidos).toHaveBeenCalledWith({ pagina: 1, estado: '' });
    expect(getMuebles).toHaveBeenCalledWith({ fresco: true });
    expect(getCategorias).toHaveBeenCalledWith({ fresco: true });
    expect(getPedidos).toHaveBeenCalledTimes(1);
    expect(result.current.mensajes).toEqual([{ id: 'c1', leido: false }]);
    expect(result.current.errorMensajes).toBe(false);
  });

  it('si los mensajes no se pueden cargar (p. ej. sin la tabla), lista vacía y errorMensajes', async () => {
    getMensajes.mockResolvedValue(null);
    const { result } = await montar({ email: 'a@a.com' });

    expect(result.current.mensajes).toEqual([]);
    expect(result.current.errorMensajes).toBe(true);

    getMensajes.mockResolvedValue([]);
    await act(() => result.current.cargarMensajes());
    expect(result.current.errorMensajes).toBe(false);
  });

  it('sin usuario no carga nada', async () => {
    const { result } = await montar(null);

    expect(getMuebles).not.toHaveBeenCalled();
    expect(result.current.muebles).toEqual([]);
  });

  it('si getPedidos no devuelve una lista, se queda en lista vacía', async () => {
    getPedidos.mockResolvedValue(null);
    const { result } = await montar({ email: 'a@a.com' });

    expect(result.current.pedidos).toEqual([]);
  });

  it('las funciones de recarga vuelven a pedir cada listado', async () => {
    const { result } = await montar({ email: 'a@a.com' });
    getMuebles.mockResolvedValue([{ id: 'm2' }]);

    await act(() => result.current.cargarMuebles());

    expect(result.current.muebles).toEqual([{ id: 'm2' }]);
    expect(getMuebles).toHaveBeenCalledTimes(2);
  });
});
