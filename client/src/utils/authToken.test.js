import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  actualizarRefreshEnMemoria,
  cargarRefreshGuardado,
  tokenParaCabecera,
  limpiarTokens
} from './authToken';

beforeEach(() => {
  localStorage.clear();
  limpiarTokens();
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
