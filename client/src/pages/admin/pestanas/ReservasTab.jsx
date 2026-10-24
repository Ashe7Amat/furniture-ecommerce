import { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import {
  getReservasAdmin,
  entregarReservaAdmin,
  recogerReservaAdmin,
  cancelarReservaAdmin,
  bloquearFechasAdmin
} from '../../../services/api';
import { formatPrice } from '../../../utils/format';
import {
  semanasDelMes,
  nombreDelMes,
  sumarMeses,
  mesDe
} from '../../../utils/reservas';
import '../../../styles/AdminReservas.css';

const ETIQUETAS_ESTADO = {
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  devuelta: 'Devuelta',
  cancelada: 'Cancelada',
  expirada: 'Expirada'
};

const DIAS_CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return '—';
  const partes = fechaStr.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaStr;
};

const hoyEnMadrid = () => {
  const hoy = new Date();
  return hoy.toISOString().slice(0, 10);
};

const ReservasTab = ({ alCambiar, recargarMuebles, muebles = [] }) => {
  const { showToast } = useContext(ToastContext);
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  // Toggle Vista: 'lista' | 'calendario'
  const [vistaModo, setVistaModo] = useState('lista');

  // Estado Modal Cancelación
  const [reservaACancelar, setReservaACancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  // Estado Modal Bloqueo de Fechas
  const [modalBloqueoAbierto, setModalBloqueoAbierto] = useState(false);
  const [bloqueoMuebleId, setBloqueoMuebleId] = useState('');
  const [bloqueoFechaInicio, setBloqueoFechaInicio] = useState('');
  const [bloqueoFechaFin, setBloqueoFechaFin] = useState('');
  const [bloqueoMotivo, setBloqueoMotivo] = useState('');
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [errorBloqueo, setErrorBloqueo] = useState(null);

  // Estado Vista Calendario
  const [mesCalendario, setMesCalendario] = useState(() => mesDe(hoyEnMadrid()));
  const [muebleCalendarioId, setMuebleCalendarioId] = useState('');

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

  // Lista de muebles para selectores (combinando prop muebles y muebles que aparecen en reservas)
  const listaMuebles = useMemo(() => {
    const mapa = new Map();
    (muebles || []).forEach((m) => {
      if (m?.id) mapa.set(m.id, { id: m.id, nombre: m.nombre, referencia: m.referencia });
    });
    reservas.forEach((r) => {
      const p = r.pieza || r.mueble;
      const mId = r.mueble_id || p?.id;
      if (mId && !mapa.has(mId)) {
        mapa.set(mId, { id: mId, nombre: p?.nombre || 'Pieza', referencia: p?.referencia || '' });
      }
    });
    return Array.from(mapa.values());
  }, [muebles, reservas]);

  // Preseleccionar mueble en el calendario si no está elegido
  useEffect(() => {
    if (!muebleCalendarioId && listaMuebles.length > 0) {
      setMuebleCalendarioId(listaMuebles[0].id);
    }
  }, [muebleCalendarioId, listaMuebles]);

  const refrescarDatosGlobales = () => {
    if (typeof recargarMuebles === 'function') {
      recargarMuebles();
    }
    if (typeof alCambiar === 'function') {
      alCambiar();
    }
  };

  const handleMarcarEntregada = async (id) => {
    setProcesandoId(id);
    try {
      const res = await entregarReservaAdmin(id);
      if (res?.error) {
        showToast(res.error, 'error');
      } else {
        showToast('Reserva marcada como entregada. Mueble actualizado a alquilado.', 'success');
        setReservas((prev) => prev.map((r) => (r.id === id ? { ...r, estado: 'en_curso' } : r)));
        refrescarDatosGlobales();
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
        setReservas((prev) => prev.map((r) => (r.id === id ? { ...r, estado: 'devuelta' } : r)));
        refrescarDatosGlobales();
      }
    } catch (err) {
      console.error('Error al marcar recogida:', err);
      showToast('No se pudo marcar como recogida', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  const abrirModalCancelar = (reserva) => {
    setReservaACancelar(reserva);
  };

  const cerrarModalCancelar = () => {
    if (cancelando) return;
    setReservaACancelar(null);
  };

  const handleConfirmarCancelar = async () => {
    if (!reservaACancelar) return;
    setCancelando(true);
    try {
      const res = await cancelarReservaAdmin(reservaACancelar.id, {
        motivo: 'Cancelada por el administrador'
      });
      if (res?.error) {
        showToast(res.error, 'error');
      } else {
        showToast('Reserva cancelada y reembolsada', 'success');
        setReservas((prev) =>
          prev.map((r) => (r.id === reservaACancelar.id ? { ...r, estado: 'cancelada' } : r))
        );
        cerrarModalCancelar();
        refrescarDatosGlobales();
        cargarReservas();
      }
    } catch (err) {
      console.error('Error al cancelar reserva:', err);
      showToast('No se pudo cancelar la reserva', 'error');
    } finally {
      setCancelando(false);
    }
  };

  const abrirModalBloqueo = () => {
    setErrorBloqueo(null);
    if (!bloqueoMuebleId && listaMuebles.length > 0) {
      setBloqueoMuebleId(listaMuebles[0].id);
    }
    const hoy = hoyEnMadrid();
    setBloqueoFechaInicio(hoy);
    setBloqueoFechaFin(hoy);
    setBloqueoMotivo('');
    setModalBloqueoAbierto(true);
  };

  const cerrarModalBloqueo = () => {
    if (guardandoBloqueo) return;
    setModalBloqueoAbierto(false);
    setErrorBloqueo(null);
  };

  const handleGuardarBloqueo = async (e) => {
    e.preventDefault();
    if (!bloqueoMuebleId || !bloqueoFechaInicio || !bloqueoFechaFin) {
      setErrorBloqueo('Por favor completa todos los campos de fechas y mueble.');
      return;
    }
    if (bloqueoFechaFin < bloqueoFechaInicio) {
      setErrorBloqueo('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    setGuardandoBloqueo(true);
    setErrorBloqueo(null);
    try {
      const payload = {
        mueble_id: bloqueoMuebleId,
        fecha_inicio: bloqueoFechaInicio,
        fecha_fin: bloqueoFechaFin,
        motivo: bloqueoMotivo.trim() || 'Bloqueo administrativo'
      };
      const res = await bloquearFechasAdmin(payload);
      if (res?.error) {
        // Manejar solape (409) o validación
        setErrorBloqueo(res.error);
        showToast(res.error, 'error');
      } else {
        showToast('Fechas bloqueadas correctamente', 'success');
        cerrarModalBloqueo();
        cargarReservas();
        refrescarDatosGlobales();
      }
    } catch (err) {
      console.error('Error al bloquear fechas:', err);
      setErrorBloqueo('Error al bloquear fechas');
      showToast('Error al bloquear fechas', 'error');
    } finally {
      setGuardandoBloqueo(false);
    }
  };

  // Reservas activas del mueble seleccionado para el calendario
  const reservasMuebleCalendario = useMemo(() => {
    if (!muebleCalendarioId) return [];
    return reservas.filter((r) => {
      const mId = r.mueble_id || r.pieza?.id || r.mueble?.id;
      return (
        mId === muebleCalendarioId &&
        r.estado !== 'cancelada' &&
        r.estado !== 'expirada'
      );
    });
  }, [reservas, muebleCalendarioId]);

  // Semanas del mes actual para la cuadrícula del calendario
  const semanas = useMemo(() => semanasDelMes(mesCalendario), [mesCalendario]);

  // Buscar si un día está ocupado en el calendario
  const obtenerOcupacionDia = (fechaStr) => {
    if (!fechaStr) return null;
    return reservasMuebleCalendario.find((r) => {
      const fin = r.fin_ocupacion || r.fecha_fin;
      return r.fecha_inicio <= fechaStr && fin >= fechaStr;
    });
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Gestión de Reservas</h2>
          <p>{reservas.length} {reservas.length === 1 ? 'reserva registrada' : 'reservas registradas'}</p>
        </div>

        {/* Toggle Lista / Calendario */}
        <div className="reservas-toggle-modo" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={`admin-btn-ghost ${vistaModo === 'lista' ? 'admin-btn-active' : ''}`}
            onClick={() => setVistaModo('lista')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: vistaModo === 'lista' ? 'bold' : 'normal',
              background: vistaModo === 'lista' ? 'var(--primary-color)' : 'transparent',
              color: vistaModo === 'lista' ? 'var(--bg-color, #fff)' : 'inherit'
            }}
          >
            📋 Vista Lista
          </button>
          <button
            type="button"
            className={`admin-btn-ghost ${vistaModo === 'calendario' ? 'admin-btn-active' : ''}`}
            onClick={() => setVistaModo('calendario')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: vistaModo === 'calendario' ? 'bold' : 'normal',
              background: vistaModo === 'calendario' ? 'var(--primary-color)' : 'transparent',
              color: vistaModo === 'calendario' ? 'var(--bg-color, #fff)' : 'inherit'
            }}
          >
            📅 Vista Calendario
          </button>
        </div>
      </div>

      <div className="admin-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="admin-btn-ghost"
            onClick={cargarReservas}
            disabled={cargando}
          >
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={abrirModalBloqueo}
          >
            🔒 Bloquear fechas
          </button>
        </div>
      </div>

      {/* VISTA LISTA */}
      {vistaModo === 'lista' && (
        <>
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
                    const nombreMueble = pieza.nombre || (reserva.tipo === 'bloqueo' ? 'Bloqueo administrativo' : 'Pieza de alquiler');
                    const refMueble = pieza.referencia || null;
                    const nombreCliente = reserva.tipo === 'bloqueo'
                      ? (reserva.motivo_cancelacion || reserva.motivo || 'Bloqueo manual')
                      : (contacto.nombre || reserva.cliente?.nombre || 'Cliente');
                    const emailCliente = contacto.email || reserva.cliente?.email || '';
                    const telefonoCliente = contacto.telefono || '';
                    const fechasTexto = `${formatearFecha(reserva.fecha_inicio)} - ${formatearFecha(reserva.fecha_fin)}`;
                    const totalTexto = reserva.tipo === 'bloqueo' ? '—' : `${formatPrice(reserva.importe_total ?? 0)} €`;
                    const estado = reserva.estado;
                    const enProceso = procesandoId === reserva.id;
                    const esCancelable = estado === 'confirmada' || estado === 'en_curso';

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
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            {estado === 'confirmada' && (
                              <button
                                type="button"
                                className="admin-btn-primary admin-btn-sm"
                                onClick={() => handleMarcarEntregada(reserva.id)}
                                disabled={enProceso}
                              >
                                {enProceso ? 'Guardando…' : 'Marcar Entregada'}
                              </button>
                            )}

                            {estado === 'en_curso' && (
                              <button
                                type="button"
                                className="admin-btn-secondary admin-btn-sm"
                                onClick={() => handleMarcarRecogida(reserva.id)}
                                disabled={enProceso}
                              >
                                {enProceso ? 'Guardando…' : 'Marcar Recogida'}
                              </button>
                            )}

                            {estado === 'devuelta' && (
                              <button
                                type="button"
                                className="admin-btn-ghost admin-btn-sm"
                                disabled
                              >
                                Finalizada
                              </button>
                            )}

                            {esCancelable && (
                              <button
                                type="button"
                                className="admin-btn-ghost admin-btn-sm"
                                onClick={() => abrirModalCancelar(reserva)}
                                title="Cancelar reserva y tramitar reembolso"
                                style={{ color: 'var(--error-color, #e53e3e)', borderColor: 'var(--error-color, #e53e3e)' }}
                              >
                                ✕ Cancelar
                              </button>
                            )}

                            {!esCancelable && estado !== 'devuelta' && (
                              <span className="admin-text-muted">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* VISTA CALENDARIO */}
      {vistaModo === 'calendario' && (
        <div className="admin-calendario-vista" style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          {/* Selector de mueble y navegación mensual */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label htmlFor="select-mueble-calendario" style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                Mueble a consultar:
              </label>
              <select
                id="select-mueble-calendario"
                className="admin-input"
                value={muebleCalendarioId}
                onChange={(e) => setMuebleCalendarioId(e.target.value)}
                style={{ minWidth: '240px' }}
              >
                {listaMuebles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.referencia ? `(${m.referencia})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                className="admin-btn-ghost admin-btn-sm"
                onClick={() => setMesCalendario(prev => sumarMeses(prev, -1))}
              >
                ◀ Mes anterior
              </button>
              <span style={{ fontWeight: 'bold', fontSize: '1.05rem', minWidth: '160px', textAlign: 'center', textTransform: 'capitalize' }}>
                {nombreDelMes(mesCalendario)}
              </span>
              <button
                type="button"
                className="admin-btn-ghost admin-btn-sm"
                onClick={() => setMesCalendario(prev => sumarMeses(prev, 1))}
              >
                Mes siguiente ▶
              </button>
            </div>
          </div>

          {/* Cuadrícula del Calendario */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {DIAS_CABECERA.map((d) => (
                    <th key={d} style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', color: 'var(--secondary-color)', fontSize: '0.85rem' }}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanas.map((semana, sIdx) => (
                  <tr key={sIdx}>
                    {semana.map((fecha, dIdx) => {
                      if (!fecha) {
                        return (
                          <td key={dIdx} style={{ height: '90px', background: 'var(--bg-muted, rgba(0,0,0,0.02))', border: '1px solid var(--border-color)' }} />
                        );
                      }
                      const ocupacion = obtenerOcupacionDia(fecha);
                      const diaNum = fecha.slice(8);
                      const esHoy = fecha === hoyEnMadrid();

                      return (
                        <td
                          key={dIdx}
                          style={{
                            height: '90px',
                            verticalAlign: 'top',
                            padding: '6px',
                            border: '1px solid var(--border-color)',
                            background: ocupacion
                              ? (ocupacion.tipo === 'bloqueo' ? 'rgba(237, 137, 54, 0.12)' : 'rgba(66, 153, 225, 0.12)')
                              : esHoy ? 'rgba(72, 187, 120, 0.08)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{
                              fontWeight: esHoy ? 'bold' : 'normal',
                              fontSize: '0.85rem',
                              color: esHoy ? 'var(--primary-color)' : 'inherit',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: esHoy ? '1px solid var(--primary-color)' : 'none'
                            }}>
                              {parseInt(diaNum, 10)}
                            </span>
                          </div>

                          {ocupacion && (
                            <div
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                background: ocupacion.tipo === 'bloqueo' ? '#ed8936' : 'var(--primary-color, #3182ce)',
                                color: '#fff',
                                fontWeight: '600',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={
                                ocupacion.tipo === 'bloqueo'
                                  ? `Bloqueo: ${ocupacion.motivo_cancelacion || ocupacion.motivo || 'Mantenimiento'}`
                                  : `Reserva: ${ocupacion.contacto?.nombre || ocupacion.cliente?.nombre || 'Cliente'} (${ocupacion.estado})`
                              }
                            >
                              {ocupacion.tipo === 'bloqueo'
                                ? `🔒 ${ocupacion.motivo_cancelacion || ocupacion.motivo || 'Bloqueado'}`
                                : `📦 ${ocupacion.contacto?.nombre || 'Alquilado'}`}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Leyenda y lista de reservas del mueble */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--primary-color, #3182ce)', borderRadius: '2px', display: 'inline-block' }} />
                Alquiler activo / Confirmado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', background: '#ed8936', borderRadius: '2px', display: 'inline-block' }} />
                Bloqueo administrativo
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)' }}>
              {reservasMuebleCalendario.length} {reservasMuebleCalendario.length === 1 ? 'evento activo para este mueble' : 'eventos activos para este mueble'}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR RESERVA */}
      {reservaACancelar && (
        <div className="admin-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="admin-modal-card" style={{
            background: 'var(--card-bg, #fff)', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--error-color, #e53e3e)' }}>
              ¿Cancelar reserva?
            </h3>
            <p style={{ marginBottom: '20px', lineHeight: 1.5, color: 'var(--text-color)' }}>
              ¿Cancelar la reserva? Se intentará reembolsar al cliente el importe total a través de Stripe.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={cerrarModalCancelar}
                disabled={cancelando}
              >
                Volver
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                onClick={handleConfirmarCancelar}
                disabled={cancelando}
                style={{ backgroundColor: 'var(--error-color, #e53e3e)', borderColor: 'var(--error-color, #e53e3e)' }}
              >
                {cancelando ? 'Cancelando y reembolsando…' : 'Cancelar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BLOQUEAR FECHAS */}
      {modalBloqueoAbierto && (
        <div className="admin-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="admin-modal-card" style={{
            background: 'var(--card-bg, #fff)', borderRadius: '12px', padding: '24px', maxWidth: '520px', width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
              🔒 Bloquear fechas manualmente
            </h3>

            {errorBloqueo && (
              <div style={{
                background: 'rgba(229, 62, 62, 0.1)', border: '1px solid var(--error-color, #e53e3e)',
                color: 'var(--error-color, #e53e3e)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.88rem'
              }}>
                {errorBloqueo}
              </div>
            )}

            <form onSubmit={handleGuardarBloqueo}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                  Mueble:
                </label>
                <select
                  className="admin-input"
                  value={bloqueoMuebleId}
                  onChange={(e) => setBloqueoMuebleId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="" disabled>Selecciona un mueble…</option>
                  {listaMuebles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} {m.referencia ? `(${m.referencia})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                    Fecha Inicio:
                  </label>
                  <input
                    type="date"
                    className="admin-input"
                    value={bloqueoFechaInicio}
                    onChange={(e) => setBloqueoFechaInicio(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                    Fecha Fin:
                  </label>
                  <input
                    type="date"
                    className="admin-input"
                    value={bloqueoFechaFin}
                    onChange={(e) => setBloqueoFechaFin(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
                  Motivo:
                </label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Ej. Exposición, Mantenimiento, Restauración"
                  value={bloqueoMotivo}
                  onChange={(e) => setBloqueoMotivo(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="admin-btn-ghost"
                  onClick={cerrarModalBloqueo}
                  disabled={guardandoBloqueo}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  disabled={guardandoBloqueo}
                >
                  {guardandoBloqueo ? 'Guardando bloqueo…' : 'Bloquear fechas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservasTab;
