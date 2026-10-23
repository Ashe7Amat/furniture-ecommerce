import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogView, STORAGE_KEY } from './useCatalogView';

describe('useCatalogView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('usa "grid-normal" por defecto si no hay nada guardado', () => {
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe('grid-normal');
  });

  it.each([
    ['grid-large', 'grid-large'],
    ['grid-normal', 'grid-normal'],
    ['grid-compact', 'grid-compact'],
    ['table', 'table']
  ])('recuerda la vista "%s" guardada en localStorage al montar', (guardada, esperada) => {
    localStorage.setItem(STORAGE_KEY, guardada);
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe(esperada);
  });

  it('normaliza el valor antiguo "grid" a "grid-normal" por compatibilidad', () => {
    localStorage.setItem(STORAGE_KEY, 'grid');
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe('grid-normal');
  });

  it('ignora un valor guardado inválido y usa "grid-normal"', () => {
    localStorage.setItem(STORAGE_KEY, 'algo-invalido');
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe('grid-normal');
  });

  it('persiste en localStorage al cambiar a cualquiera de las 4 vistas', () => {
    const { result } = renderHook(() => useCatalogView());

    act(() => {
      result.current[1]('grid-large');
    });
    expect(result.current[0]).toBe('grid-large');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('grid-large');

    act(() => {
      result.current[1]('grid-compact');
    });
    expect(result.current[0]).toBe('grid-compact');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('grid-compact');

    act(() => {
      result.current[1]('table');
    });
    expect(result.current[0]).toBe('table');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('table');

    act(() => {
      result.current[1]('grid-normal');
    });
    expect(result.current[0]).toBe('grid-normal');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('grid-normal');
  });
});
