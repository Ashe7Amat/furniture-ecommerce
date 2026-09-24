import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMuebles, getCategorias } from './api';

// fetch se sustituye por un doble: estos tests comprueban QUÉ se pide y CÓMO, no la red.
const respuestaOk = (cuerpo = []) => ({ ok: true, json: async () => cuerpo });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaOk()));
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lecturas del catálogo: con caché para el público, "frescas" para el panel', () => {
  it.each([
    ['getMuebles', getMuebles, /\/muebles$/],
    ['getCategorias', getCategorias, /\/categorias$/]
  ])('%s() sin opciones hace un fetch normal: solo la URL, sin cabeceras ni modo de caché', async (_nombre, lectura, ruta) => {
    await lectura();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toMatch(ruta);
  });

  it('getMuebles({ limit }) pide solo los N más recientes, también con un fetch normal', async () => {
    await getMuebles({ limit: 4 });

    expect(fetch.mock.calls[0]).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toMatch(/\/muebles\?limit=4$/);
  });

  it.each([
    ['getMuebles', getMuebles, /\/muebles$/],
    ['getCategorias', getCategorias, /\/categorias$/]
  ])('%s({ fresco: true }) se salta la caché del navegador (no-store) y la de la CDN (Authorization)', async (_nombre, lectura, ruta) => {
    localStorage.setItem('kaveToken', 'token-del-admin');

    await lectura({ fresco: true });

    expect(fetch.mock.calls[0][0]).toMatch(ruta);
    expect(fetch.mock.calls[0][1]).toEqual({
      cache: 'no-store',
      headers: { Authorization: 'Bearer token-del-admin' }
    });
  });

  it('sin token guardado, { fresco: true } sigue saltándose la caché del navegador (sin cabecera Authorization)', async () => {
    // Hoy el panel siempre tiene sesión, pero si algún día se usa `fresco` sin ella, no-store se
    // mantiene. Ojo: sin Authorization, la CDN de Vercel sí puede servir su copia (ver lecturaFresca).
    await getMuebles({ fresco: true });

    expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-store', headers: {} });
  });

  it('getMuebles({ fresco, limit }) combina las dos opciones', async () => {
    localStorage.setItem('kaveToken', 'tk');

    await getMuebles({ fresco: true, limit: 4 });

    expect(fetch.mock.calls[0][0]).toMatch(/\/muebles\?limit=4$/);
    expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-store', headers: { Authorization: 'Bearer tk' } });
  });

  it.each([
    ['getMuebles', getMuebles],
    ['getCategorias', getCategorias]
  ])('%s sigue devolviendo [] si la petición falla, también en modo fresco (contrato C, H12)', async (_nombre, lectura) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockRejectedValue(new Error('sin red'));

    expect(await lectura()).toEqual([]);
    expect(await lectura({ fresco: true })).toEqual([]);
  });
});
