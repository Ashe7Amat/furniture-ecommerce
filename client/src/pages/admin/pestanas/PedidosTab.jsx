import { useContext, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { actualizarEstadoPedido } from '../../../services/api';
import { formatPrice } from '../../../utils/format';
import { reservasActivas } from '../../../utils/reservas';
import AlbaranPedido from '../AlbaranPedido';

const ESTADOS_PEDIDO = ['procesando', 'enviado', 'entregado', 'cancelado'];
const ETIQUETA_ESTADO_PEDIDO = { procesando: 'Procesando', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };

// Pestaña "Pedidos". La lista y el filtro viven en el contenedor: el filtro se conserva al cambiar
// de pestaña. H37: la lista es una página (20 pedidos) que el servidor ya ha filtrado por estado;
// `infoPedidos` trae el total de ese filtro y la página. El filtro se aplica también aquí para que
// un pedido que cambia a otro estado salga de la lista al momento, sin recargar.
const PedidosTab = ({ pedidos, setPedidos, infoPedidos, ajustarTrasCambioDeEstado, filtroEstadoPedido, setFiltroEstadoPedido, cargarPedidos, muebles = [] }) => {
  const { showToast } = useContext(ToastContext);
  const [pedidoAlbaran, setPedidoAlbaran] = useState(null);
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
        <h2 className="admin-title-h2">Pedidos</h2>
        <p>{pedidosFiltrados.length} de {infoPedidos.total} pedidos</p>
      </div>

      <div className="admin-toolbar pedidos-toolbar">
        <div className="pedidos-toolbar-filtros">
          <select
            className="n5-input pedidos-filtro-select admin-select"
            aria-label="Filtrar pedidos por estado"
            value={filtroEstadoPedido}
            onChange={(e) => setFiltroEstadoPedido(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_PEDIDO.map(estado => (
              <option key={estado} value={estado}>{ETIQUETA_ESTADO_PEDIDO[estado]}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="admin-btn-ghost pedidos-btn-actualizar"
          onClick={cargarPedidos}
          title="Actualizar listado de pedidos"
        >
          <svg
            className="pedidos-btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Actualizar
        </button>
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
            const esAlquiler = reservasActivas() && (items.some(item => item.modalidad === 'alquiler') || pedido.tipo === 'alquiler' || Boolean(pedido.reserva_id));
            const fecha = pedido.created_at
              ? new Date(pedido.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
              : '—';

            return (
              <div key={pedido.id} className={`pedido-card ${esAlquiler ? 'pedido-card--alquiler' : ''}`}>
                <div className="pedido-card-header">
                  <div className="pedido-cabecera-meta">
                    <span className="pedido-fecha">{fecha}</span>
                    <span className="pedido-id">Ref. {pedido.id.slice(0, 8).toUpperCase()}</span>
                    {esAlquiler && <span className="pedido-badge-alquiler">ALQUILER</span>}
                  </div>
                  <div className="pedido-card-acciones">
                    <button
                      type="button"
                      className="admin-btn-ghost pedido-btn-albaran"
                      onClick={() => setPedidoAlbaran(pedido)}
                    >
                      <svg
                        className="pedido-btn-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Imprimir albarán
                    </button>
                    {esAlquiler ? (
                      <div className="pedido-alquiler-control" title="Este pedido corresponde a un alquiler. Gestiónalo desde la pestaña Reservas.">
                        <select
                          value={pedido.estado}
                          disabled
                          className="pedido-estado-select pedido-estado-select--deshabilitado admin-select"
                          aria-label="Estado del pedido"
                        >
                          <option value={pedido.estado}>{ETIQUETA_ESTADO_PEDIDO[pedido.estado] || pedido.estado}</option>
                        </select>
                        <span className="pedido-alquiler-aviso">
                          Este pedido corresponde a un alquiler. Gestiónalo desde la pestaña Reservas.
                        </span>
                      </div>
                    ) : (
                      <select
                        value={pedido.estado}
                        onChange={(e) => handleCambiarEstadoPedido(pedido.id, e.target.value)}
                        className={`pedido-estado-select estado-${pedido.estado} admin-select`}
                      >
                        {ESTADOS_PEDIDO.map(estado => (
                          <option key={estado} value={estado}>{ETIQUETA_ESTADO_PEDIDO[estado]}</option>
                        ))}
                      </select>
                    )}
                  </div>
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
          <button className="admin-btn-secondary" onClick={() => cargarPedidos({ pagina: infoPedidos.pagina - 1 })} disabled={infoPedidos.pagina <= 1}>← Anterior</button>
          <span>Página {infoPedidos.pagina} de {infoPedidos.totalPaginas}</span>
          <button className="admin-btn-secondary" onClick={() => cargarPedidos({ pagina: infoPedidos.pagina + 1 })} disabled={infoPedidos.pagina >= infoPedidos.totalPaginas}>Siguiente →</button>
        </div>
      )}

      {pedidoAlbaran && (
        <AlbaranPedido
          pedido={pedidoAlbaran}
          muebles={muebles}
          onCerrar={() => setPedidoAlbaran(null)}
        />
      )}
    </div>
  );
};

export default PedidosTab;
