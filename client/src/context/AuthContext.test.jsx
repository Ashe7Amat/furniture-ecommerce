import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './AuthContext';
import { renovarSesion } from '../services/api';
import { getAccessToken, getRefreshToken, limpiarTokens } from '../utils/authToken';

// AuthContext con access token en memoria y refresh en localStorage (docs/tarea3-diseno.md,
// sección 2). fetch es un doble: las renovaciones las responde `renovacion`, el cierre de sesión
// `cierre`.
const respuesta = (status, cuerpo = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo
});
const ANA = { nombre: 'Ana', email: 'ana@example.com', rol: 'cliente' };
const PAR_NUEVO = { accessToken: 'access-2', refreshToken: 'refresh-2' };

let renovacion;
let cierre;
const instalarFetch = () => {
  const falso = vi.fn(async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) return renovacion(init);
    if (String(url).endsWith('/auth/logout')) return cierre(init);
    return respuesta(200, []);
  });
  vi.stubGlobal('fetch', falso);
  return falso;
};
const llamadasA = (falso, fin) => falso.mock.calls.filter(([url]) => String(url).endsWith(fin));

let ctx;
const Sonda = () => {
  ctx = useContext(AuthContext);
  const estado = ctx.loading
    ? 'cargando'
    : ctx.reconectando
      ? 'reconectando'
      : ctx.user
        ? `sesion:${ctx.user.nombre}`
        : 'sin-sesion';
  return <p data-testid="estado">{estado}</p>;
};
const montar = () => render(<AuthProvider><Sonda /></AuthProvider>);
const estado = () => screen.getByTestId('estado').textContent;
const sesionGuardada = (refresh = 'refresh-1') => {
  localStorage.setItem('kaveUser', JSON.stringify(ANA));
  if (refresh) localStorage.setItem('kaveRefreshToken', refresh);
};

beforeEach(() => {
  localStorage.clear();
  limpiarTokens();
  renovacion = async () => respuesta(200, PAR_NUEVO);
  cierre = async () => respuesta(200, { success: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AuthContext — al cargar la aplicación', () => {
  it('sin sesión guardada, no llama al servidor y queda sin sesión', async () => {
    const falso = instalarFetch();
    montar();

    await waitFor(() => expect(estado()).toBe('sin-sesion'));
    expect(falso).not.toHaveBeenCalled();
  });

  it('con sesión guardada, sigue "cargando" hasta que la renovación termina; después el access queda en memoria', async () => {
    let terminar;
    renovacion = () => new Promise((r) => (terminar = () => r(respuesta(200, PAR_NUEVO))));
    const falso = instalarFetch();
    sesionGuardada();
    montar();

    expect(estado()).toBe('cargando');
    await waitFor(() => expect(llamadasA(falso, '/auth/refresh')).toHaveLength(1));
    expect(JSON.parse(llamadasA(falso, '/auth/refresh')[0][1].body)).toEqual({ refreshToken: 'refresh-1' });
    expect(estado()).toBe('cargando');

    await act(async () => terminar());

    expect(estado()).toBe('sesion:Ana');
    expect(getAccessToken()).toBe('access-2');
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-2');
  });

  it('si la renovación responde 401, la sesión se cierra y se borra todo', async () => {
    renovacion = async () => respuesta(401, { error: 'Sesión no válida, vuelve a iniciar sesión.' });
    instalarFetch();
    sesionGuardada();
    montar();

    await waitFor(() => expect(estado()).toBe('sin-sesion'));
    expect(localStorage.getItem('kaveUser')).toBeNull();
    expect(localStorage.getItem('kaveRefreshToken')).toBeNull();
  });

  it('si falla por la red, pasa a "reconectando" sin borrar nada, y reintentar recupera la sesión', async () => {
    renovacion = async () => {
      throw new TypeError('Failed to fetch');
    };
    instalarFetch();
    sesionGuardada();
    montar();

    await waitFor(() => expect(estado()).toBe('reconectando'));
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-1');
    expect(localStorage.getItem('kaveUser')).not.toBeNull();

    renovacion = async () => respuesta(200, PAR_NUEVO);
    await act(async () => ctx.reintentarSesion());

    expect(estado()).toBe('sesion:Ana');
    expect(getAccessToken()).toBe('access-2');
  });

  it('un 5xx cuenta como fallo de conexión, no como sesión cerrada', async () => {
    renovacion = async () => respuesta(503);
    instalarFetch();
    sesionGuardada();
    montar();

    await waitFor(() => expect(estado()).toBe('reconectando'));
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-1');
  });

  it('una sesión de antes del bloque 3b (solo kaveToken, sin refresh) no se renueva: sigue con su token', async () => {
    const falso = instalarFetch();
    sesionGuardada(null);
    localStorage.setItem('kaveToken', 'token-antiguo');
    montar();

    await waitFor(() => expect(estado()).toBe('sesion:Ana'));
    expect(falso).not.toHaveBeenCalled();
    expect(localStorage.getItem('kaveToken')).toBe('token-antiguo');
  });
});

describe('AuthContext — entre pestañas (evento storage)', () => {
  const avisar = (newValue) =>
    act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'kaveRefreshToken', newValue }));
    });

  it('si otra pestaña rota el refresh token, esta lo usa en su siguiente renovación', async () => {
    const falso = instalarFetch();
    sesionGuardada();
    montar();
    await waitFor(() => expect(estado()).toBe('sesion:Ana'));

    await avisar('refresh-de-otra-pestana');
    expect(getRefreshToken()).toBe('refresh-de-otra-pestana');

    await act(async () => renovarSesion());
    const ultima = llamadasA(falso, '/auth/refresh').at(-1);
    expect(JSON.parse(ultima[1].body)).toEqual({ refreshToken: 'refresh-de-otra-pestana' });
  });

  it('si otra pestaña cierra la sesión (borra el refresh token), aquí también se cierra', async () => {
    instalarFetch();
    sesionGuardada();
    montar();
    await waitFor(() => expect(estado()).toBe('sesion:Ana'));

    await avisar(null);

    expect(estado()).toBe('sin-sesion');
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('los cambios de otras claves no le afectan', async () => {
    instalarFetch();
    sesionGuardada();
    montar();
    await waitFor(() => expect(estado()).toBe('sesion:Ana'));

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'nave5Theme', newValue: null }));
    });

    expect(estado()).toBe('sesion:Ana');
  });
});

describe('AuthContext — login y logout', () => {
  it('login guarda el par: el access solo en memoria, el refresh en localStorage, y borra el kaveToken antiguo', async () => {
    instalarFetch();
    localStorage.setItem('kaveToken', 'token-antiguo');
    montar();
    await waitFor(() => expect(estado()).toBe('sin-sesion'));

    act(() => ctx.login(ANA, 'access-1', 'refresh-1'));

    expect(estado()).toBe('sesion:Ana');
    expect(getAccessToken()).toBe('access-1');
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-1');
    expect(localStorage.getItem('kaveToken')).toBeNull();
    expect(JSON.parse(localStorage.getItem('kaveUser'))).toEqual(ANA);
  });

  it('login sin refreshToken (undefined: el perfil cambió solo el nombre) conserva el que había; con null lo borra', async () => {
    instalarFetch();
    montar();
    await waitFor(() => expect(estado()).toBe('sin-sesion'));
    act(() => ctx.login(ANA, 'access-1', 'refresh-1'));

    act(() => ctx.login({ ...ANA, nombre: 'Ana María' }, 'access-2'));
    expect(getRefreshToken()).toBe('refresh-1');

    act(() => ctx.login(ANA, 'access-3', null));
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem('kaveRefreshToken')).toBeNull();
  });

  it('logout revoca primero en el servidor con el refresh token y después borra la sesión local', async () => {
    let enServidor;
    cierre = async (init) => {
      enServidor = { cuerpo: JSON.parse(init.body), refreshGuardado: localStorage.getItem('kaveRefreshToken') };
      return respuesta(200, { success: true });
    };
    instalarFetch();
    montar();
    await waitFor(() => expect(estado()).toBe('sin-sesion'));
    act(() => ctx.login(ANA, 'access-1', 'refresh-1'));

    await act(async () => ctx.logout());

    expect(enServidor).toEqual({ cuerpo: { refreshToken: 'refresh-1' }, refreshGuardado: 'refresh-1' });
    expect(estado()).toBe('sin-sesion');
    expect(localStorage.getItem('kaveRefreshToken')).toBeNull();
    expect(localStorage.getItem('kaveUser')).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('si el servidor no responde al cerrar sesión, la sesión local se cierra igual', async () => {
    cierre = async () => {
      throw new TypeError('Failed to fetch');
    };
    instalarFetch();
    montar();
    await waitFor(() => expect(estado()).toBe('sin-sesion'));
    act(() => ctx.login(ANA, 'access-1', 'refresh-1'));

    await act(async () => ctx.logout());

    expect(estado()).toBe('sin-sesion');
    expect(localStorage.getItem('kaveRefreshToken')).toBeNull();
  });

  it('si una petición descubre que la sesión ya no vale (renovación con 401), la sesión se cierra en pantalla', async () => {
    instalarFetch();
    montar();
    await waitFor(() => expect(estado()).toBe('sin-sesion'));
    act(() => ctx.login(ANA, 'access-1', 'refresh-1'));

    renovacion = async () => respuesta(401);
    await act(async () => renovarSesion());

    expect(estado()).toBe('sin-sesion');
    expect(localStorage.getItem('kaveUser')).toBeNull();
  });
});
