import Icon from '../Icon';
import { formatPrice } from '../../../utils/format';
import { PLACEHOLDER_IMG } from '../../../utils/images';

// Pestaña "Resumen": contadores del catálogo, avisos de piezas sin fotos o sin categoría y el
// bloque "Avisos / Últimas Ventas" (que sale del `estado` de los muebles, no de los pedidos).
const ResumenTab = ({ muebles, pedidosPendientes, irA }) => {
  const totalMuebles = muebles.length;
  const disponibles = muebles.filter(m => m.estado === 'disponible' || !m.estado);
  const vendidos = muebles.filter(m => m.estado === 'vendido').length;
  const alquilados = muebles.filter(m => m.estado === 'alquilado').length;
  const valorDisponible = disponibles.reduce((acc, m) => acc + (Number(m.precio_venta) || 0), 0);
  const sinImagen = muebles.filter(m => !m.imagenes || m.imagenes.length === 0).length;
  const sinCategoria = muebles.filter(m => !m.categoria).length;

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <h2>Dashboard</h2>
      </div>
      <div className="resumen-cards">
        <div className="resumen-card accent-brand">
          <h3>{totalMuebles}</h3>
          <p>Total Catálogo</p>
        </div>
        <div className="resumen-card accent-success">
          <h3>{disponibles.length}</h3>
          <p>Disponibles</p>
        </div>
        <div className="resumen-card accent-danger">
          <h3>{vendidos}</h3>
          <p>Vendidos</p>
        </div>
        <div className="resumen-card accent-warning">
          <h3>{alquilados}</h3>
          <p>Alquilados</p>
        </div>
        <div className="resumen-card">
          <h3>{formatPrice(valorDisponible)} €</h3>
          <p>Valor en stock</p>
        </div>
        <div className="resumen-card accent-warning">
          <h3>{pedidosPendientes}</h3>
          <p>Pedidos por procesar</p>
        </div>
      </div>

      {(sinImagen > 0 || sinCategoria > 0) && (
        <div className="admin-alerts">
          {sinImagen > 0 && (
            <div className="admin-alert">
              <Icon name="warning" />
              {sinImagen} producto{sinImagen === 1 ? '' : 's'} sin ninguna foto cargada
              <button onClick={() => irA('inventario')}>Ver inventario</button>
            </div>
          )}
          {sinCategoria > 0 && (
            <div className="admin-alert">
              <Icon name="warning" />
              {sinCategoria} producto{sinCategoria === 1 ? '' : 's'} sin categoría asignada
              <button onClick={() => irA('inventario')}>Ver inventario</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '40px' }}>
        <h3 className="admin-section-title"><Icon name="bell" /> Avisos / Últimas Ventas</h3>
        {muebles.filter(m => m.estado === 'vendido' || m.estado === 'alquilado').length === 0 ? (
          <p className="admin-empty-note">No se han registrado transacciones aún.</p>
        ) : (
          <div className="sales-list">
            {muebles.filter(m => m.estado === 'vendido' || m.estado === 'alquilado').map(m => (
              <div key={m.id} className="sale-row">
                <div className="sale-row-info">
                  <div className="sale-thumb">
                    <img src={m.imagenes?.[0] || PLACEHOLDER_IMG} alt={m.nombre} loading="lazy" decoding="async" />
                  </div>
                  <div>
                    <h4 className="sale-name">{m.nombre}</h4>
                    <span className="sale-cat">{m.categoria}</span>
                  </div>
                </div>
                <div className="sale-row-meta">
                  <span className={`status-pill ${m.estado}`}>{m.estado}</span>
                  <p className="sale-price">
                    {m.precio_venta ? `${formatPrice(m.precio_venta)} €` : `${formatPrice(m.precio_alquiler_dia)} €/día`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenTab;
