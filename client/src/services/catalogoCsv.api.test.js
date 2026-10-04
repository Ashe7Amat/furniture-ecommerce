// Exportar el catálogo a CSV desde el panel: la llamada a la API y la descarga del archivo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportarCatalogoCsv } from './api';
import { setAccessToken, limpiarTokens } from '../utils/authToken';
import { descargarArchivo } from '../utils/descargarArchivo';

const respuestaCsv = ({ ok = true, disposicion = null } = {}) => ({
  ok,
  status: ok ? 200 : 500,
  headers: { get: (nombre) => (nombre === 'Content-Disposition' ? disposicion : null) },
  blob: async () => new Blob(['﻿id;nombre\r\n'], { type: 'text/csv' })
});

beforeEach(() => {
  limpiarTokens();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('exportarCatalogoCsv', () => {
  it('pide el CSV a la ruta de administración, con sesión y sin caché', async () => {
    setAccessToken('token-del-admin');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaCsv()));

    await exportarCatalogoCsv();

    expect(fetch.mock.calls[0][0]).toMatch(/\/admin\/muebles\/export$/);
    expect(fetch.mock.calls[0][1]).toEqual({
      cache: 'no-store',
      headers: { Authorization: 'Bearer token-del-admin' }
    });
  });

  it('usa el nombre que manda el servidor si el navegador lo deja leer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaCsv({ disposicion: 'attachment; filename="catalogo-nave5-2026-10-04.csv"' }))
    );

    const resultado = await exportarCatalogoCsv();

    expect(resultado.nombreArchivo).toBe('catalogo-nave5-2026-10-04.csv');
    expect(resultado.blob).toBeInstanceOf(Blob);
  });

  it('si no puede leer esa cabecera (otro dominio), arma el mismo nombre con la fecha de Madrid', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T23:30:00Z')); // ya es 1 de enero en Madrid
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaCsv()));

    const resultado = await exportarCatalogoCsv();

    expect(resultado.nombreArchivo).toBe('catalogo-nave5-2027-01-01.csv');
  });

  it('devuelve null si el servidor responde con error o no hay red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaCsv({ ok: false })));
    expect(await exportarCatalogoCsv()).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    expect(await exportarCatalogoCsv()).toBeNull();
  });
});

describe('descargarArchivo', () => {
  it('crea un enlace con el nombre del archivo, lo pulsa y libera la URL', () => {
    const crear = vi.fn(() => 'blob:x');
    const liberar = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: crear, revokeObjectURL: liberar });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('catalogo.csv');
      expect(this.getAttribute('href')).toBe('blob:x');
    });

    const blob = new Blob(['a']);
    descargarArchivo(blob, 'catalogo.csv');

    expect(crear).toHaveBeenCalledWith(blob);
    expect(clic).toHaveBeenCalledTimes(1);
    expect(liberar).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull(); // el enlace no se queda en la página
  });
});
