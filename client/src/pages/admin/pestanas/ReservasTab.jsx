import { useContext, useEffect, useState, useCallback } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { getReservasAdmin, entregarReservaAdmin, recogerReservaAdmin } from '../../../services/api';
import { formatPrice } from '../../../utils/format';

const ETIQUETAS_ESTADO = {
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  devuelta: 'Devuelta',
  cancelada: 'Cancelada',
  expirada: 'Expirada'
};

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return '—';
  const partes = fechaStr.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaStr;
};

const ReservasTab = ({ alCambiar }) => {
  const { showToast } = useContext(ToastContext);
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getReservasAdmin({ vista: 'todas' });
      const lista = res?.data?.reservas || res?.reservas || (Array.isArray(res?.data) ? res.data : []);
      setReservas(Array.isArray(lista) ? lista : []);
    } catch (err) {
      console.error('Error al cargar reservas:', err);
      showToast('Error al cargar las reservas', 'error');
    } finally {
      setCargando(false);
    }
  }, [showToast]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const handleMarcarEntregada = async (id) => {
    setProcesandoId(id);
    try {
      const res = await entregarReservaAdmin(id);
      if (res?.error) {
        showToast(res.error, 'error');
      } else {
        showToast('Reserva marcada como entregada. Mueble actualizado a alquilado.', 'success');
        setReservas(prev => prev.map(r => (r.id === id ? { ...r, estado: 'en_curso' } : r)));
        if (typeof alCambiar === 'function') alCambiar();
      }
    } catch (err) {
      console.error('Error al marcar entregada:', err);
      showToast('No se pudo marcar como entregada', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleMarcarRecogida = async (id) => {
    setProcesandoId(id);
    try {
      const res = await recogerReservaAdmin(id);
      if (res?.error) {
        showToast(res.error, 'error');
      } else {
        showToast('Reserva marcada como recogida. Mueble disponible.', 'success');
        setReservas(prev => prev.map(r => (r.id === id ? { ...r, estado: 'devuelta' } : r)));
        if (typeof alCambiar === 'function') alCambiar();
      }
    } catch (err) {
      console.error('Error al marcar recogida:', err);
      showToast('No se pudo marcar como recogida', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <h2>Gestión de Reservas</h2>
        <p>{reservas.length} {reservas.length === 1 ? 'reserva registrada' : 'reservas registradas'}</p>
      </div>

      <div className="admin-toolbar">
        <button
          type="button"
          className="admin-btn-ghost"
          onClick={cargarReservas}
          disabled={cargando}
        >
          {cargando ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {cargando && reservas.length === 0 ? (
        <p className="admin-empty-note">Cargando reservas…</p>
      ) : reservas.length === 0 ? (
        <p className="admin-empty-note">Todavía no se ha registrado ninguna reserva.</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table reservas-table">
            <thead>
              <tr>
                <th>Mueble</th>
                <th>Cliente</th>
                <th>Fechas (Inicio - Fin)</th>
                <th>Estado</th>
                <th>Total</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((reserva) => {
                const pieza = reserva.pieza || reserva.mueble || {};
                const contacto = reserva.contacto || reserva.datos_contacto || {};
                const nombreMueble = pieza.nombre || 'Pieza de alquiler';
                const refMueble = pieza.referencia || null;
                const nombreCliente = contacto.nombre || reserva.cliente?.nombre || 'Cliente';
                const emailCliente = contacto.email || reserva.cliente?.email || '';
                const telefonoCliente = contacto.telefono || '';
                const fechasTexto = `${formatearFecha(reserva.fecha_inicio)} - ${formatearFecha(reserva.fecha_fin)}`;
                const totalTexto = `${formatPrice(reserva.importe_total ?? 0)} €`;
                const estado = reserva.estado;
                const enProceso = procesandoId === reserva.id;

                return (
                  <tr key={reserva.id}>
                    <td>
                      <div className="reserva-celda-mueble">
                        <strong className="reserva-mueble-nombre">{nombreMueble}</strong>
                        {refMueble && <span className="reserva-mueble-ref">Ref. {refMueble}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="reserva-celda-cliente">
                        <strong>{nombreCliente}</strong>
                        {emailCliente && <span className="reserva-cliente-email">{emailCliente}</span>}
                        {telefonoCliente && <span className="reserva-cliente-tel">{telefonoCliente}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="reserva-fechas-rango">{fechasTexto}</span>
                    </td>
                    <td>
                      <span className={`reserva-estado-badge estado-${estado}`}>
                        {ETIQUETAS_ESTADO[estado] || estado}
                      </span>
                    </td>
                    <td>
                      <strong>{totalTexto}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {estado === 'confirmada' ? (
                        <button
                          type="button"
                          className="admin-btn-primary admin-btn-sm"
                          onClick={() => handleMarcarEntregada(reserva.id)}
                          disabled={enProceso}
                        >
                          {enProceso ? 'Guardando…' : 'Marcar Entregada'}
                        </button>
                      ) : estado === 'en_curso' ? (
                        <button
                          type="button"
                          className="admin-btn-secondary admin-btn-sm"
                          onClick={() => handleMarcarRecogida(reserva.id)}
                          disabled={enProceso}
                        >
                          {enProceso ? 'Guardando…' : 'Marcar Recogida'}
                        </button>
                      ) : estado === 'devuelta' ? (
                        <button
                          type="button"
                          className="admin-btn-ghost admin-btn-sm"
                          disabled
                        >
                          Finalizada
                        </button>
                      ) : (
                        <span className="admin-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReservasTab;
