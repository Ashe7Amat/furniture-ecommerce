import { useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { actualizarEstadoPedido } from '../../../services/api';
import { formatPrice } from '../../../utils/format';

const ESTADOS_PEDIDO = ['procesando', 'enviado', 'entregado', 'cancelado'];
const ETIQUETA_ESTADO_PEDIDO = { procesando: 'Procesando', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };

// Pestaña "Pedidos". La lista y el filtro viven en el contenedor: el filtro se conserva al cambiar
// de pestaña. H37: la lista es una página (20 pedidos) que el servidor ya ha filtrado por estado;
// `infoPedidos` trae el total de ese filtro y la página. El filtro se aplica también aquí para que
// un pedido que cambia a otro estado salga de la lista al momento, sin recargar.
const PedidosTab = ({ pedidos, setPedidos, infoPedidos, ajustarTrasCambioDeEstado, filtroEstadoPedido, setFiltroEstadoPedido, cargarPedidos }) => {
  const { showToast } = useContext(ToastContext);
  const pedidosFiltrados = filtroEstadoPedido ? pedidos.filter(p => p.estado === filtroEstadoPedido) : pedidos;

  const handleCambiarEstadoPedido = async (id, nuevoEstado) => {
    const estadoAnterior = pedidos.find(p => p.id === id)?.estado;
    const res = await actualizarEstadoPedido(id, nuevoEstado);
    if (res) {
      showToast('Estado del pedido actualizado', 'success');
      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: nuevoEstado } : p)));
      ajustarTrasCambioDeEstado(estadoAnterior, nuevoEstado);
    } else {
      showToast('Error al actualizar el estado del pedido', 'error');
    }
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <h2>Pedidos</h2>
        <p>{pedidosFiltrados.length} de {infoPedidos.total} pedidos</p>
      </div>

      <div className="admin-toolbar">
        <select value={filtroEstadoPedido} onChange={(e) => setFiltroEstadoPedido(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_PEDIDO.map(estado => (
            <option key={estado} value={estado}>{ETIQUETA_ESTADO_PEDIDO[estado]}</option>
          ))}
        </select>
        <button className="admin-btn-ghost" onClick={cargarPedidos}>Actualizar</button>
      </div>

      {pedidosFiltrados.length === 0 ? (
        <p className="admin-empty-note">
          {!filtroEstadoPedido && infoPedidos.total === 0
            ? 'Todavía no se ha registrado ningún pedido.'
            : 'No hay pedidos que coincidan con este filtro.'}
        </p>
      ) : (
        <div className="pedidos-list">
          {pedidosFiltrados.map(pedido => {
            const cliente = pedido.cliente_info || {};
            const items = Array.isArray(pedido.items) ? pedido.items : [];
            const fecha = pedido.created_at
              ? new Date(pedido.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
              : '—';

            return (
              <div key={pedido.id} className="pedido-card">
                <div className="pedido-card-header">
                  <div>
                    <span className="pedido-fecha">{fecha}</span>
                    <span className="pedido-id">Ref. {pedido.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <select
                    value={pedido.estado}
                    onChange={(e) => handleCambiarEstadoPedido(pedido.id, e.target.value)}
                    className={`pedido-estado-select estado-${pedido.estado}`}
                  >
                    {ESTADOS_PEDIDO.map(estado => (
                      <option key={estado} value={estado}>{ETIQUETA_ESTADO_PEDIDO[estado]}</option>
                    ))}
                  </select>
                </div>

                <div className="pedido-card-body">
                  <div className="pedido-cliente">
                    <h4>Cliente</h4>
                    <p><strong>{cliente.nombre || 'Sin nombre'}</strong></p>
                    {cliente.email && <p><a href={`mailto:${cliente.email}`}>{cliente.email}</a></p>}
                    {cliente.telefono && <p><a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a></p>}
                    <p className="pedido-direccion">{pedido.direccion_envio || cliente.direccion || 'Sin dirección de envío'}</p>
                    {cliente.notas && cliente.notas !== 'Ninguna' && (
                      <p className="pedido-notas"><strong>Notas:</strong> {cliente.notas}</p>
                    )}
                  </div>

                  <div className="pedido-items">
                    <h4>Productos</h4>
                    <ul>
                      {items.map((item, idx) => (
                        <li key={idx}>
                          <span>{item.nombre}{item.modalidad === 'alquiler' ? ' (alquiler/día)' : ''}</span>
                          <span>{item.cantidad || 1} x {formatPrice(item.precio)} €</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pedido-total">Total: <strong>{formatPrice(pedido.total)} €</strong></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {infoPedidos.totalPaginas > 1 && (
        <div className="admin-pagination">
          <button onClick={() => cargarPedidos({ pagina: infoPedidos.pagina - 1 })} disabled={infoPedidos.pagina <= 1}>← Anterior</button>
          <span>Página {infoPedidos.pagina} de {infoPedidos.totalPaginas}</span>
          <button onClick={() => cargarPedidos({ pagina: infoPedidos.pagina + 1 })} disabled={infoPedidos.pagina >= infoPedidos.totalPaginas}>Siguiente →</button>
        </div>
      )}
    </div>
  );
};

export default PedidosTab;
