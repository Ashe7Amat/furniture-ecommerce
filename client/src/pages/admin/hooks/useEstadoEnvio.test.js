import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEstadoEnvio from './useEstadoEnvio';

describe('useEstadoEnvio (H14: un estado de envío por formulario)', () => {
  it('empieza sin enviar y sin mensaje', () => {
    const { result } = renderHook(() => useEstadoEnvio());

    expect(result.current.enviando).toBe(false);
    expect(result.current.mensaje).toBe('');
  });

  it('mientras envía, enviando es true y muestra el mensaje de progreso', () => {
    const { result } = renderHook(() => useEstadoEnvio());

    act(() => result.current.empezar('Guardando...'));

    expect(result.current.enviando).toBe(true);
    expect(result.current.mensaje).toBe('Guardando...');
  });

  it('si acaba bien, deja de enviar y borra el mensaje', () => {
    const { result } = renderHook(() => useEstadoEnvio());
    act(() => result.current.empezar('Guardando...'));

    act(() => result.current.acabarBien());

    expect(result.current.enviando).toBe(false);
    expect(result.current.mensaje).toBe('');
  });

  it('si acaba mal, deja de enviar y muestra el error', () => {
    const { result } = renderHook(() => useEstadoEnvio());
    act(() => result.current.empezar('Guardando...'));

    act(() => result.current.acabarMal('Error al guardar.'));

    expect(result.current.enviando).toBe(false);
    expect(result.current.mensaje).toBe('Error al guardar.');
  });

  it('cada formulario tiene el suyo: dos usos no se pisan', () => {
    const uno = renderHook(() => useEstadoEnvio());
    const otro = renderHook(() => useEstadoEnvio());

    act(() => uno.result.current.acabarMal('Error en uno'));

    expect(otro.result.current.mensaje).toBe('');
  });
});
