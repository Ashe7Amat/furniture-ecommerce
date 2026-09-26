// Mutantes de la pestaña "Pedidos" (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.pedidos.test.jsx';

export const MUTANTES = [
  {
    nombre: 'la referencia no sale en mayúsculas',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: 'Ref. {pedido.id.slice(0, 8).toUpperCase()}',
    reemplazo: 'Ref. {pedido.id.slice(0, 8)}'
  },
  {
    nombre: 'el filtro de estado no filtra',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: 'const pedidosFiltrados = filtroEstadoPedido ? pedidos.filter(p => p.estado === filtroEstadoPedido) : pedidos;',
    reemplazo: 'const pedidosFiltrados = pedidos;'
  },
  {
    nombre: 'el recuento de la cabecera no tiene en cuenta el filtro',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: '<p>{pedidosFiltrados.length} de {pedidos.length} pedidos</p>',
    reemplazo: '<p>{pedidos.length} de {pedidos.length} pedidos</p>'
  },
  {
    nombre: 'si getPedidos no devuelve una lista, se guarda tal cual',
    archivo: 'src/pages/admin/hooks/useAdminDatos.js',
    buscar: 'setPedidos(Array.isArray(data) ? data : []);',
    reemplazo: 'setPedidos(data);'
  },
  {
    nombre: 'con un filtro vacío dice "todavía no hay pedidos"',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: '{pedidos.length === 0\n',
    reemplazo: '{pedidosFiltrados.length === 0\n'
  },
  {
    nombre: 'el orden de los estados cambia',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: "const ESTADOS_PEDIDO = ['procesando', 'enviado', 'entregado', 'cancelado'];",
    reemplazo: "const ESTADOS_PEDIDO = ['procesando', 'entregado', 'enviado', 'cancelado'];"
  },
  {
    nombre: '"Actualizar" no recarga',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: 'onClick={cargarPedidos}>Actualizar</button>',
    reemplazo: 'onClick={() => {}}>Actualizar</button>'
  },
  {
    nombre: 'tras cambiar el estado no se actualiza en pantalla',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: '      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: nuevoEstado } : p)));\n',
    reemplazo: ''
  },
  {
    nombre: 'tras cambiar el estado se recargan todos los pedidos',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: '      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: nuevoEstado } : p)));\n',
    reemplazo: '      cargarPedidos();\n'
  },
  {
    nombre: 'si falla el cambio de estado, se cambia igualmente en pantalla',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: "showToast('Error al actualizar el estado del pedido', 'error');",
    reemplazo: "showToast('Error al actualizar el estado del pedido', 'error'); setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: nuevoEstado } : p)));"
  },
  {
    nombre: 'sin cliente_info se rompe',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: 'const cliente = pedido.cliente_info || {};',
    reemplazo: 'const cliente = pedido.cliente_info;'
  },
  {
    nombre: 'items que no son una lista rompen la tarjeta',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: 'const items = Array.isArray(pedido.items) ? pedido.items : [];',
    reemplazo: 'const items = pedido.items || [];'
  },
  {
    nombre: 'sin fecha no enseña la raya',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: "      : '—';",
    reemplazo: "      : '';"
  },
  {
    nombre: 'la dirección de cliente_info tiene prioridad sobre la del pedido',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: "{pedido.direccion_envio || cliente.direccion || 'Sin dirección de envío'}",
    reemplazo: "{cliente.direccion || pedido.direccion_envio || 'Sin dirección de envío'}"
  },
  {
    nombre: 'las notas "Ninguna" se enseñan',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: "{cliente.notas && cliente.notas !== 'Ninguna' && (",
    reemplazo: '{cliente.notas && ('
  },
  {
    nombre: 'el email no es un enlace mailto',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: 'href={`mailto:${cliente.email}`}',
    reemplazo: 'href={cliente.email}'
  },
  {
    nombre: 'los alquileres no llevan "(alquiler/día)"',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: "{item.modalidad === 'alquiler' ? ' (alquiler/día)' : ''}",
    reemplazo: "{''}"
  },
  {
    nombre: 'sin cantidad no se asume 1',
    archivo: 'src/pages/admin/pestanas/PedidosTab.jsx',
    buscar: '{item.cantidad || 1} x',
    reemplazo: '{item.cantidad} x'
  }
];
