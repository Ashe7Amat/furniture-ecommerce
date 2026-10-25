import { lazy, Suspense, useContext, useEffect, useState } from 'react';
import Icon from '../Icon';
import { ToastContext } from '../../../context/ToastContext';
import { exportarClientesCsv, getMetricasDashboard } from '../../../services/api';
import { formatPrice } from '../../../utils/format';
import { descargarArchivo } from '../../../utils/descargarArchivo';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import { formatearImporte } from '../dashboard';

// Recharts pesa bastante: los gráficos se bajan aparte, solo al entrar en el Resumen.
const GraficosDashboard = lazy(() => import('../GraficosDashboard'));

// Pestaña "Resumen": contadores del catálogo, avisos de piezas sin fotos o sin categoría, el
// bloque "Avisos / Últimas Ventas" (que sale del `estado` de los muebles, no de los pedidos) y
// la exportación de las cuentas de clientes a CSV (el panel no tiene pestaña de clientes).
// Las métricas (ticket medio, gráficos) vienen de GET /api/admin/dashboard/metricas.
const ResumenTab = ({ muebles, pedidosPendientes, irA }) => {
  const { showToast } = useContext(ToastContext);
  const [exportandoClientes, setExportandoClientes] = useState(false);
  // 'cargando' | 'listo' | 'error'. Sin métricas, las tarjetas nuevas enseñan "—" y no se inventa nada.
  const [metricas, setMetricas] = useState(null);
  const [estadoMetricas, setEstadoMetricas] = useState('cargando');
  const [intento, setIntento] = useState(0);
  const totalMuebles = muebles.length;
  const disponibles = muebles.filter(m => m.estado === 'disponible' || !m.estado);
  const vendidos = muebles.filter(m => m.estado === 'vendido').length;
  const alquilados = muebles.filter(m => m.estado === 'alquilado').length;
  const valorDisponible = disponibles.reduce((acc, m) => acc + (Number(m.precio_venta) || 0), 0);
  const sinImagen = muebles.filter(m => !m.imagenes || m.imagenes.length === 0).length;
  const sinCategoria = muebles.filter(m => !m.categoria).length;

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      const datos = await getMetricasDashboard();
      if (!activo) return;
      setMetricas(datos || null);
      setEstadoMetricas(datos ? 'listo' : 'error');
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [intento]);

  const reintentarMetricas = () => {
    setEstadoMetricas('cargando');
    setIntento(n => n + 1);
  };

  const handleExportarClientes = async () => {
    setExportandoClientes(true);
    const resultado = await exportarClientesCsv();
    setExportandoClientes(false);
    if (!resultado) {
      showToast('No se pudieron exportar los clientes', 'error');
      return;
    }
    descargarArchivo(resultado.blob, resultado.nombreArchivo);
    showToast('Clientes exportados', 'success');
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <span className="admin-eyebrow">Vista General</span>
        <h2 className="admin-title-h1">Dashboard</h2>
      </div>
      <div className="resumen-cards admin-kpi-grid">
        <div className="resumen-card admin-kpi-card accent-brand">
          <h3 className="kpi-value">{totalMuebles}</h3>
          <p className="kpi-label">Total Catálogo</p>
        </div>
        <div
          className="resumen-card admin-kpi-card accent-success resumen-card-clickable"
          role="button"
          tabIndex={0}
          onClick={() => irA('inventario')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && irA('inventario')}
          aria-label="Ver piezas disponibles en inventario"
        >
          <h3 className="kpi-value">{disponibles.length}</h3>
          <p className="kpi-label">Disponibles</p>
        </div>
        <div className="resumen-card admin-kpi-card accent-danger">
          <h3 className="kpi-value">{vendidos}</h3>
          <p className="kpi-label">Vendidos</p>
        </div>
        <div className="resumen-card admin-kpi-card accent-warning">
          <h3 className="kpi-value">{alquilados}</h3>
          <p className="kpi-label">Alquilados</p>
        </div>
        <div className="resumen-card admin-kpi-card">
          <h3 className="kpi-value">{formatPrice(valorDisponible)} €</h3>
          <p className="kpi-label">Valor en stock</p>
        </div>
        <div
          className={`resumen-card admin-kpi-card ${pedidosPendientes > 0 ? 'accent-warning semaforo-alerta' : 'accent-success semaforo-ok'} resumen-card-clickable`}
          role="button"
          tabIndex={0}
          onClick={() => irA('pedidos', 'procesando')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && irA('pedidos', 'procesando')}
          aria-label="Ver pedidos pendientes de procesar"
        >
          <h3 className="kpi-value">{pedidosPendientes}</h3>
          <p className="kpi-label">Pedidos por procesar</p>
        </div>
        <div className="resumen-card admin-kpi-card accent-brand">
          <h3 className="kpi-value">{metricas ? formatearImporte(metricas.ticketMedio) : '—'}</h3>
          <p className="kpi-label">Ticket Medio</p>
        </div>
        <div className="resumen-card admin-kpi-card">
          <h3 className="kpi-value">{metricas ? formatearImporte(metricas.ingresosAlquiler) : '—'}</h3>
          <p className="kpi-label">Ingresos Alquiler/mes</p>
        </div>
        <div
          className="resumen-card admin-kpi-card resumen-card-clickable"
          role="button"
          tabIndex={0}
          onClick={handleExportarClientes}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleExportarClientes()}
          aria-label="Exportar clientes en CSV"
        >
          <h3 className="kpi-value">{metricas?.clientes ? metricas.clientes.nuevosEsteMes + metricas.clientes.recurrentes : '—'}</h3>
          <p className="kpi-label">Clientes</p>
          {metricas?.clientes && (
            <span className="resumen-card-subtexto kpi-subtext">
              {metricas.clientes.nuevosEsteMes} nuevos este mes · {metricas.clientes.recurrentes} recurrentes
            </span>
          )}
        </div>
      </div>

      {estadoMetricas === 'error' && (
        <div className="admin-alerts">
          <div className="admin-alert" role="alert">
            <Icon name="warning" />
            No se pudieron cargar las métricas de ventas.
            <button onClick={reintentarMetricas}>Reintentar</button>
          </div>
        </div>
      )}

      {metricas && (
        <Suspense fallback={<p className="admin-empty-note">Cargando gráficos…</p>}>
          <GraficosDashboard
            ventasPorMes={metricas.ventasPorMes}
            topCategorias={metricas.topCategorias}
          />
        </Suspense>
      )}

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
                    <img
                      src={m.imagenes?.[0] || PLACEHOLDER_IMG}
                      alt={m.nombre}
                      width="40"
                      height="40"
                      className="sale-thumb-img"
                      loading="lazy"
                      decoding="async"
                    />
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

      <section className="resumen-clientes" aria-labelledby="resumen-clientes-titulo">
        <h3 id="resumen-clientes-titulo" className="admin-section-title"><Icon name="mail" /> Clientes</h3>
        <p>Las cuentas registradas en la tienda, en un CSV para Excel: email, nombre, rol y fecha de alta. Nunca la contraseña.</p>
        {metricas?.clientes && (
          <p className="resumen-clientes-subtexto">
            {metricas.clientes.nuevosEsteMes} nuevos este mes · {metricas.clientes.recurrentes} recurrentes
          </p>
        )}
        <button className="admin-btn-ghost" onClick={handleExportarClientes} disabled={exportandoClientes}>
          {exportandoClientes ? 'Exportando…' : 'Exportar clientes (CSV)'}
        </button>
      </section>
    </div>
  );
};

export default ResumenTab;
