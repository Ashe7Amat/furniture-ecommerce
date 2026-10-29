// Las funciones del panel de api.js que el resto de tests sustituyen por dobles: la agenda, las
// acciones PATCH/POST antiguas de reservas, el registro de actividad y los ajustes de portada. Qué
// piden al servidor y qué devuelven, con fetch sustituido por un doble como en reservas.api.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiFetch,
  getAgendaReservasAdmin,
  entregarReservaAdmin,
  recogerReservaAdmin,
  cancelarReservaAdmin,
  bloquearFechasAdmin,
  getAuditLogs,
  getAjustesHome,
  actualizarAjustesHome,
  subirImagenHero
} from './api';
import { setAccessToken, setRefreshToken, limpiarTokens, getAccessToken } from '../utils/authToken';

const API = 'http://localhost:5000/api';
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (cuerpo === undefined) throw new SyntaxError('Unexpected token <');
    return cuerpo;
  }
});
const peticion = (n = -1) => {
  const [url, opciones = {}] = fetch.mock.calls.at(n);
  return { url, ...opciones };
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
  limpiarTokens();
  setAccessToken('tk-1');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch — renovación con una respuesta que no es JSON', () => {
  it('no guarda nada y devuelve el 401 original', async () => {
    setRefreshToken('rf-1');
    fetch.mockImplementation(async (url) =>
      String(url).endsWith('/auth/refresh') ? respuesta(200, undefined) : respuesta(401, {})
    );
    const res = await apiFetch(`${API}/pedidos`);
    expect(res.status).toBe(401);
    expect(getAccessToken()).toBe('tk-1');
  });
});

describe('getAgendaReservasAdmin', () => {
  it('pide la agenda sin caché y devuelve sus datos', async () => {
    fetch.mockResolvedValue(respuesta(200, { hoy: [], manana: [] }));
    expect(await getAgendaReservasAdmin()).toEqual({
      data: { hoy: [], manana: [] },
      error: null,
      status: 200
    });
    expect(peticion()).toMatchObject({ url: `${API}/admin/reservas/agenda`, cache: 'no-store' });
    expect(peticion().headers.Authorization).toBe('Bearer tk-1');
  });

  it('si falla sin mensaje, el suyo', async () => {
    fetch.mockResolvedValue(respuesta(500, {}));
    expect((await getAgendaReservasAdmin()).error).toBe('No se ha podido cargar la agenda de hoy y mañana.');
  });
});

describe('acciones antiguas de reservas del panel', () => {
  it('entregar: PATCH con «antes_de_tiempo»', async () => {
    fetch.mockResolvedValue(respuesta(200, { id: 'r/1' }));
    expect((await entregarReservaAdmin('r/1')).data).toEqual({ id: 'r/1' });
    const p = peticion();
    expect(p.url).toBe(`${API}/admin/reservas/r%2F1/entregar`);
    expect(p.method).toBe('PATCH');
    expect(JSON.parse(p.body)).toEqual({ antes_de_tiempo: true });
  });

  it('entregar: un 409 con código lo devuelve junto al error', async () => {
    fetch.mockResolvedValue(respuesta(409, { error: 'Antes de tiempo', codigo: 'entrega_anticipada' }));
    expect(await entregarReservaAdmin('r1')).toEqual({
      data: null,
      error: 'Antes de tiempo',
      status: 409,
      codigo: 'entrega_anticipada'
    });
  });

  it('recoger: PATCH con cuerpo vacío y su mensaje por defecto', async () => {
    fetch.mockResolvedValue(respuesta(500, undefined));
    expect((await recogerReservaAdmin('r1')).error).toBe('No se ha podido marcar como recogida.');
    const p = peticion();
    expect(p.url).toBe(`${API}/admin/reservas/r1/recoger`);
    expect(p.method).toBe('PATCH');
    expect(JSON.parse(p.body)).toEqual({});
  });

  it('cancelar: POST con los datos, o vacío', async () => {
    fetch.mockResolvedValue(respuesta(200, { ok: true }));
    await cancelarReservaAdmin('r1', { reembolso_centimos: 500 });
    expect(peticion()).toMatchObject({ url: `${API}/admin/reservas/r1/cancelar`, method: 'POST' });
    expect(JSON.parse(peticion().body)).toEqual({ reembolso_centimos: 500 });
    await cancelarReservaAdmin('r1');
    expect(JSON.parse(peticion().body)).toEqual({});
  });

  it('bloquear fechas: POST a /bloqueo; sin conexión no lanza', async () => {
    fetch.mockResolvedValue(respuesta(201, { id: 'b1' }));
    expect((await bloquearFechasAdmin({ mueble_id: 'm1' })).data).toEqual({ id: 'b1' });
    expect(peticion()).toMatchObject({ url: `${API}/admin/reservas/bloqueo`, method: 'POST' });

    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await bloquearFechasAdmin({ mueble_id: 'm1' });
    expect(res.data).toBeNull();
    expect(res.status).toBe(0);
  });
});

describe('getAuditLogs', () => {
  it('sin filtros pide la página 1 de 50', async () => {
    fetch.mockResolvedValue(respuesta(200, { logs: [], total: 0 }));
    expect(await getAuditLogs()).toEqual({ logs: [], total: 0 });
    expect(peticion().url).toBe(`${API}/admin/audit-log?page=1&limit=50`);
  });

  it('con todos los filtros los manda en la consulta', async () => {
    fetch.mockResolvedValue(respuesta(200, { logs: [] }));
    await getAuditLogs({
      entidad: 'muebles',
      accion: 'editar',
      admin_email: 'a@b.es',
      fecha: '2026-10-29',
      page: 2,
      limit: 10
    });
    const url = new URL(peticion().url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      entidad: 'muebles',
      accion: 'editar',
      admin_email: 'a@b.es',
      fecha: '2026-10-29',
      page: '2',
      limit: '10'
    });
  });

  it('sin página ni límite no añade consulta', async () => {
    fetch.mockResolvedValue(respuesta(200, { logs: [] }));
    await getAuditLogs({ page: 0, limit: 0 });
    expect(peticion().url).toBe(`${API}/admin/audit-log`);
  });

  it('si falla devuelve null', async () => {
    fetch.mockResolvedValue(respuesta(500, {}));
    expect(await getAuditLogs()).toBeNull();
  });
});

describe('getAjustesHome', () => {
  it('pide los ajustes públicos sin caché y sin sesión; si fallan, null', async () => {
    fetch.mockResolvedValue(respuesta(200, { hero: ['a'] }));
    expect(await getAjustesHome()).toEqual({ hero: ['a'] });
    expect(peticion()).toEqual({ url: `${API}/ajustes/home`, cache: 'no-store' });
    fetch.mockResolvedValue(respuesta(503, {}));
    expect(await getAjustesHome()).toBeNull();
  });
});

describe('actualizarAjustesHome', () => {
  it('PUT con los datos en JSON', async () => {
    fetch.mockResolvedValue(respuesta(200, { hero: [] }));
    expect(await actualizarAjustesHome({ hero: [] })).toEqual({ hero: [] });
    const p = peticion();
    expect(p.url).toBe(`${API}/admin/ajustes/home`);
    expect(p.method).toBe('PUT');
    expect(JSON.parse(p.body)).toEqual({ hero: [] });
  });

  it('si el servidor falla devuelve null, con su mensaje o sin cuerpo', async () => {
    fetch.mockResolvedValue(respuesta(400, { error: 'Datos no válidos' }));
    expect(await actualizarAjustesHome({})).toBeNull();
    expect(console.error).toHaveBeenLastCalledWith(
      'Error en actualizarAjustesHome:',
      expect.objectContaining({ message: 'Datos no válidos' })
    );
    fetch.mockResolvedValue(respuesta(500, undefined));
    expect(await actualizarAjustesHome({})).toBeNull();
    expect(console.error).toHaveBeenLastCalledWith(
      'Error en actualizarAjustesHome:',
      expect.objectContaining({ message: 'Error al actualizar ajustes de portada' })
    );
  });
});

describe('subirImagenHero', () => {
  const archivo = new File(['x'], 'hero.jpg', { type: 'image/jpeg' });

  it('manda el archivo en un FormData y devuelve la URL', async () => {
    fetch.mockResolvedValue(respuesta(200, { url: 'https://cdn/hero.jpg' }));
    expect(await subirImagenHero(archivo)).toBe('https://cdn/hero.jpg');
    const p = peticion();
    expect(p.url).toBe(`${API}/admin/ajustes/home/imagen`);
    expect(p.method).toBe('POST');
    expect(p.body.get('imagen')).toBeInstanceOf(File);
  });

  it('sin URL de texto devuelve la respuesta tal cual, o null si viene vacía', async () => {
    fetch.mockResolvedValue(respuesta(200, { imagenes: ['a'] }));
    expect(await subirImagenHero(archivo)).toEqual({ imagenes: ['a'] });
    fetch.mockResolvedValue(respuesta(200, null));
    expect(await subirImagenHero(archivo)).toBeNull();
  });

  it('si el servidor falla devuelve null, con su mensaje o sin cuerpo', async () => {
    fetch.mockResolvedValue(respuesta(413, { error: 'Demasiado grande' }));
    expect(await subirImagenHero(archivo)).toBeNull();
    expect(console.error).toHaveBeenLastCalledWith(
      'Error en subirImagenHero:',
      expect.objectContaining({ message: 'Demasiado grande' })
    );
    fetch.mockResolvedValue(respuesta(500, undefined));
    expect(await subirImagenHero(archivo)).toBeNull();
    expect(console.error).toHaveBeenLastCalledWith(
      'Error en subirImagenHero:',
      expect.objectContaining({ message: 'Error al subir imagen de portada' })
    );
  });
});
