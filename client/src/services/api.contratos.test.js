// Contratos de hoy de cada función de api.js (H12, en docs/mejoras-tecnicas.md): qué pide al
// servidor y qué devuelve si va bien, si el servidor responde con error y si falla la red.
//   A: si falla, null (el mensaje del servidor se pierde)
//   B: si falla, { error: mensaje }
//   C: si falla, [] (no se distingue de "no hay datos")
// Cuando se implemente la unificación de H12, estos tests son los que dirán qué cambia. fetch se
// sustituye por un doble: aquí se comprueba qué se pide y qué se devuelve, no la red.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from './api';
import { setAccessToken, limpiarTokens } from '../utils/authToken';

const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });
const ultimaPeticion = () => {
  const [url, opciones = {}] = fetch.mock.calls.at(-1);
  return { url, ...opciones };
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  limpiarTokens();
  setAccessToken('tk-admin');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('contrato A: si falla, null', () => {
  const casos = [
    ['createMueble', () => api.createMueble({ nombre: 'Silla' })],
    ['updateMueble', () => api.updateMueble('m1', { estado: 'vendido' })],
    ['deleteMueble', () => api.deleteMueble('m1')],
    ['createCategoria', () => api.createCategoria({ nombre: 'Sillas' })],
    ['updateCategoria', () => api.updateCategoria(3, { nombre: 'Sillas' })],
    ['deleteCategoria', () => api.deleteCategoria(3)],
    ['actualizarEstadoPedido', () => api.actualizarEstadoPedido('p1', 'enviado')],
  ];

  it.each(casos)('%s: si va bien, devuelve el cuerpo de la respuesta', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(200, { success: true, data: { id: 'x' } }));
    expect(await llamar()).toEqual({ success: true, data: { id: 'x' } });
  });

  it.each(casos)('%s: si el servidor responde con error, null (y el mensaje se pierde)', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(500, { error: 'Error al guardar.' }));
    expect(await llamar()).toBeNull();
  });

  it.each(casos)('%s: si falla la red, null', async (_nombre, llamar) => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await llamar()).toBeNull();
  });

  it.each(casos)('%s: va con la sesión (cabecera Authorization)', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await llamar();
    expect(ultimaPeticion().headers.Authorization).toBe('Bearer tk-admin');
  });
});

describe('contrato B: si falla, { error }', () => {
  const casos = [
    ['loginUser', () => api.loginUser('a@b.es', 'x'), 'Error al iniciar sesión'],
    ['registerUser', () => api.registerUser({ email: 'a@b.es' }), 'Error al registrar cuenta'],
    ['loginConGoogle', () => api.loginConGoogle('credencial'), 'No se pudo iniciar sesión con Google.'],
    ['updateProfile', () => api.updateProfile({ nombre: 'Ana' }), 'Error al actualizar perfil'],
    ['crearSesionPago', () => api.crearSesionPago({ items: [], clienteInfo: {} }), 'No se pudo iniciar el pago.'],
    ['confirmarSesionPago', () => api.confirmarSesionPago('cs_1'), 'No se pudo confirmar el pago.'],
    ['enviarContacto', () => api.enviarContacto({ nombre: 'Ana', email: 'a@b.es', mensaje: 'Hola' }), 'No se pudo enviar el mensaje.'],
  ];

  it.each(casos)('%s: si el servidor responde con error, devuelve su mensaje', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(400, { error: 'Mensaje del servidor' }));
    expect(await llamar()).toEqual({ error: 'Mensaje del servidor' });
  });

  it.each(casos)('%s: si el error no trae mensaje, usa el suyo por defecto', async (_nombre, llamar, porDefecto) => {
    fetch.mockResolvedValue(respuesta(500, {}));
    expect(await llamar()).toEqual({ error: porDefecto });
  });

  it.each(casos)('%s: si falla la red, devuelve el mensaje técnico del navegador (H12: sale en inglés)', async (_nombre, llamar) => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await llamar()).toEqual({ error: 'Failed to fetch' });
  });

  it('si va bien, devuelve el cuerpo (menos enviarContacto, que devuelve { success: true })', async () => {
    fetch.mockResolvedValue(respuesta(200, { token: 't', refreshToken: 'r', user: { id: 1 } }));
    expect(await api.loginUser('a@b.es', 'x')).toEqual({ token: 't', refreshToken: 'r', user: { id: 1 } });

    fetch.mockResolvedValue(respuesta(200, { enviado: true, id: 'no-se-devuelve' }));
    expect(await api.enviarContacto({ nombre: 'Ana', email: 'a@b.es', mensaje: 'Hola' })).toEqual({ success: true });
  });
});

describe('contrato C: si falla, []', () => {
  const casos = [
    ['getMuebles', () => api.getMuebles()],
    ['getCategorias', () => api.getCategorias()],
    ['buscarMuebles', () => api.buscarMuebles('silla')],
    ['getMisPedidos', () => api.getMisPedidos()],
    ['getPedidos', () => api.getPedidos()],
  ];

  it.each(casos)('%s: si va bien, devuelve la lista', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(200, [{ id: 1 }]));
    expect(await llamar()).toEqual([{ id: 1 }]);
  });

  it.each(casos)('%s: si el servidor responde con error, [] (igual que "no hay datos")', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(500, { error: 'x' }));
    expect(await llamar()).toEqual([]);
  });

  it.each(casos)('%s: si falla la red, []', async (_nombre, llamar) => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await llamar()).toEqual([]);
  });
});

describe('getMuebleById: null tanto si no existe como si falla', () => {
  it('si existe, devuelve la pieza', async () => {
    fetch.mockResolvedValue(respuesta(200, { id: 'm1', nombre: 'Silla' }));
    expect(await api.getMuebleById('m1')).toEqual({ id: 'm1', nombre: 'Silla' });
    expect(ultimaPeticion().url).toMatch(/\/muebles\/m1$/);
  });

  it('404: null, sin anotar un error (es normal que una pieza ya no exista)', async () => {
    fetch.mockResolvedValue(respuesta(404, { error: 'Mueble no encontrado.' }));
    expect(await api.getMuebleById('m1')).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('500 o fallo de red: también null, y se anota el error', async () => {
    fetch.mockResolvedValue(respuesta(500, {}));
    expect(await api.getMuebleById('m1')).toBeNull();
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await api.getMuebleById('m1')).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

describe('qué se pide a cada ruta', () => {
  beforeEach(() => fetch.mockResolvedValue(respuesta(200, {})));

  it('crear o editar un mueble con fotos manda el FormData tal cual, sin Content-Type (lo pone el navegador con el boundary)', async () => {
    const datos = new FormData();
    datos.append('nombre', 'Silla');

    await api.createMueble(datos);
    expect(ultimaPeticion()).toMatchObject({ method: 'POST', body: datos, headers: { Authorization: 'Bearer tk-admin' } });
    expect(ultimaPeticion().headers['Content-Type']).toBeUndefined();

    await api.updateMueble('m1', datos);
    expect(ultimaPeticion().url).toMatch(/\/muebles\/m1$/);
    expect(ultimaPeticion()).toMatchObject({ method: 'PUT', body: datos });
  });

  it('crear o editar sin fotos (un objeto) manda JSON', async () => {
    await api.updateMueble('m1', { estado: 'vendido' });
    expect(ultimaPeticion()).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ estado: 'vendido' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tk-admin' },
    });

    await api.createCategoria({ nombre: 'Sillas' });
    expect(ultimaPeticion().url).toMatch(/\/categorias$/);
    expect(ultimaPeticion()).toMatchObject({ method: 'POST', body: JSON.stringify({ nombre: 'Sillas' }) });

    await api.updateCategoria(3, new FormData());
    expect(ultimaPeticion().url).toMatch(/\/categorias\/3$/);
    expect(ultimaPeticion().method).toBe('PUT');
    expect(ultimaPeticion().headers['Content-Type']).toBeUndefined();
  });

  it('los borrados son DELETE a la ruta de cada uno', async () => {
    await api.deleteMueble('m1');
    expect(ultimaPeticion()).toMatchObject({ method: 'DELETE' });
    expect(ultimaPeticion().url).toMatch(/\/muebles\/m1$/);

    await api.deleteCategoria(3);
    expect(ultimaPeticion()).toMatchObject({ method: 'DELETE' });
    expect(ultimaPeticion().url).toMatch(/\/categorias\/3$/);
  });

  it('cambiar el estado de un pedido es un PATCH con { estado }', async () => {
    await api.actualizarEstadoPedido('p1', 'enviado');
    expect(ultimaPeticion().url).toMatch(/\/pedidos\/p1\/estado$/);
    expect(ultimaPeticion()).toMatchObject({ method: 'PATCH', body: JSON.stringify({ estado: 'enviado' }) });
  });

  it('los pedidos del cliente y los del panel van con la sesión', async () => {
    await api.getMisPedidos();
    expect(ultimaPeticion().url).toMatch(/\/pedidos\/mios$/);
    expect(ultimaPeticion().headers.Authorization).toBe('Bearer tk-admin');

    await api.getPedidos();
    expect(ultimaPeticion().url).toMatch(/\/pedidos$/);
    expect(ultimaPeticion().headers.Authorization).toBe('Bearer tk-admin');
  });

  it('login, registro y Google NO llevan la sesión (un 401 de contraseña incorrecta no debe renovar nada)', async () => {
    await api.loginUser('a@b.es', 'secreta');
    expect(ultimaPeticion().url).toMatch(/\/auth\/login$/);
    expect(ultimaPeticion()).toMatchObject({ method: 'POST', body: JSON.stringify({ email: 'a@b.es', password: 'secreta' }) });
    expect(ultimaPeticion().headers.Authorization).toBeUndefined();

    await api.registerUser({ nombre: 'Ana', email: 'a@b.es', password: 'x' });
    expect(ultimaPeticion().url).toMatch(/\/auth\/register$/);
    expect(ultimaPeticion().headers.Authorization).toBeUndefined();

    await api.loginConGoogle('credencial-de-google');
    expect(ultimaPeticion().url).toMatch(/\/auth\/google$/);
    expect(ultimaPeticion().body).toBe(JSON.stringify({ credential: 'credencial-de-google' }));
    expect(ultimaPeticion().headers.Authorization).toBeUndefined();
  });

  it('actualizar el perfil sí lleva la sesión', async () => {
    await api.updateProfile({ nombre: 'Ana' });
    expect(ultimaPeticion().url).toMatch(/\/auth\/perfil-update$/);
    expect(ultimaPeticion()).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ nombre: 'Ana' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tk-admin' },
    });
  });

  it('el pago manda las piezas y los datos del comprador, sin sesión (se puede comprar como invitado)', async () => {
    await api.crearSesionPago({ items: [{ productId: 'm1' }], clienteInfo: { email: 'a@b.es' } });
    expect(ultimaPeticion().url).toMatch(/\/muebles\/crear-sesion-pago$/);
    expect(ultimaPeticion()).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: 'm1' }], clienteInfo: { email: 'a@b.es' } }),
    });
    expect(ultimaPeticion().headers.Authorization).toBeUndefined();
  });

  it('el id de la sesión de pago y la búsqueda van codificados en la URL', async () => {
    await api.confirmarSesionPago('cs_test&x=1');
    expect(ultimaPeticion().url).toMatch(/\/muebles\/confirmar-sesion\?session_id=cs_test%26x%3D1$/);

    fetch.mockResolvedValue(respuesta(200, []));
    await api.buscarMuebles('mesa & silla');
    expect(ultimaPeticion().url).toMatch(/\/muebles\/buscar\?q=mesa%20%26%20silla$/);
  });

  it('el contacto manda también el campo trampa "web" (honeypot)', async () => {
    await api.enviarContacto({ nombre: 'Ana', email: 'a@b.es', mensaje: 'Hola', web: '' });
    expect(ultimaPeticion().url).toMatch(/\/contacto$/);
    expect(JSON.parse(ultimaPeticion().body)).toEqual({ nombre: 'Ana', email: 'a@b.es', mensaje: 'Hola', web: '' });
  });
});
