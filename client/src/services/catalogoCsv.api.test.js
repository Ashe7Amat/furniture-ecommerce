// Llamadas a la API de las herramientas nuevas del panel: exportar e importar el catálogo en CSV
// (con la descarga del archivo) y los mensajes del formulario de contacto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportarCatalogoCsv, exportarClientesCsv, importarCatalogoCsv, getMensajes, marcarMensajeLeido } from './api';
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

describe('exportarClientesCsv', () => {
  it('pide el CSV de clientes a la ruta de administración, con sesión y sin caché', async () => {
    setAccessToken('token-del-admin');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaCsv()));

    await exportarClientesCsv();

    expect(fetch.mock.calls[0][0]).toMatch(/\/admin\/clientes\/export$/);
    expect(fetch.mock.calls[0][1]).toEqual({
      cache: 'no-store',
      headers: { Authorization: 'Bearer token-del-admin' }
    });
  });

  it('usa el nombre que manda el servidor si el navegador lo deja leer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaCsv({ disposicion: 'attachment; filename="clientes-nave5-2026-10-07.csv"' }))
    );

    const resultado = await exportarClientesCsv();

    expect(resultado.nombreArchivo).toBe('clientes-nave5-2026-10-07.csv');
    expect(resultado.blob).toBeInstanceOf(Blob);
  });

  it('si no puede leer esa cabecera (otro dominio), arma el nombre de clientes con la fecha de Madrid', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T23:30:00Z')); // ya es 1 de enero en Madrid
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaCsv()));

    const resultado = await exportarClientesCsv();

    expect(resultado.nombreArchivo).toBe('clientes-nave5-2027-01-01.csv');
  });

  it('devuelve null si el servidor responde con error o no hay red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaCsv({ ok: false })));
    expect(await exportarClientesCsv()).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    expect(await exportarClientesCsv()).toBeNull();
  });
});

describe('importarCatalogoCsv', () => {
  const respuestaJson = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo });

  it('manda el archivo y el modo en un formulario, con sesión', async () => {
    setAccessToken('token-del-admin');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson(200, { total: 1 })));
    const archivo = new File(['nombre;categoria\n'], 'c.csv', { type: 'text/csv' });

    const resultado = await importarCatalogoCsv(archivo, 'preview');

    expect(resultado).toEqual({ datos: { total: 1 } });
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toMatch(/\/admin\/muebles\/import$/);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers).toEqual({ Authorization: 'Bearer token-del-admin' });
    expect(opciones.body.get('modo')).toBe('preview');
    expect(opciones.body.get('archivo').name).toBe('c.csv');
  });

  it('un 4xx devuelve el mensaje del servidor; sin mensaje, uno genérico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson(400, { error: 'Faltan las cabeceras' })));
    expect(await importarCatalogoCsv(new File([''], 'c.csv'), 'apply')).toEqual({ error: 'Faltan las cabeceras' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    expect(await importarCatalogoCsv(new File([''], 'c.csv'), 'apply')).toEqual({
      error: 'No se pudo importar el catálogo.'
    });
  });

  it('sin red, avisa de que no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    expect(await importarCatalogoCsv(new File([''], 'c.csv'), 'apply')).toEqual({
      error: 'No se pudo conectar con el servidor. Inténtalo de nuevo.'
    });
  });
});

describe('mensajes de contacto', () => {
  const respuestaJson = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo });

  it('getMensajes los pide a la ruta de administración, con sesión y sin caché', async () => {
    setAccessToken('token-del-admin');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson(200, [{ id: 'c1' }])));

    expect(await getMensajes()).toEqual([{ id: 'c1' }]);
    expect(fetch.mock.calls[0][0]).toMatch(/\/admin\/mensajes$/);
    expect(fetch.mock.calls[0][1]).toEqual({
      cache: 'no-store',
      headers: { Authorization: 'Bearer token-del-admin' }
    });
  });

  it('getMensajes devuelve null si falla (para distinguirlo de "no hay mensajes")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson(500, { error: 'x' })));
    expect(await getMensajes()).toBeNull();
  });

  it('marcarMensajeLeido manda un PATCH con { leido: true } y devuelve el mensaje', async () => {
    setAccessToken('token-del-admin');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson(200, { id: 'c 1', leido: true })));

    expect(await marcarMensajeLeido('c 1')).toEqual({ id: 'c 1', leido: true });
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toMatch(/\/admin\/mensajes\/c%201\/leido$/);
    expect(opciones.method).toBe('PATCH');
    expect(JSON.parse(opciones.body)).toEqual({ leido: true });
  });

  it('marcarMensajeLeido devuelve null si falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson(404, { error: 'no' })));
    expect(await marcarMensajeLeido('c1')).toBeNull();
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
