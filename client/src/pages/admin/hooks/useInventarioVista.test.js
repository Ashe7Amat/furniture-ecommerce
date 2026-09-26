import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useInventarioVista, { PAGE_SIZE } from './useInventarioVista';

const pieza = (i, extra = {}) => ({ id: `p${i}`, nombre: `Pieza ${String(i).padStart(2, '0')}`, estado: 'disponible', categoria: 'Sillas', precio_venta: i, ...extra });
const muchas = (n) => Array.from({ length: n }, (_, i) => pieza(i + 1));
const nombres = (lista) => lista.map(m => m.nombre);

describe('useInventarioVista', () => {
  it('sin filtros enseña todo, en el orden de entrada, de 20 en 20', () => {
    const { result } = renderHook(() => useInventarioVista(muchas(25)));

    expect(PAGE_SIZE).toBe(20);
    expect(result.current.muebleFiltrados).toHaveLength(25);
    expect(result.current.muebleVisibles).toHaveLength(20);
    expect(result.current.totalPaginas).toBe(2);
    expect(result.current.paginaSegura).toBe(1);
  });

  it('búsqueda sin mayúsculas ni espacios de los lados, filtros por categoría y por estado (sin estado = disponible)', () => {
    const muebles = [
      pieza(1, { nombre: 'Silla Tolix' }),
      pieza(2, { nombre: 'Mesa', categoria: 'Mesas', estado: 'vendido' }),
      pieza(3, { nombre: 'Lámpara', estado: null })
    ];
    const { result } = renderHook(() => useInventarioVista(muebles));

    act(() => result.current.setBusqueda('  SILLA '));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Silla Tolix']);

    act(() => result.current.setBusqueda(''));
    act(() => result.current.setFiltroCategoria('Mesas'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Mesa']);

    act(() => result.current.setFiltroCategoria(''));
    act(() => result.current.setFiltroEstado('disponible'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Silla Tolix', 'Lámpara']);
  });

  it('ordena por nombre y por precio de venta (sin precio = 0)', () => {
    const muebles = [pieza(1, { nombre: 'B', precio_venta: 50 }), pieza(2, { nombre: 'A', precio_venta: null }), pieza(3, { nombre: 'C', precio_venta: 10 })];
    const { result } = renderHook(() => useInventarioVista(muebles));

    act(() => result.current.setOrden('nombre'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['A', 'B', 'C']);
    act(() => result.current.setOrden('precio_asc'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['A', 'C', 'B']);
    act(() => result.current.setOrden('precio_desc'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['B', 'C', 'A']);
  });

  it('cambiar un filtro vuelve a la página 1, y la página se ajusta si deja de existir', () => {
    const { result, rerender } = renderHook(({ muebles }) => useInventarioVista(muebles), { initialProps: { muebles: muchas(45) } });

    act(() => result.current.setPagina(3));
    expect(result.current.paginaSegura).toBe(3);
    act(() => result.current.setFiltroEstado('disponible'));
    expect(result.current.paginaSegura).toBe(1);

    act(() => result.current.setPagina(3));
    rerender({ muebles: muchas(21) });
    expect(result.current.totalPaginas).toBe(2);
    expect(result.current.paginaSegura).toBe(2);
  });

  it('seleccionar la página marca solo las visibles; un segundo clic las desmarca; la selección se suma entre páginas', () => {
    const { result } = renderHook(() => useInventarioVista(muchas(25)));

    act(() => result.current.toggleSeleccionado('p21'));
    act(() => result.current.toggleSeleccionarPagina());
    expect(result.current.seleccionados).toHaveLength(21);
    expect(result.current.todosVisiblesSeleccionados).toBe(true);

    act(() => result.current.toggleSeleccionarPagina());
    expect(result.current.seleccionados).toEqual(['p21']);
  });

  it('limpiarFiltros deja búsqueda, filtros y orden como al principio', () => {
    const { result } = renderHook(() => useInventarioVista(muchas(3)));
    act(() => {
      result.current.setBusqueda('x');
      result.current.setFiltroCategoria('Mesas');
      result.current.setFiltroEstado('vendido');
      result.current.setOrden('nombre');
    });

    act(() => result.current.limpiarFiltros());

    expect(result.current.busqueda).toBe('');
    expect(result.current.filtroCategoria).toBe('');
    expect(result.current.filtroEstado).toBe('');
    expect(result.current.orden).toBe('recientes');
  });
});
