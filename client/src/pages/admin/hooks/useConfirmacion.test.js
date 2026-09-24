import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useConfirmacion from './useConfirmacion';

describe('useConfirmacion', () => {
  it('empieza cerrado', () => {
    const { result } = renderHook(() => useConfirmacion());
    expect(result.current.confirmConfig.isOpen).toBe(false);
  });

  it('confirmarBorrado lo abre con su título y mensaje; confirmar ejecuta la acción y después lo cierra', async () => {
    const accion = vi.fn(async () => {});
    const { result } = renderHook(() => useConfirmacion());

    act(() => result.current.confirmarBorrado('Eliminar', '¿Seguro?', accion));
    expect(result.current.confirmConfig).toMatchObject({ isOpen: true, title: 'Eliminar', message: '¿Seguro?' });
    expect(accion).not.toHaveBeenCalled();

    await act(() => result.current.confirmConfig.onConfirm());
    expect(accion).toHaveBeenCalledTimes(1);
    expect(result.current.confirmConfig.isOpen).toBe(false);
  });

  it('cerrarConfirmacion lo cierra sin ejecutar la acción', () => {
    const accion = vi.fn();
    const { result } = renderHook(() => useConfirmacion());

    act(() => result.current.confirmarBorrado('Eliminar', '¿Seguro?', accion));
    act(() => result.current.cerrarConfirmacion());

    expect(result.current.confirmConfig.isOpen).toBe(false);
    expect(accion).not.toHaveBeenCalled();
  });
});
