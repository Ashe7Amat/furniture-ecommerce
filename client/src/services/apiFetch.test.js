import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, getPedidos, loginUser } from './api';
import {
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
  limpiarTokens,
  alCerrarSesionAvisar
} from '../utils/authToken';

// apiFetch (docs/tarea3-diseno.md, sección 2): access token en memoria, renovación en un 401,
// una sola repetición por petición y una sola renovación a la vez.
const URL_PEDIDOS = 'http://localhost:5000/api/pedidos';
const respuesta = (status, cuerpo = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo
});
const PAR_NUEVO = { accessToken: 'access-2', refreshToken: 'refresh-2' };
const esRenovacion = (url) => String(url).endsWith('/auth/refresh');

// fetch falso: las renovaciones las responde `renovacion`; el resto, `respuestas` en orden.
const instalarFetch = ({ respuestas = [], renovacion = async () => respuesta(200, PAR_NUEVO) } = {}) => {
  const cola = [...respuestas];
  const falso = vi.fn(async (url, init) =>
    esRenovacion(url) ? renovacion(init) : cola.shift() ?? respuesta(200, [])
  );
  vi.stubGlobal('fetch', falso);
  return falso;
};
const renovaciones = (falso) => falso.mock.calls.filter(([url]) => esRenovacion(url));
const peticiones = (falso) => falso.mock.calls.filter(([url]) => !esRenovacion(url));
const cabecera = ([, init]) => init?.headers?.Authorization;

let sesionCerrada;
beforeEach(() => {
  localStorage.clear();
  limpiarTokens();
  sesionCerrada = vi.fn();
  alCerrarSesionAvisar(sesionCerrada);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  alCerrarSesionAvisar(null);
});

describe('apiFetch — cabecera de sesión', () => {
  it('añade el access token que está en memoria (no en localStorage)', async () => {
    const falso = instalarFetch({ respuestas: [respuesta(200)] });
    setAccessToken('access-1');

    await apiFetch(URL_PEDIDOS, { headers: { 'Content-Type': 'application/json' } });

    expect(cabecera(falso.mock.calls[0])).toBe('Bearer access-1');
    expect(falso.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(localStorage.getItem('kaveToken')).toBeNull();
  });

  it('sin access token en memoria usa el token antiguo de 7 días (kaveToken) mientras dure', async () => {
    const falso = instalarFetch({ respuestas: [respuesta(200)] });
    localStorage.setItem('kaveToken', 'token-antiguo');

    await apiFetch(URL_PEDIDOS);

    expect(cabecera(falso.mock.calls[0])).toBe('Bearer token-antiguo');
  });
});

describe('apiFetch — renovación en un 401', () => {
  beforeEach(() => {
    setAccessToken('access-1');
    setRefreshToken('refresh-1');
  });

  it('renueva con el refresh token, guarda el par nuevo y repite la petición una vez con el token nuevo', async () => {
    const falso = instalarFetch({ respuestas: [respuesta(401), respuesta(200, ['pedido'])] });

    const res = await apiFetch(URL_PEDIDOS);

    expect(res.status).toBe(200);
    expect(JSON.parse(renovaciones(falso)[0][1].body)).toEqual({ refreshToken: 'refresh-1' });
    expect(peticiones(falso).map(cabecera)).toEqual(['Bearer access-1', 'Bearer access-2']);
    expect(getAccessToken()).toBe('access-2');
    expect(getRefreshToken()).toBe('refresh-2');
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-2');
    const guardado = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.getItem(localStorage.key(i))
    );
    expect(guardado).toEqual(['refresh-2']); // el access token no se guarda nunca
  });

  it('si la repetición también da 401, la devuelve tal cual y no renueva otra vez (no hay bucle)', async () => {
    const falso = instalarFetch({ respuestas: [respuesta(401), respuesta(401), respuesta(200)] });

    const res = await apiFetch(URL_PEDIDOS);

    expect(res.status).toBe(401);
    expect(renovaciones(falso)).toHaveLength(1);
    expect(peticiones(falso)).toHaveLength(2);
  });

  it('dos peticiones que reciben 401 a la vez comparten una sola renovación', async () => {
    const falso = instalarFetch({
      respuestas: [respuesta(401), respuesta(401), respuesta(200), respuesta(200)],
      renovacion: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return respuesta(200, PAR_NUEVO);
      }
    });

    const [a, b] = await Promise.all([apiFetch(URL_PEDIDOS), apiFetch(URL_PEDIDOS)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(renovaciones(falso)).toHaveLength(1);
    expect(peticiones(falso).slice(2).map(cabecera)).toEqual(['Bearer access-2', 'Bearer access-2']);
  });

  it('si la renovación responde 401, borra los tokens, avisa del cierre de sesión y devuelve el 401 original', async () => {
    instalarFetch({ respuestas: [respuesta(401)], renovacion: async () => respuesta(401) });

    const res = await apiFetch(URL_PEDIDOS);

    expect(res.status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem('kaveRefreshToken')).toBeNull();
    expect(sesionCerrada).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['la red falla', async () => { throw new TypeError('Failed to fetch'); }],
    ['el servidor responde 500', async () => respuesta(500)],
    ['el servidor responde 503', async () => respuesta(503)]
  ])('si %s al renovar, no se toca el refresh token ni se cierra la sesión', async (_caso, renovacion) => {
    instalarFetch({ respuestas: [respuesta(401)], renovacion });

    const res = await apiFetch(URL_PEDIDOS);

    expect(res.status).toBe(401);
    expect(getRefreshToken()).toBe('refresh-1');
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-1');
    expect(sesionCerrada).not.toHaveBeenCalled();
  });

  it('sin refresh token (una sesión antigua que ha caducado) no llama al servidor: cierra la sesión', async () => {
    limpiarTokens();
    localStorage.setItem('kaveToken', 'token-antiguo-caducado');
    const falso = instalarFetch({ respuestas: [respuesta(401)] });

    const res = await apiFetch(URL_PEDIDOS);

    expect(res.status).toBe(401);
    expect(renovaciones(falso)).toHaveLength(0);
    expect(localStorage.getItem('kaveToken')).toBeNull();
    expect(sesionCerrada).toHaveBeenCalledTimes(1);
  });
});

describe('qué peticiones pasan por apiFetch', () => {
  it('las que llevan sesión: getPedidos renueva y repite', async () => {
    setAccessToken('access-1');
    setRefreshToken('refresh-1');
    const falso = instalarFetch({ respuestas: [respuesta(401), respuesta(200, [{ id: 'p1' }])] });

    expect(await getPedidos()).toEqual([{ id: 'p1' }]);
    expect(renovaciones(falso)).toHaveLength(1);
  });

  it('las públicas no: un 401 del login (contraseña incorrecta) no intenta renovar nada', async () => {
    setRefreshToken('refresh-1');
    const falso = instalarFetch({
      respuestas: [respuesta(401, { error: 'Email o contraseña incorrectos.' })]
    });

    expect(await loginUser('ana@example.com', 'mal')).toEqual({ error: 'Email o contraseña incorrectos.' });
    expect(renovaciones(falso)).toHaveLength(0);
    expect(cabecera(falso.mock.calls[0])).toBeUndefined();
  });
});
