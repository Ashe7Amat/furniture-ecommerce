import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getMuebles, getCategorias, getPedidos } from '../../../services/api';
import useAdminDatos from './useAdminDatos';

vi.mock('../../../services/api');

beforeEach(() => {
  vi.resetAllMocks();
  getMuebles.mockResolvedValue([{ id: 'm1' }]);
  getCategorias.mockResolvedValue([{ id: 1 }]);
  getPedidos.mockResolvedValue([{ id: 'p1' }]);
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
    expect(result.current.pedidos).toEqual([{ id: 'p1' }]);
    expect(getMuebles).toHaveBeenCalledWith({ fresco: true });
    expect(getCategorias).toHaveBeenCalledWith({ fresco: true });
    expect(getPedidos).toHaveBeenCalledTimes(1);
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
