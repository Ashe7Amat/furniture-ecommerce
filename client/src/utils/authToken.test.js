import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  actualizarRefreshEnMemoria,
  cargarRefreshGuardado,
  tokenParaCabecera,
  limpiarTokens,
  alCerrarSesionAvisar,
  avisarCierreDeSesion
} from './authToken';

beforeEach(() => {
  localStorage.clear();
  limpiarTokens();
});
afterEach(() => {
  vi.restoreAllMocks();
  alCerrarSesionAvisar(null);
});

// Modo privado estricto (o almacenamiento bloqueado): cualquier acceso a localStorage lanza.
const sinLocalStorage = () => {
  const bloqueado = () => { throw new Error('SecurityError'); };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloqueado);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloqueado);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(bloqueado);
};

describe('authToken sin localStorage: la sesión dura lo que la pestaña, sin romper nada', () => {
  it('guardar y borrar el refresh token no lanza, y la copia en memoria sigue valiendo', () => {
    sinLocalStorage();

    expect(() => setRefreshToken('refresh-1')).not.toThrow();
    expect(getRefreshToken()).toBe('refresh-1');
    expect(() => limpiarTokens()).not.toThrow();
    expect(getRefreshToken()).toBeNull();
  });

  it('no hay token antiguo ni refresh guardado que leer', () => {
    sinLocalStorage();
    actualizarRefreshEnMemoria('en-memoria');

    expect(tokenParaCabecera()).toBeNull();
    expect(cargarRefreshGuardado()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe('aviso de cierre de sesión (de services/api.js a AuthContext)', () => {
  it('llama a la función registrada; sin ninguna registrada, no hace nada', () => {
    expect(() => avisarCierreDeSesion()).not.toThrow();

    const cerrar = vi.fn();
    alCerrarSesionAvisar(cerrar);
    avisarCierreDeSesion();

    expect(cerrar).toHaveBeenCalledTimes(1);
  });
});

describe('authToken', () => {
  it('el access token solo vive en memoria', () => {
    setAccessToken('access-1');

    expect(getAccessToken()).toBe('access-1');
    expect(localStorage.length).toBe(0);
  });

  it('el refresh token se guarda en memoria y en localStorage (lo que avisa a las demás pestañas)', () => {
    setRefreshToken('refresh-1');

    expect(getRefreshToken()).toBe('refresh-1');
    expect(localStorage.getItem('kaveRefreshToken')).toBe('refresh-1');
  });

  it('el evento storage solo actualiza la copia en memoria: localStorage ya lo escribió la otra pestaña', () => {
    localStorage.setItem('kaveRefreshToken', 'escrito-por-otra-pestana');

    actualizarRefreshEnMemoria('refresh-2');

    expect(getRefreshToken()).toBe('refresh-2');
    expect(localStorage.getItem('kaveRefreshToken')).toBe('escrito-por-otra-pestana');
  });

  it('al arrancar, la copia en memoria sale de lo guardado', () => {
    localStorage.setItem('kaveRefreshToken', 'guardado');

    expect(cargarRefreshGuardado()).toBe('guardado');
    expect(getRefreshToken()).toBe('guardado');
  });

  it('la cabecera usa el access token y, si no hay, el antiguo de 7 días', () => {
    expect(tokenParaCabecera()).toBeNull();
    localStorage.setItem('kaveToken', 'antiguo');
    expect(tokenParaCabecera()).toBe('antiguo');
    setAccessToken('access-1');
    expect(tokenParaCabecera()).toBe('access-1');
  });

  it('limpiarTokens olvida todo: memoria, refresh guardado y token antiguo', () => {
    setAccessToken('access-1');
    setRefreshToken('refresh-1');
    localStorage.setItem('kaveToken', 'antiguo');

    limpiarTokens();

    expect([getAccessToken(), getRefreshToken(), tokenParaCabecera()]).toEqual([null, null, null]);
    expect(localStorage.getItem('kaveRefreshToken')).toBeNull();
  });
});
