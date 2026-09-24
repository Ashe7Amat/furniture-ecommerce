// Mutantes de la pestaña Resumen (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.resumen.test.jsx';

export const MUTANTES = [
  {
    // Mutante de control del script (ver COMPROBACIONES PREVIAS en mutantes-panel.js): sencillo y
    // con dos tests que lo matan. Si sobrevive, el que falla es el script, no los tests.
    nombre: 'una pieza sin estado deja de contar como disponible',
    buscar: "m.estado === 'disponible' || !m.estado",
    reemplazo: "m.estado === 'disponible'",
    control: true
  },
  {
    nombre: 'la alerta de categoría mira categoria_id en vez del nombre',
    buscar: 'muebles.filter(m => !m.categoria).length',
    reemplazo: 'muebles.filter(m => !m.categoria_id).length'
  },
  {
    nombre: 'la alerta de fotos ignora imagenes a null',
    buscar: 'muebles.filter(m => !m.imagenes || m.imagenes.length === 0)',
    reemplazo: 'muebles.filter(m => m.imagenes?.length === 0)'
  },
  {
    nombre: 'el valor en stock suma sin Number() (concatena los precios en texto)',
    buscar: 'acc + (Number(m.precio_venta) || 0)',
    reemplazo: 'acc + (m.precio_venta || 0)'
  },
  {
    nombre: 'pedidos por procesar cuenta también otros estados',
    buscar: "pedidos.filter(p => p.estado === 'procesando').length",
    reemplazo: "pedidos.filter(p => p.estado !== 'entregado').length"
  },
  {
    nombre: 'desaparece la insignia de pedidos de la barra lateral',
    buscar: '{pedidosPendientes > 0 && <span className="sidebar-badge">{pedidosPendientes}</span>}',
    reemplazo: ''
  },
  {
    nombre: '"Ver inventario" lleva a otra pestaña',
    buscar: "<button onClick={() => setVistaActiva('inventario')}>Ver inventario</button>",
    reemplazo: "<button onClick={() => setVistaActiva('crear')}>Ver inventario</button>"
  },
  {
    nombre: 'el precio de alquiler sale del campo equivocado',
    buscar: 'formatPrice(m.precio_alquiler_dia)} €/día',
    reemplazo: 'formatPrice(m.precio_alquiler)} €/día'
  },
  {
    nombre: 'sin imagen genérica cuando la pieza no tiene fotos',
    buscar: 'm.imagenes?.[0] || PLACEHOLDER_IMG',
    reemplazo: 'm.imagenes?.[0]'
  },
  {
    nombre: 'el panel pide el catálogo con caché (vería una lista vieja tras guardar)',
    buscar: 'getMuebles({ fresco: true })',
    reemplazo: 'getMuebles()'
  },
  {
    nombre: 'el panel pide las categorías con caché',
    buscar: 'getCategorias({ fresco: true })',
    reemplazo: 'getCategorias()'
  },
  {
    nombre: 'carga los datos sin comprobar que hay usuario',
    buscar: '    if (user) {\n      cargarCategorias();',
    reemplazo: '    {\n      cargarCategorias();'
  }
];
