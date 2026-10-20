import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getCalendarioReservasAdmin } from '../../../services/api';
import useCalendarioReservas from './useCalendarioReservas';

vi.mock('../../../services/api');

const calendario = (desde, hasta, ids = ['r1']) => ({
  hoy: '2026-11-10',
  desde,
  hasta,
  reservas: ids.map((id) => ({ id })),
  limitada: false
});
const ok = (data) => ({ data, error: null, status: 200 });
const falla = (error) => ({ data: null, error, status: 500 });
const diferida = () => {
  let resolver;
  const promesa = new Promise((r) => {
    resolver = r;
  });
  return { promesa, resolver };
};

const NOVIEMBRE = { desde: '2026-10-26', hasta: '2026-12-06', muebleId: 'm1' };
const DICIEMBRE = { desde: '2026-11-30', hasta: '2027-01-10', muebleId: 'm1' };

beforeEach(() => {
  vi.resetAllMocks();
  getCalendarioReservasAdmin.mockImplementation(({ desde, hasta }) => Promise.resolve(ok(calendario(desde, hasta))));
});

const montar = async (props) => {
  let hook;
  await act(async () => {
    hook = renderHook((p) => useCalendarioReservas(p), { initialProps: props });
  });
  return hook;
};

describe('useCalendarioReservas', () => {
  it('lee el rango y la pieza que se piden', async () => {
    const { result } = await montar(NOVIEMBRE);

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
    expect(getCalendarioReservasAdmin).toHaveBeenCalledWith(NOVIEMBRE);
    expect(result.current.datos.reservas).toEqual([{ id: 'r1' }]);
    expect(result.current.error).toBe('');
    expect(result.current.cargando).toBe(false);
  });

  it('sin pieza no manda mueble_id (la vista general)', async () => {
    await montar({ desde: '2026-11-10', hasta: '2026-12-09' });
    expect(getCalendarioReservasAdmin).toHaveBeenCalledWith({ desde: '2026-11-10', hasta: '2026-12-09', muebleId: undefined });
  });

  it('mientras lee está cargando y no hay datos', async () => {
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);
    const { result } = await montar(NOVIEMBRE);

    expect(result.current.cargando).toBe(true);
    expect(result.current.datos).toBeNull();
    await act(async () => lectura.resolver(ok(calendario(NOVIEMBRE.desde, NOVIEMBRE.hasta))));
    expect(result.current.cargando).toBe(false);
    expect(result.current.datos).not.toBeNull();
  });

  it('apagado no lee nada, y al encenderse lee', async () => {
    const { result, rerender } = await montar({ ...NOVIEMBRE, activo: false });
    expect(getCalendarioReservasAdmin).not.toHaveBeenCalled();
    expect(result.current.datos).toBeNull();

    await act(async () => rerender({ ...NOVIEMBRE, activo: true }));
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
    expect(result.current.datos).not.toBeNull();
  });

  it('un rango nuevo se vuelve a leer y no enseña los días del anterior mientras llega', async () => {
    const { result, rerender } = await montar(NOVIEMBRE);
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await act(async () => rerender(DICIEMBRE));

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(2);
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(true);
    await act(async () => lectura.resolver(ok(calendario(DICIEMBRE.desde, DICIEMBRE.hasta, ['r2']))));
    expect(result.current.datos.reservas).toEqual([{ id: 'r2' }]);
  });

  it('otra pieza también se vuelve a leer', async () => {
    const { rerender } = await montar(NOVIEMBRE);
    await act(async () => rerender({ ...NOVIEMBRE, muebleId: 'm2' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ ...NOVIEMBRE, muebleId: 'm2' });
  });

  it('con otra pieza no enseña los datos de la anterior mientras llega la nueva', async () => {
    const { result, rerender } = await montar(NOVIEMBRE);
    expect(result.current.datos).not.toBeNull();

    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);
    await act(async () => rerender({ ...NOVIEMBRE, muebleId: 'm2' }));
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(true);

    await act(async () => lectura.resolver(ok(calendario(NOVIEMBRE.desde, NOVIEMBRE.hasta, ['r9']))));
    expect(result.current.datos.reservas).toEqual([{ id: 'r9' }]);
  });

  it('en el mismo instante en que cambia el rango ya dice que está cargando (no hay un momento vacío)', async () => {
    const dibujados = [];
    let hook;
    await act(async () => {
      hook = renderHook(
        (p) => {
          const lectura = useCalendarioReservas(p);
          dibujados.push(lectura.cargando);
          return lectura;
        },
        { initialProps: NOVIEMBRE }
      );
    });
    expect(hook.result.current.cargando).toBe(false);

    dibujados.length = 0;
    await act(async () => hook.rerender(DICIEMBRE));
    expect(dibujados[0]).toBe(true);
  });

  it('si no cambia nada, no se vuelve a leer', async () => {
    const { rerender } = await montar(NOVIEMBRE);
    await act(async () => rerender({ ...NOVIEMBRE }));
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('cuando sube `version` vuelve a leer el mismo rango y deja los datos de antes mientras tanto', async () => {
    const { result, rerender } = await montar({ ...NOVIEMBRE, version: 0 });
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await act(async () => rerender({ ...NOVIEMBRE, version: 1 }));

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(2);
    expect(result.current.datos.reservas).toEqual([{ id: 'r1' }]);
    expect(result.current.cargando).toBe(true);
    await act(async () => lectura.resolver(ok(calendario(NOVIEMBRE.desde, NOVIEMBRE.hasta, ['r3']))));
    expect(result.current.datos.reservas).toEqual([{ id: 'r3' }]);
    expect(result.current.cargando).toBe(false);
  });

  it('si la primera lectura falla: sin datos y con el error del servidor', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(falla('Error interno al cargar el calendario de reservas.'));
    const { result } = await montar(NOVIEMBRE);

    expect(result.current.datos).toBeNull();
    expect(result.current.error).toBe('Error interno al cargar el calendario de reservas.');
    expect(result.current.cargando).toBe(false);
  });

  it('un fallo sin texto dice que no se ha podido cargar', async () => {
    getCalendarioReservasAdmin.mockResolvedValue({ data: null, error: null, status: 0 });
    const { result } = await montar(NOVIEMBRE);
    expect(result.current.error).toBe('No se ha podido cargar el calendario de reservas.');
  });

  it('una lectura que no devuelve nada es un fallo, no un error del programa', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(undefined);
    const { result } = await montar(NOVIEMBRE);
    expect(result.current.datos).toBeNull();
    expect(result.current.error).toBe('No se ha podido cargar el calendario de reservas.');
    expect(result.current.cargando).toBe(false);
  });

  it('una respuesta sin lista de reservas es un fallo', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok({ hoy: '2026-11-10' }));
    const { result } = await montar(NOVIEMBRE);
    expect(result.current.datos).toBeNull();
    expect(result.current.error).not.toBe('');
  });

  it('una lectura que falla del mismo rango conserva los datos que ya había, con el error', async () => {
    const { result, rerender } = await montar({ ...NOVIEMBRE, version: 0 });
    getCalendarioReservasAdmin.mockResolvedValue(falla('Sin conexión.'));

    await act(async () => rerender({ ...NOVIEMBRE, version: 1 }));

    expect(result.current.datos.reservas).toEqual([{ id: 'r1' }]);
    expect(result.current.error).toBe('Sin conexión.');
  });

  it('el error de un rango no sale en el rango siguiente', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(falla('Sin conexión.'));
    const { result, rerender } = await montar(NOVIEMBRE);
    expect(result.current.error).toBe('Sin conexión.');
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await act(async () => rerender(DICIEMBRE));

    expect(result.current.error).toBe('');
    expect(result.current.cargando).toBe(true);
  });

  it('una lectura buena borra el error de antes', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(falla('Sin conexión.'));
    const { result, rerender } = await montar({ ...NOVIEMBRE, version: 0 });
    getCalendarioReservasAdmin.mockImplementation(({ desde, hasta }) => Promise.resolve(ok(calendario(desde, hasta))));

    await act(async () => rerender({ ...NOVIEMBRE, version: 1 }));

    expect(result.current.error).toBe('');
    expect(result.current.datos).not.toBeNull();
  });

  it('una respuesta tardía de un rango anterior no pisa la del actual', async () => {
    const vieja = diferida();
    const nueva = diferida();
    getCalendarioReservasAdmin.mockReturnValueOnce(vieja.promesa).mockReturnValueOnce(nueva.promesa);
    const { result, rerender } = await montar(NOVIEMBRE);
    await act(async () => rerender(DICIEMBRE));

    await act(async () => nueva.resolver(ok(calendario(DICIEMBRE.desde, DICIEMBRE.hasta, ['nueva']))));
    await act(async () => vieja.resolver(ok(calendario(NOVIEMBRE.desde, NOVIEMBRE.hasta, ['vieja']))));

    expect(result.current.datos.reservas).toEqual([{ id: 'nueva' }]);
  });

  it('una respuesta que llega después de desmontar no hace nada', async () => {
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);
    const { unmount } = await montar(NOVIEMBRE);
    unmount();
    await expect(act(async () => lectura.resolver(ok(calendario(NOVIEMBRE.desde, NOVIEMBRE.hasta))))).resolves.not.toThrow();
  });
});
