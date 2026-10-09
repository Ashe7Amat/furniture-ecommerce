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

  it('la búsqueda también encuentra por referencia (A5), sin mayúsculas; una pieza sin referencia no falla', () => {
    const muebles = [
      pieza(1, { nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' }),
      pieza(2, { nombre: 'Mesa', referencia: 'NAV-MES-012' }),
      pieza(3, { nombre: 'Lámpara', referencia: null })
    ];
    const { result } = renderHook(() => useInventarioVista(muebles));

    act(() => result.current.setBusqueda(' nav-mes '));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Mesa']);

    act(() => result.current.setBusqueda('NAV-'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Silla Tolix', 'Mesa']);

    act(() => result.current.setBusqueda('lámpara'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Lámpara']);
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

  it('ordena por referencia en los dos sentidos: orden natural y las piezas sin referencia al final, sin reordenarse entre ellas', () => {
    const muebles = [
      pieza(1, { nombre: 'Sin ref A', referencia: null }),
      pieza(2, { nombre: 'Silla 10', referencia: 'NAV-SIL-010' }),
      pieza(3, { nombre: 'Mesa 1', referencia: 'NAV-MES-001' }),
      pieza(4, { nombre: 'Sin ref B', referencia: '' }),
      pieza(5, { nombre: 'Silla 2', referencia: 'NAV-SIL-2' }),
      pieza(6, { nombre: 'Sin ref C' })
    ];
    const { result } = renderHook(() => useInventarioVista(muebles));

    act(() => result.current.setOrden('referencia_asc'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Mesa 1', 'Silla 2', 'Silla 10', 'Sin ref A', 'Sin ref B', 'Sin ref C']);

    act(() => result.current.setOrden('referencia_desc'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Silla 10', 'Silla 2', 'Mesa 1', 'Sin ref A', 'Sin ref B', 'Sin ref C']);

    // No toca la lista que recibe: volver a "recientes" la enseña en el orden de la API.
    act(() => result.current.setOrden('recientes'));
    expect(nombres(result.current.muebleFiltrados)).toEqual(['Sin ref A', 'Silla 10', 'Mesa 1', 'Sin ref B', 'Silla 2', 'Sin ref C']);
  });

  it('el orden por referencia se aplica a todo el inventario antes de paginar, y vuelve a la página 1', () => {
    // Pieza 01 lleva la referencia más alta (NAV-SIL-025) y Pieza 25 la más baja (NAV-SIL-001).
    const muebles = muchas(25).map((m, i) => ({ ...m, referencia: `NAV-SIL-${String(25 - i).padStart(3, '0')}` }));
    const { result } = renderHook(() => useInventarioVista(muebles));

    act(() => result.current.setPagina(2));
    act(() => result.current.setOrden('referencia_asc'));

    expect(result.current.paginaSegura).toBe(1);
    expect(result.current.muebleVisibles[0].nombre).toBe('Pieza 25');
    expect(result.current.muebleVisibles[19].nombre).toBe('Pieza 06');
  });

  it('la búsqueda y los filtros se combinan con el orden por referencia', () => {
    const muebles = [
      pieza(1, { nombre: 'Silla B', referencia: 'NAV-SIL-002' }),
      pieza(2, { nombre: 'Mesa', categoria: 'Mesas', referencia: 'NAV-MES-001' }),
      pieza(3, { nombre: 'Silla A', referencia: 'NAV-SIL-001' })
    ];
    const { result } = renderHook(() => useInventarioVista(muebles));

    act(() => {
      result.current.setFiltroCategoria('Sillas');
      result.current.setOrden('referencia_desc');
    });

    expect(nombres(result.current.muebleFiltrados)).toEqual(['Silla B', 'Silla A']);
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

  it('"recientes" es el orden por defecto, y limpiarFiltros también lo devuelve ahí desde un orden por referencia', () => {
    const { result } = renderHook(() => useInventarioVista(muchas(3)));
    expect(result.current.orden).toBe('recientes');

    act(() => result.current.setOrden('referencia_desc'));
    expect(result.current.orden).toBe('referencia_desc');

    act(() => result.current.limpiarFiltros());
    expect(result.current.orden).toBe('recientes');
  });
});
