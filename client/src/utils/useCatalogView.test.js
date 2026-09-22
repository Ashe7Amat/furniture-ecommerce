import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogView } from './useCatalogView';

describe('useCatalogView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('usa "grid" por defecto si no hay nada guardado', () => {
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe('grid');
  });

  it('recuerda la vista guardada en localStorage al montar', () => {
    localStorage.setItem('kaveCatalogView', 'table');
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe('table');
  });

  it('ignora un valor guardado que no sea "grid" ni "table" y usa el valor por defecto', () => {
    localStorage.setItem('kaveCatalogView', 'algo-invalido');
    const { result } = renderHook(() => useCatalogView());
    expect(result.current[0]).toBe('grid');
  });

  it('persiste en localStorage al cambiar de vista', () => {
    const { result } = renderHook(() => useCatalogView());

    act(() => {
      result.current[1]('table');
    });

    expect(result.current[0]).toBe('table');
    expect(localStorage.getItem('kaveCatalogView')).toBe('table');
  });
});
