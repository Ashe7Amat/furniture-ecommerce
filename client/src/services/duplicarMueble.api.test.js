// duplicarMueble (api.js, 21 oct 2026): qué pide al servidor y qué devuelve, con el formato de
// peticion.js ({ data, error, status }). fetch se sustituye por un doble.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duplicarMueble } from './api';
import { setAccessToken, limpiarTokens } from '../utils/authToken';

const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  limpiarTokens();
  setAccessToken('tk-admin');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('duplicarMueble', () => {
  it('hace POST a /muebles/:id/duplicar con la sesión, y devuelve el cuerpo en data', async () => {
    fetch.mockResolvedValue(respuesta(201, { success: true, data: [{ id: 'nueva', referencia: 'NAV-SIL-003' }] }));

    const resultado = await duplicarMueble('m2');

    const [url, opciones] = fetch.mock.calls.at(-1);
    expect(url).toMatch(/\/muebles\/m2\/duplicar$/);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers.Authorization).toBe('Bearer tk-admin');
    expect(resultado).toEqual({
      data: { success: true, data: [{ id: 'nueva', referencia: 'NAV-SIL-003' }] },
      error: null,
      status: 201
    });
  });

  it('si el servidor responde con error, devuelve su mensaje', async () => {
    fetch.mockResolvedValue(respuesta(409, { error: 'Vuelve a intentarlo.' }));

    expect(await duplicarMueble('m2')).toEqual({ data: null, error: 'Vuelve a intentarlo.', status: 409 });
  });

  it('si la respuesta de error no trae mensaje, uno genérico', async () => {
    fetch.mockResolvedValue({ ok: false, status: 504, json: async () => { throw new Error('no es JSON'); } });

    expect(await duplicarMueble('m2')).toEqual({ data: null, error: 'No se pudo duplicar la pieza.', status: 504 });
  });
});
