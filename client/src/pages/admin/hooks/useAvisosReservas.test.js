import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getResumenReservasAdmin } from '../../../services/api';
import useAvisosReservas from './useAvisosReservas';

vi.mock('../../../services/api');

const RESUMEN = { hoy: '2026-10-20', total: 3, retrasadas: 2, en_conflicto: 1, reembolsos_a_medias: 0 };
const ok = (data) => ({ data, error: null, status: 200 });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
  getResumenReservasAdmin.mockResolvedValue(ok(RESUMEN));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const montar = async (user = { email: 'a@a.com' }, vista = 'resumen') => {
  let hook;
  await act(async () => {
    hook = renderHook(({ usuario, pestana }) => useAvisosReservas(usuario, pestana), {
      initialProps: { usuario: user, pestana: vista }
    });
  });
  return hook;
};

describe('useAvisosReservas', () => {
  it('con el interruptor encendido y sesión, lee los avisos al entrar', async () => {
    const { result } = await montar();

    expect(getResumenReservasAdmin).toHaveBeenCalledTimes(1);
    expect(result.current.avisos).toEqual(RESUMEN);
  });

  it('con el interruptor apagado no pide nada: el panel es el de siempre', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'false');
    const { result } = await montar();

    expect(getResumenReservasAdmin).not.toHaveBeenCalled();
    expect(result.current.avisos).toBeNull();
  });

  it('sin sesión no pide nada', async () => {
    const { result } = await montar(null);

    expect(getResumenReservasAdmin).not.toHaveBeenCalled();
    expect(result.current.avisos).toBeNull();
  });

  it('al cambiar de pestaña vuelve a leer, y `recargar` lo hace a petición', async () => {
    const { result, rerender } = await montar();
    getResumenReservasAdmin.mockResolvedValue(ok({ ...RESUMEN, total: 2, retrasadas: 1 }));

    await act(async () => rerender({ usuario: { email: 'a@a.com' }, pestana: 'reservas' }));
    expect(getResumenReservasAdmin).toHaveBeenCalledTimes(2);
    expect(result.current.avisos.total).toBe(2);

    getResumenReservasAdmin.mockResolvedValue(ok({ ...RESUMEN, total: 0, retrasadas: 0, en_conflicto: 0 }));
    await act(async () => {
      await result.current.recargar();
    });
    expect(getResumenReservasAdmin).toHaveBeenCalledTimes(3);
    expect(result.current.avisos.total).toBe(0);
  });

  it('si una lectura falla (o llega rara), se queda el último número en vez de borrarlo', async () => {
    const { result } = await montar();

    getResumenReservasAdmin.mockResolvedValue({ data: null, error: 'Sin conexión.', status: 0 });
    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.avisos).toEqual(RESUMEN);

    getResumenReservasAdmin.mockResolvedValue(ok({ total: 'muchas' }));
    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.avisos).toEqual(RESUMEN);

    getResumenReservasAdmin.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.avisos).toEqual(RESUMEN);
  });

  it('una respuesta tardía no pisa una lectura más reciente', async () => {
    let soltarLenta;
    getResumenReservasAdmin.mockReturnValueOnce(new Promise((resolver) => (soltarLenta = resolver)));
    const { result } = await montar();

    getResumenReservasAdmin.mockResolvedValue(ok({ ...RESUMEN, total: 1, retrasadas: 1 }));
    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.avisos.total).toBe(1);

    await act(async () => soltarLenta(ok(RESUMEN)));
    expect(result.current.avisos.total).toBe(1);
  });
});
