import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getAgendaReservasAdmin } from '../../../services/api';
import useAgendaReservas from './useAgendaReservas';

vi.mock('../../../services/api');

const AGENDA = { hoy: '2026-10-13', manana: '2026-10-14', trayectos: [{ clave: 'r1:entrega' }] };
const ok = (data) => ({ data, error: null, status: 200 });
const falla = (error) => ({ data: null, error, status: 500 });
const diferida = () => {
  let resolver;
  const promesa = new Promise((r) => {
    resolver = r;
  });
  return { promesa, resolver };
};

beforeEach(() => {
  vi.resetAllMocks();
  getAgendaReservasAdmin.mockResolvedValue(ok(AGENDA));
});

const montar = async () => {
  let hook;
  await act(async () => {
    hook = renderHook(() => useAgendaReservas());
  });
  return hook;
};

describe('useAgendaReservas', () => {
  it('lee la agenda al entrar', async () => {
    const { result } = await montar();

    expect(getAgendaReservasAdmin).toHaveBeenCalledTimes(1);
    expect(result.current.datos).toEqual(AGENDA);
    expect(result.current.error).toBe('');
    expect(result.current.cargando).toBe(false);
  });

  it('mientras lee, está cargando y no hay agenda', async () => {
    const lectura = diferida();
    getAgendaReservasAdmin.mockReturnValue(lectura.promesa);
    const { result } = await montar();

    expect(result.current.cargando).toBe(true);
    expect(result.current.datos).toBeNull();
    await act(async () => lectura.resolver(ok(AGENDA)));
    expect(result.current.cargando).toBe(false);
  });

  it('`recargar` la vuelve a leer', async () => {
    const { result } = await montar();
    getAgendaReservasAdmin.mockResolvedValue(ok({ ...AGENDA, trayectos: [] }));

    await act(async () => result.current.recargar());

    expect(getAgendaReservasAdmin).toHaveBeenCalledTimes(2);
    expect(result.current.datos.trayectos).toEqual([]);
  });

  it('si falla, el mensaje del servidor; y no hay agenda', async () => {
    getAgendaReservasAdmin.mockResolvedValue(falla('Error interno al cargar las entregas y recogidas.'));
    const { result } = await montar();

    expect(result.current.error).toBe('Error interno al cargar las entregas y recogidas.');
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(false);
  });

  it('si una lectura falla, se queda la última agenda que se tenía', async () => {
    const { result } = await montar();
    getAgendaReservasAdmin.mockResolvedValue(falla('Sin conexión.'));

    await act(async () => result.current.recargar());

    expect(result.current.error).toBe('Sin conexión.');
    expect(result.current.datos).toEqual(AGENDA);
  });

  it('una lectura buena después de un fallo quita el error', async () => {
    getAgendaReservasAdmin.mockResolvedValue(falla('Sin conexión.'));
    const { result } = await montar();
    getAgendaReservasAdmin.mockResolvedValue(ok(AGENDA));

    await act(async () => result.current.recargar());

    expect(result.current.error).toBe('');
    expect(result.current.datos).toEqual(AGENDA);
  });

  it('una respuesta sin lista de trayectos no se toma por una agenda', async () => {
    getAgendaReservasAdmin.mockResolvedValue(ok({ hoy: '2026-10-13' }));
    const { result } = await montar();

    expect(result.current.datos).toBeNull();
  });

  it('sin respuesta alguna (un doble sin configurar) no hay agenda ni error', async () => {
    getAgendaReservasAdmin.mockResolvedValue(undefined);
    const { result } = await montar();

    expect(result.current.datos).toBeNull();
    expect(result.current.error).toBe('');
    expect(result.current.cargando).toBe(false);
  });

  it('la respuesta lenta de una lectura anterior no pisa la más reciente', async () => {
    const lenta = diferida();
    getAgendaReservasAdmin.mockReturnValueOnce(lenta.promesa);
    const { result } = await montar();
    getAgendaReservasAdmin.mockResolvedValue(ok(AGENDA));
    await act(async () => result.current.recargar());

    await act(async () => lenta.resolver(ok({ ...AGENDA, trayectos: [] })));

    expect(result.current.datos).toEqual(AGENDA);
  });
});
