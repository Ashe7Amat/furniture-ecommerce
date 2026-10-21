import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMetricasDashboard } from './api';
import { setAccessToken, limpiarTokens } from '../utils/authToken';

const respuesta = (ok, cuerpo = {}) => ({ ok, json: async () => cuerpo });

beforeEach(() => {
  localStorage.clear();
  limpiarTokens();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getMetricasDashboard', () => {
  it('pide las métricas a la ruta de administración, con la sesión, y devuelve el cuerpo', async () => {
    setAccessToken('token-del-admin');
    const metricas = { ticketMedio: 125, ingresosAlquiler: 0 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(true, metricas)));

    expect(await getMetricasDashboard()).toEqual(metricas);
    expect(fetch.mock.calls[0][0]).toMatch(/\/admin\/dashboard\/metricas$/);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-del-admin');
  });

  it('si el servidor responde con error, devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(false)));

    expect(await getMetricasDashboard()).toBeNull();
  });

  it('si falla la red, devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));

    expect(await getMetricasDashboard()).toBeNull();
  });
});
