import { useState, useEffect, useMemo } from 'react';
import { compararPorReferencia, SENTIDO_ASC, SENTIDO_DESC } from '../../../utils/ordenarPorReferencia';

export const PAGE_SIZE = 20;

// Estado de la vista del inventario: búsqueda, filtros, orden, paginación y selección. Vive en el
// contenedor, no en la pestaña, para que se conserve al cambiar de pestaña y volver.
const useInventarioVista = (muebles) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [bulkEstado, setBulkEstado] = useState('disponible');

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroCategoria, filtroEstado, orden]);

  // Memoizado: con 157+ productos no tiene sentido recalcular esto en cada render que no
  // afecte a estos valores.
  const muebleFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const muebleCoincide = (m) => {
      // Por nombre o por referencia (A5): "nav-sil-00" encuentra NAV-SIL-001, NAV-SIL-002...
      const matchTexto = !term || m.nombre?.toLowerCase().includes(term) || m.referencia?.toLowerCase().includes(term);
      const matchCategoria = !filtroCategoria || m.categoria === filtroCategoria;
      const matchEstado = !filtroEstado || (m.estado || 'disponible') === filtroEstado;
      return matchTexto && matchCategoria && matchEstado;
    };

    return muebles.filter(muebleCoincide).sort((a, b) => {
      if (orden === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '');
      // Por referencia, con la misma función que el catálogo público: orden natural (NAV-SIL-002
      // antes que NAV-SIL-010) y las piezas sin referencia al final, en los dos sentidos.
      if (orden === 'referencia_asc') return compararPorReferencia(a, b, SENTIDO_ASC);
      if (orden === 'referencia_desc') return compararPorReferencia(a, b, SENTIDO_DESC);
      if (orden === 'precio_asc') return (a.precio_venta || 0) - (b.precio_venta || 0);
      if (orden === 'precio_desc') return (b.precio_venta || 0) - (a.precio_venta || 0);
      return 0; // 'recientes' = orden original (más nuevo primero, ya viene así de la API)
    });
  }, [muebles, busqueda, filtroCategoria, filtroEstado, orden]);

  const totalPaginas = Math.max(1, Math.ceil(muebleFiltrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const muebleVisibles = muebleFiltrados.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  const idsVisiblesSeleccionados = muebleVisibles.filter(m => seleccionados.includes(m.id));
  const todosVisiblesSeleccionados = muebleVisibles.length > 0 && idsVisiblesSeleccionados.length === muebleVisibles.length;

  const toggleSeleccionado = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSeleccionarPagina = () => {
    if (todosVisiblesSeleccionados) {
      setSeleccionados(prev => prev.filter(id => !muebleVisibles.some(m => m.id === id)));
    } else {
      setSeleccionados(prev => [...new Set([...prev, ...muebleVisibles.map(m => m.id)])]);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroCategoria('');
    setFiltroEstado('');
    setOrden('recientes');
  };

  return {
    busqueda, setBusqueda,
    filtroCategoria, setFiltroCategoria,
    filtroEstado, setFiltroEstado,
    orden, setOrden,
    setPagina,
    seleccionados, setSeleccionados,
    bulkEstado, setBulkEstado,
    muebleFiltrados, muebleVisibles,
    totalPaginas, paginaSegura,
    todosVisiblesSeleccionados,
    toggleSeleccionado, toggleSeleccionarPagina,
    limpiarFiltros
  };
};

export default useInventarioVista;
