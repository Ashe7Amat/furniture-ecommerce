// Mutantes de la pestaña "Gestionar Inventario" (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.inventario.test.jsx';

export const MUTANTES = [
  {
    nombre: 'la búsqueda distingue mayúsculas',
    buscar: 'm.nombre?.toLowerCase().includes(term)',
    reemplazo: 'm.nombre?.includes(term)'
  },
  {
    nombre: 'la búsqueda no quita los espacios de los lados',
    buscar: 'const term = busqueda.trim().toLowerCase();',
    reemplazo: 'const term = busqueda.toLowerCase();'
  },
  {
    nombre: 'el filtro de categoría no filtra',
    buscar: 'const matchCategoria = !filtroCategoria || m.categoria === filtroCategoria;',
    reemplazo: 'const matchCategoria = true;'
  },
  {
    nombre: 'una pieza sin estado deja de contar como disponible al filtrar',
    buscar: "(m.estado || 'disponible') === filtroEstado",
    reemplazo: 'm.estado === filtroEstado'
  },
  {
    nombre: '"Nombre A-Z" ordena al revés',
    buscar: "if (orden === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '');",
    reemplazo: "if (orden === 'nombre') return (b.nombre || '').localeCompare(a.nombre || '');"
  },
  {
    nombre: '"Precio: menor a mayor" ordena al revés',
    buscar: "if (orden === 'precio_asc') return (a.precio_venta || 0) - (b.precio_venta || 0);",
    reemplazo: "if (orden === 'precio_asc') return (b.precio_venta || 0) - (a.precio_venta || 0);"
  },
  {
    nombre: '25 por página en vez de 20',
    buscar: 'const PAGE_SIZE = 20;',
    reemplazo: 'const PAGE_SIZE = 25;'
  },
  {
    nombre: 'cambiar un filtro no vuelve a la página 1',
    buscar: '    setPagina(1);\n  }, [busqueda, filtroCategoria, filtroEstado, orden]);',
    reemplazo: '  }, [busqueda, filtroCategoria, filtroEstado, orden]);'
  },
  {
    nombre: 'la página no se ajusta si deja de existir',
    buscar: 'const paginaSegura = Math.min(pagina, totalPaginas);',
    reemplazo: 'const paginaSegura = pagina;'
  },
  {
    nombre: '"Seleccionar todos" marca todas las páginas',
    buscar: 'setSeleccionados(prev => [...new Set([...prev, ...muebleVisibles.map(m => m.id)])]);',
    reemplazo: 'setSeleccionados(prev => [...new Set([...prev, ...muebleFiltrados.map(m => m.id)])]);'
  },
  {
    nombre: '"Limpiar filtros" no devuelve el orden a "Más recientes"',
    buscar: "    setOrden('recientes');\n  };",
    reemplazo: '  };'
  },
  {
    nombre: '"Limpiar filtros" no aparece si solo cambia el orden',
    buscar: "{(busqueda || filtroCategoria || filtroEstado || orden !== 'recientes') && (",
    reemplazo: '{(busqueda || filtroCategoria || filtroEstado) && ('
  },
  {
    nombre: 'el recuento de la cabecera no tiene en cuenta los filtros',
    buscar: '<p>{muebleFiltrados.length} de {totalMuebles} productos</p>',
    reemplazo: '<p>{totalMuebles} de {totalMuebles} productos</p>'
  },
  {
    nombre: 'el aviso de "Aplicar estado" siempre en plural',
    buscar: "showToast(`Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`, 'success');",
    reemplazo: "showToast(`Estado actualizado en ${cantidad} productos`, 'success');"
  },
  {
    nombre: '"Aplicar estado" no vacía la selección',
    buscar: "showToast(`Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`, 'success');\n    setSeleccionados([]);",
    reemplazo: "showToast(`Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`, 'success');"
  },
  {
    nombre: '"Eliminar seleccionados" solo borra la primera',
    buscar: 'await Promise.all(seleccionados.map(id => deleteMueble(id)));',
    reemplazo: 'await deleteMueble(seleccionados[0]);'
  },
  {
    nombre: '"Cancelar" de la barra de acciones no vacía la selección',
    buscar: 'onClick={() => setSeleccionados([])}>Cancelar</button>',
    reemplazo: 'onClick={() => {}}>Cancelar</button>'
  },
  {
    nombre: 'si falla el estado en la fila, recarga igualmente',
    buscar: "showToast('Error al cambiar estado', 'error');",
    reemplazo: "showToast('Error al cambiar estado', 'error'); cargarMuebles();"
  },
  {
    // No vale "|| ''": es un mutante equivalente. Si el valor de un <select> controlado no es de
    // ninguna opción, React marca la primera, que es justo "Disponible", y en pantalla no cambia nada.
    nombre: 'el selector de estado de la fila enseña otro estado en una pieza sin estado',
    buscar: "value={m.estado || 'disponible'}",
    reemplazo: "value={m.estado || 'vendido'}"
  },
  {
    nombre: 'el precio de la fila con un espacio antes del €',
    buscar: '`${formatPrice(m.precio_venta)}€`',
    reemplazo: '`${formatPrice(m.precio_venta)} €`'
  },
  {
    nombre: 'una pieza sin categoría no enseña la raya',
    buscar: "{m.categoria || '—'}",
    reemplazo: '{m.categoria}'
  },
  {
    nombre: 'otro texto en el aviso de borrado de la fila',
    buscar: "showToast('Mueble eliminado con éxito', 'success');",
    reemplazo: "showToast('Mueble eliminado', 'success');"
  },
  {
    nombre: '"Editar" no abre el modal',
    buscar: 'onClick={() => setMuebleAEditar(m)} className="inv-edit-btn"',
    reemplazo: 'onClick={() => {}} className="inv-edit-btn"'
  }
];
