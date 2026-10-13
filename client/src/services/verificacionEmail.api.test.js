import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verificarEmail,
  reenviarVerificacion,
  getMisPedidos,
  apiFetch,
  alRenovarUsuarioAvisar
} from './api';
import { setAccessToken, setRefreshToken, limpiarTokens } from '../utils/authToken';

// H18: las llamadas de la verificación del email, el 403 de "Mis pedidos" sin verificar y la cuenta
// que trae la renovación de la sesión.
const API = 'http://localhost:5000/api';
const respuesta = (status, cuerpo = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo
});
const instalarFetch = (...respuestas) => {
  const cola = [...respuestas];
  const falso = vi.fn(async () => cola.shift() ?? respuesta(200, {}));
  vi.stubGlobal('fetch', falso);
  return falso;
};

beforeEach(() => {
  localStorage.clear();
  limpiarTokens();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  alRenovarUsuarioAvisar(null);
});

describe('verificarEmail', () => {
  it('manda el token sin sesión y devuelve la respuesta del servidor', async () => {
    setAccessToken('access-1');
    const cuerpo = { success: true, motivo: 'registro', user: { email_verificado: true } };
    const falso = instalarFetch(respuesta(200, cuerpo));

    const res = await verificarEmail('tok-1');

    expect(res).toEqual(cuerpo);
    const [url, init] = falso.mock.calls[0];
    expect(url).toBe(`${API}/auth/verificar-email`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ token: 'tok-1' });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('si el enlace no vale, devuelve { error } con el mensaje del servidor', async () => {
    instalarFetch(respuesta(400, { error: 'El enlace no es válido o ha caducado.' }));
    expect(await verificarEmail('x')).toEqual({ error: 'El enlace no es válido o ha caducado.' });
  });

  it('sin mensaje del servidor, uno por defecto; y un fallo de red también es { error }', async () => {
    instalarFetch(respuesta(500, {}));
    expect(await verificarEmail('x')).toEqual({ error: 'El enlace no es válido o ha caducado.' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red caída')));
    expect(await verificarEmail('x')).toEqual({ error: 'red caída' });
  });
});

describe('reenviarVerificacion', () => {
  it('va con sesión y devuelve la respuesta', async () => {
    setAccessToken('access-1');
    const falso = instalarFetch(respuesta(200, { success: true }));

    expect(await reenviarVerificacion()).toEqual({ success: true });
    const [url, init] = falso.mock.calls[0];
    expect(url).toBe(`${API}/auth/reenviar-verificacion`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer access-1');
  });

  it('si el servidor lo rechaza (p. ej. el límite), devuelve { error } con su mensaje', async () => {
    instalarFetch(respuesta(429, { error: 'Ya te hemos enviado varios correos.' }));
    expect(await reenviarVerificacion()).toEqual({ error: 'Ya te hemos enviado varios correos.' });

    instalarFetch(respuesta(500, {}));
    expect(await reenviarVerificacion()).toEqual({ error: 'No se ha podido enviar el correo.' });
  });
});

describe('getMisPedidos — cuenta sin verificar', () => {
  it('con el 403 de email sin verificar devuelve { sinVerificar: true }', async () => {
    instalarFetch(respuesta(403, { error: 'Confirma tu email.', codigo: 'email_no_verificado' }));
    expect(await getMisPedidos()).toEqual({ sinVerificar: true });
  });

  it('otro 403, o uno sin cuerpo JSON, sigue el contrato de siempre: lista vacía', async () => {
    instalarFetch(respuesta(403, { error: 'Otra cosa' }));
    expect(await getMisPedidos()).toEqual([]);

    instalarFetch({ ok: false, status: 403, json: async () => { throw new Error('no es JSON'); } });
    expect(await getMisPedidos()).toEqual([]);
  });
});

describe('renovación de la sesión — la cuenta que trae', () => {
  it('avisa a quien se haya apuntado con el usuario de la respuesta', async () => {
    setAccessToken('access-1');
    setRefreshToken('refresh-1');
    const aviso = vi.fn();
    alRenovarUsuarioAvisar(aviso);
    const user = { nombre: 'Ana', email: 'ana@correo.es', email_verificado: true };
    instalarFetch(
      respuesta(401),
      respuesta(200, { accessToken: 'access-2', refreshToken: 'refresh-2', user }),
      respuesta(200, [])
    );

    await apiFetch(`${API}/pedidos/mios`);

    expect(aviso).toHaveBeenCalledWith(user);
  });

  it('una respuesta sin `user` (un servidor de antes) no avisa de nada', async () => {
    setAccessToken('access-1');
    setRefreshToken('refresh-1');
    const aviso = vi.fn();
    alRenovarUsuarioAvisar(aviso);
    instalarFetch(
      respuesta(401),
      respuesta(200, { accessToken: 'access-2', refreshToken: 'refresh-2' }),
      respuesta(200, [])
    );

    await apiFetch(`${API}/pedidos/mios`);

    expect(aviso).not.toHaveBeenCalled();
  });
});
