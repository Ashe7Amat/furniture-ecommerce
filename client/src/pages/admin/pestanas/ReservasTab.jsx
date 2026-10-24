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

  // Filtros Avanzados en Tabla
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroFecha, setFiltroFecha] = useState('');

  // Estado Modal Cancelación y Reembolso en céntimos
  const [reservaACancelar, setReservaACancelar] = useState(null);
  const [reembolsarTotal, setReembolsarTotal] = useState(true);
  const [importeReembolsoEuros, setImporteReembolsoEuros] = useState(0);
  const [cancelando, setCancelando] = useState(false);

  // Estado Modal Bloqueo de Fechas
  const [modalBloqueoAbierto, setModalBloqueoAbierto] = useState(false);
  const [bloqueoMuebleId, setBloqueoMuebleId] = useState('');
  const [bloqueoFechaInicio, setBloqueoFechaInicio] = useState('');
  const [bloqueoFechaFin, setBloqueoFechaFin] = useState('');
  const [bloqueoMotivo, setBloqueoMotivo] = useState('');
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [errorBloqueo, setErrorBloqueo] = useState(null);

  // Estado Vista Calendario e Inspector Lateral
  const [mesCalendario, setMesCalendario] = useState(() => mesDe(hoyEnMadrid()));
  const [muebleCalendarioId, setMuebleCalendarioId] = useState('');
  const [diaSeleccionadoInfo, setDiaSeleccionadoInfo] = useState(null);

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

  // Sincronizar el panel lateral del calendario si cambia el estado de la reserva seleccionada
  useEffect(() => {
    if (diaSeleccionadoInfo?.reserva?.id) {
      const actualizada = reservas.find((r) => r.id === diaSeleccionadoInfo.reserva.id);
      if (actualizada) {
        setDiaSeleccionadoInfo((prev) => (prev ? { ...prev, reserva: actualizada } : null));
      }
    }
  }, [reservas, diaSeleccionadoInfo?.reserva?.id]);

  // A. Métricas del Dashboard Operativo Superior (Hoy en el almacén)
  const metricasOperativas = useMemo(() => {
    const hoy = hoyEnMadrid();
    let entregasPendientesHoy = 0;
    let recogidasPendientesHoy = 0;
    let ingresosActivos = 0;

    reservas.forEach((r) => {
      const esBloqueo = r.tipo === 'bloqueo';
      if (r.estado === 'confirmada' && r.fecha_inicio === hoy && !esBloqueo) {
        entregasPendientesHoy += 1;
      }
      if (r.estado === 'en_curso' && r.fecha_fin === hoy && !esBloqueo) {
        recogidasPendientesHoy += 1;
      }
      if ((r.estado === 'confirmada' || r.estado === 'en_curso') && !esBloqueo) {
        ingresosActivos += Number(r.importe_total ?? 0);
      }
    });

    return {
      entregasPendientesHoy,
      recogidasPendientesHoy,
      ingresosActivos
    };
  }, [reservas]);

  // B. Reservas filtradas para la tabla
  const reservasFiltradas = useMemo(() => {
    const termino = busquedaTexto.trim().toLowerCase();

    return reservas.filter((reserva) => {
      if (filtroEstado !== 'todos' && reserva.estado !== filtroEstado) {
        return false;
      }

      if (filtroFecha) {
        const fin = reserva.fin_ocupacion || reserva.fecha_fin || '';
        const inicio = reserva.fecha_inicio || '';
        if (filtroFecha < inicio || filtroFecha > fin) {
          return false;
        }
      }

      if (termino) {
        const pieza = reserva.pieza || reserva.mueble || {};
        const contacto = reserva.contacto || reserva.datos_contacto || {};
        const nombreMueble = (pieza.nombre || '').toLowerCase();
        const refMueble = (pieza.referencia || '').toLowerCase();
        const nombreCliente = (
          contacto.nombre ||
          reserva.cliente?.nombre ||
          reserva.motivo ||
          reserva.motivo_cancelacion ||
          ''
        ).toLowerCase();
        const emailCliente = (contacto.email || reserva.cliente?.email || '').toLowerCase();
        const telCliente = (contacto.telefono || '').toLowerCase();

        const coincide =
          nombreMueble.includes(termino) ||
          refMueble.includes(termino) ||
          nombreCliente.includes(termino) ||
          emailCliente.includes(termino) ||
          telCliente.includes(termino);

        if (!coincide) return false;
      }

      return true;
    });
  }, [reservas, busquedaTexto, filtroEstado, filtroFecha]);

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

  // 1. Abrir modal de cancelación inicializando el importe a reembolsar por defecto al 100%
  const abrirModalCancelar = (reserva) => {
    const totalReserva = Number(reserva?.importe_total ?? 0);
    setReservaACancelar(reserva);
    setReembolsarTotal(true);
    setImporteReembolsoEuros(totalReserva);
  };

  const cerrarModalCancelar = () => {
    if (cancelando) return;
    setReservaACancelar(null);
  };

  const handleToggleReembolsoTotal = (checked) => {
    setReembolsarTotal(checked);
    if (checked && reservaACancelar) {
      setImporteReembolsoEuros(Number(reservaACancelar.importe_total ?? 0));
    }
  };

  const handleConfirmarCancelar = async () => {
    if (!reservaACancelar) return;
    setCancelando(true);
    try {
      const totalOriginal = Number(reservaACancelar.importe_total ?? 0);
      const importeElegido = reembolsarTotal ? totalOriginal : Number(importeReembolsoEuros || 0);
      const reembolsoEnCentimos = Math.max(0, Math.round(importeElegido * 100));

      const res = await cancelarReservaAdmin(reservaACancelar.id, {
        motivo: 'Cancelada por el administrador',
        reembolso_importe: reembolsoEnCentimos
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

  const abrirModalBloqueo = (fechaPreseleccionada = null, mueblePreseleccionado = null) => {
    setErrorBloqueo(null);
    const fechaBase =
      typeof fechaPreseleccionada === 'string' && fechaPreseleccionada
        ? fechaPreseleccionada
        : hoyEnMadrid();

    const muebleObjetivo =
      mueblePreseleccionado ||
      bloqueoMuebleId ||
      muebleCalendarioId ||
      (listaMuebles.length > 0 ? listaMuebles[0].id : '');

    setBloqueoMuebleId(muebleObjetivo);
    setBloqueoFechaInicio(fechaBase);
    setBloqueoFechaFin(fechaBase);
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
        String(mId) === String(muebleCalendarioId) &&
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

  // C & D. Interacción al hacer clic en un día del calendario
  const handleClickCeldaCalendario = (fecha, ocupacion) => {
    if (!fecha) return;
    if (ocupacion) {
      setDiaSeleccionadoInfo({ fecha, reserva: ocupacion });
    } else {
      setDiaSeleccionadoInfo(null);
      abrirModalBloqueo(fecha, muebleCalendarioId);
    }
  };

  const limpiarFiltros = () => {
    setBusquedaTexto('');
    setFiltroEstado('todos');
    setFiltroFecha('');
  };

  const hayFiltrosActivos =
    busquedaTexto.trim() !== '' || filtroEstado !== 'todos' || filtroFecha !== '';

  return (
    <div className="admin-view n5-reservas-wrapper fade-in">
      {/* CABECERA EDITORIAL */}
      <div className="admin-view-head n5-reservas-header">
        <div>
          <span className="n5-eyebrow">Nave 5 Barcelona · Operaciones</span>
          <h2 className="n5-title">Gestión de Reservas</h2>
          <p className="n5-subtitle">
            {reservas.length} {reservas.length === 1 ? 'reserva registrada' : 'reservas registradas'}
          </p>
        </div>

        {/* Toggle Lista / Calendario */}
        <div className="reservas-toggle-modo n5-view-switcher">
          <button
            type="button"
            className={`n5-switch-btn ${vistaModo === 'lista' ? 'is-active' : ''}`}
            onClick={() => setVistaModo('lista')}
          >
            📋 Vista Lista
          </button>
          <button
            type="button"
            className={`n5-switch-btn ${vistaModo === 'calendario' ? 'is-active' : ''}`}
            onClick={() => setVistaModo('calendario')}
          >
            📅 Vista Calendario
          </button>
        </div>
      </div>

      {/* A. DASHBOARD OPERATIVO SUPERIOR (HOY EN EL ALMACÉN) */}
      <section className="n5-kpi-section" aria-label="Hoy en el almacén">
        <div className="n5-kpi-grid">
          <article className="n5-kpi-card">
            <div className="n5-kpi-top">
              <span className="n5-kpi-label">Entregas pendientes hoy</span>
              <span className="n5-kpi-icon" aria-hidden="true">↗</span>
            </div>
            <div className="n5-kpi-value">{metricasOperativas.entregasPendientesHoy}</div>
            <p className="n5-kpi-caption">Salidas de almacén confirmadas para hoy</p>
          </article>

          <article className="n5-kpi-card">
            <div className="n5-kpi-top">
              <span className="n5-kpi-label">Recogidas pendientes hoy</span>
              <span className="n5-kpi-icon" aria-hidden="true">↙</span>
            </div>
            <div className="n5-kpi-value">{metricasOperativas.recogidasPendientesHoy}</div>
            <p className="n5-kpi-caption">Retornos previstos de alquileres en curso</p>
          </article>

          <article className="n5-kpi-card n5-kpi-card--highlight">
            <div className="n5-kpi-top">
              <span className="n5-kpi-label">Ingresos Activos</span>
              <span className="n5-kpi-icon" aria-hidden="true">€</span>
            </div>
            <div className="n5-kpi-value">{formatPrice(metricasOperativas.ingresosActivos)} €</div>
            <p className="n5-kpi-caption">Volumen total en reservas confirmadas y en curso</p>
          </article>
        </div>
      </section>

      {/* BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="admin-toolbar n5-toolbar">
        {vistaModo === 'lista' ? (
          <div className="n5-filters-bar">
            <div className="n5-search-box">
              <span className="n5-search-icon" aria-hidden="true">⌕</span>
              <input
                type="search"
                className="n5-input n5-search-input"
                placeholder="Buscar por cliente, email, pieza o referencia…"
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                aria-label="Buscar reservas"
              />
            </div>

            <select
              className="n5-input n5-filter-select"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="confirmada">Confirmada</option>
              <option value="en_curso">En curso</option>
              <option value="devuelta">Devuelta</option>
              <option value="cancelada">Cancelada</option>
              <option value="expirada">Expirada</option>
            </select>

            <input
              type="date"
              className="n5-input n5-filter-date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              aria-label="Filtrar por fecha activa"
              title="Filtrar reservas activas en esta fecha"
            />

            {hayFiltrosActivos && (
              <button
                type="button"
                className="n5-btn n5-btn-ghost n5-btn-sm"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="n5-calendar-hint">
            <span>💡 Haz clic en un día libre para bloquear fechas o en uno ocupado para gestionar la entrega.</span>
          </div>
        )}

        <div className="n5-toolbar-actions">
          <button
            type="button"
            className="n5-btn n5-btn-ghost"
            onClick={cargarReservas}
            disabled={cargando}
          >
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
          <button
            type="button"
            className="n5-btn n5-btn-secondary"
            onClick={() => abrirModalBloqueo()}
          >
            🔒 Bloquear fechas
          </button>
        </div>
      </div>

      {/* VISTA LISTA */}
      {vistaModo === 'lista' && (
        <>
          {cargando && reservas.length === 0 ? (
            <div className="n5-empty-state">
              <p className="admin-empty-note">Cargando reservas…</p>
            </div>
          ) : reservas.length === 0 ? (
            <div className="n5-empty-state">
              <p className="admin-empty-note">Todavía no se ha registrado ninguna reserva.</p>
            </div>
          ) : reservasFiltradas.length === 0 ? (
            <div className="n5-empty-state">
              <p className="admin-empty-note">No se encontraron reservas que coincidan con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="admin-table-container n5-table-card">
              <table className="admin-table reservas-table n5-luxury-table">
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
                  {reservasFiltradas.map((reserva) => {
                    const pieza = reserva.pieza || reserva.mueble || {};
                    const contacto = reserva.contacto || reserva.datos_contacto || {};
                    const nombreMueble =
                      pieza.nombre ||
                      (reserva.tipo === 'bloqueo' ? 'Bloqueo administrativo' : 'Pieza de alquiler');
                    const refMueble = pieza.referencia || null;
                    const nombreCliente =
                      reserva.tipo === 'bloqueo'
                        ? reserva.motivo_cancelacion || reserva.motivo || 'Bloqueo manual'
                        : contacto.nombre || reserva.cliente?.nombre || 'Cliente';
                    const emailCliente = contacto.email || reserva.cliente?.email || '';
                    const telefonoCliente = contacto.telefono || '';
                    const fechasTexto = `${formatearFecha(reserva.fecha_inicio)} - ${formatearFecha(reserva.fecha_fin)}`;
                    const totalTexto =
                      reserva.tipo === 'bloqueo' ? '—' : `${formatPrice(reserva.importe_total ?? 0)} €`;
                    const estado = reserva.estado;
                    const enProceso = procesandoId === reserva.id;
                    const esCancelable = estado === 'confirmada' || estado === 'en_curso';

                    return (
                      <tr key={reserva.id} className={reserva.tipo === 'bloqueo' ? 'n5-row-bloqueo' : ''}>
                        <td>
                          <div className="reserva-celda-mueble">
                            <strong className="reserva-mueble-nombre">{nombreMueble}</strong>
                            {refMueble && <span className="reserva-mueble-ref">Ref. {refMueble}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="reserva-celda-cliente">
                            <strong className="reserva-cliente-nombre">{nombreCliente}</strong>
                            {emailCliente && <span className="reserva-cliente-email">{emailCliente}</span>}
                            {telefonoCliente && <span className="reserva-cliente-tel">{telefonoCliente}</span>}
                          </div>
                        </td>
                        <td>
                          <span className="reserva-fechas-rango">{fechasTexto}</span>
                        </td>
                        <td>
                          <span className={`reserva-estado-badge estado-${estado}`}>
                            <span className="n5-badge-dot" />
                            {ETIQUETAS_ESTADO[estado] || estado}
                          </span>
                        </td>
                        <td>
                          <strong className="n5-price-cell">{totalTexto}</strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="n5-actions-group">
                            {estado === 'confirmada' && (
                              <button
                                type="button"
                                className="n5-btn n5-btn-action-deliver n5-btn-sm"
                                onClick={() => handleMarcarEntregada(reserva.id)}
                                disabled={enProceso}
                              >
                                {enProceso ? 'Guardando…' : 'Marcar Entregada'}
                              </button>
                            )}

                            {estado === 'en_curso' && (
                              <button
                                type="button"
                                className="n5-btn n5-btn-action-pickup n5-btn-sm"
                                onClick={() => handleMarcarRecogida(reserva.id)}
                                disabled={enProceso}
                              >
                                {enProceso ? 'Guardando…' : 'Marcar Recogida'}
                              </button>
                            )}

                            {estado === 'devuelta' && (
                              <button
                                type="button"
                                className="n5-btn n5-btn-finished n5-btn-sm"
                                disabled
                              >
                                Finalizada
                              </button>
                            )}

                            {esCancelable && (
                              <button
                                type="button"
                                className="n5-btn n5-btn-action-cancel n5-btn-sm"
                                onClick={() => abrirModalCancelar(reserva)}
                                title="Cancelar reserva y tramitar reembolso"
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
        <div className="admin-calendario-vista n5-calendar-card">
          {/* Selector de mueble y navegación mensual */}
          <div className="n5-calendar-header">
            <div className="n5-calendar-selector">
              <label htmlFor="select-mueble-calendario" className="n5-label-inline">
                Mueble a consultar:
              </label>
              <select
                id="select-mueble-calendario"
                aria-label="Mueble a consultar"
                className="n5-input n5-select-piece"
                value={muebleCalendarioId}
                onChange={(e) => {
                  setMuebleCalendarioId(e.target.value);
                  setDiaSeleccionadoInfo(null);
                }}
              >
                {listaMuebles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.referencia ? `(${m.referencia})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="n5-calendar-nav">
              <button
                type="button"
                className="n5-btn n5-btn-ghost n5-btn-sm"
                onClick={() => setMesCalendario((prev) => sumarMeses(prev, -1))}
              >
                ◀ Mes anterior
              </button>
              <span className="n5-calendar-month-label">{nombreDelMes(mesCalendario)}</span>
              <button
                type="button"
                className="n5-btn n5-btn-ghost n5-btn-sm"
                onClick={() => setMesCalendario((prev) => sumarMeses(prev, 1))}
              >
                Mes siguiente ▶
              </button>
            </div>
          </div>

          {/* Layout: Cuadrícula + Panel Lateral de Detalle */}
          <div className={`n5-calendar-layout ${diaSeleccionadoInfo ? 'has-inspector' : ''}`}>
            <div className="n5-calendar-grid-wrapper">
              <table className="n5-calendar-table">
                <thead>
                  <tr>
                    {DIAS_CABECERA.map((d) => (
                      <th key={d}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((semana, sIdx) => (
                    <tr key={sIdx}>
                      {semana.map((fecha, dIdx) => {
                        if (!fecha) {
                          return <td key={dIdx} className="n5-cal-cell is-empty" />;
                        }
                        const ocupacion = obtenerOcupacionDia(fecha);
                        const diaNum = parseInt(fecha.slice(8), 10);
                        const esHoy = fecha === hoyEnMadrid();
                        const esBloqueo = ocupacion?.tipo === 'bloqueo';
                        const estaSeleccionado = diaSeleccionadoInfo?.fecha === fecha;

                        const clasesCelda = [
                          'n5-cal-cell',
                          ocupacion ? (esBloqueo ? 'is-blocked' : 'is-booked') : 'is-free',
                          esHoy ? 'is-today' : '',
                          estaSeleccionado ? 'is-selected' : ''
                        ]
                          .filter(Boolean)
                          .join(' ');

                        return (
                          <td
                            key={dIdx}
                            className={clasesCelda}
                            onClick={() => handleClickCeldaCalendario(fecha, ocupacion)}
                            title={
                              ocupacion
                                ? esBloqueo
                                  ? `Bloqueo: ${ocupacion.motivo_cancelacion || ocupacion.motivo || 'Mantenimiento'}`
                                  : `Reserva: ${ocupacion.contacto?.nombre || ocupacion.cliente?.nombre || 'Cliente'} (${ocupacion.estado}) — Clic para ver detalles`
                                : `Día disponible (${formatearFecha(fecha)}) — Clic para bloquear fecha`
                            }
                          >
                            <div className="n5-cal-cell-inner">
                              <div className="n5-cal-day-top">
                                <span className="n5-cal-day-number">{diaNum}</span>
                                {!ocupacion && <span className="n5-cal-add-hint">+ Bloquear</span>}
                              </div>

                              {ocupacion && (
                                <div className="n5-cal-pill">
                                  {esBloqueo
                                    ? `🔒 ${ocupacion.motivo_cancelacion || ocupacion.motivo || 'Bloqueado'}`
                                    : `📦 ${ocupacion.contacto?.nombre || ocupacion.cliente?.nombre || 'Alquilado'}`}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* C. PANEL LATERAL DE DETALLE EN EL CALENDARIO */}
            {diaSeleccionadoInfo && diaSeleccionadoInfo.reserva && (
              <aside className="n5-calendar-inspector" aria-label="Detalle de reserva seleccionada">
                <div className="n5-inspector-head">
                  <div>
                    <span className="n5-eyebrow">Fecha seleccionada · {formatearFecha(diaSeleccionadoInfo.fecha)}</span>
                    <h4 className="n5-inspector-title">
                      {diaSeleccionadoInfo.reserva.tipo === 'bloqueo'
                        ? 'Bloqueo de Almacén'
                        : 'Detalle de la Reserva'}
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="n5-inspector-close"
                    onClick={() => setDiaSeleccionadoInfo(null)}
                    aria-label="Cerrar panel de detalle"
                  >
                    ✕
                  </button>
                </div>

                <div className="n5-inspector-body">
                  <div className="n5-inspector-row">
                    <span className="n5-inspector-label">Cliente / Concepto</span>
                    <strong className="n5-inspector-value">
                      {diaSeleccionadoInfo.reserva.tipo === 'bloqueo'
                        ? diaSeleccionadoInfo.reserva.motivo_cancelacion ||
                          diaSeleccionadoInfo.reserva.motivo ||
                          'Bloqueo administrativo'
                        : diaSeleccionadoInfo.reserva.contacto?.nombre ||
                          diaSeleccionadoInfo.reserva.cliente?.nombre ||
                          'Cliente'}
                    </strong>
                  </div>

                  {diaSeleccionadoInfo.reserva.tipo !== 'bloqueo' && (
                    <div className="n5-inspector-row">
                      <span className="n5-inspector-label">Email de contacto</span>
                      <span className="n5-inspector-value">
                        {diaSeleccionadoInfo.reserva.contacto?.email ||
                          diaSeleccionadoInfo.reserva.cliente?.email ||
                          'No especificado'}
                      </span>
                    </div>
                  )}

                  <div className="n5-inspector-row">
                    <span className="n5-inspector-label">Periodo reservado</span>
                    <span className="n5-inspector-value">
                      {formatearFecha(diaSeleccionadoInfo.reserva.fecha_inicio)} —{' '}
                      {formatearFecha(diaSeleccionadoInfo.reserva.fecha_fin)}
                    </span>
                  </div>

                  <div className="n5-inspector-row">
                    <span className="n5-inspector-label">Estado actual</span>
                    <div>
                      <span className={`reserva-estado-badge estado-${diaSeleccionadoInfo.reserva.estado}`}>
                        <span className="n5-badge-dot" />
                        {ETIQUETAS_ESTADO[diaSeleccionadoInfo.reserva.estado] ||
                          diaSeleccionadoInfo.reserva.estado}
                      </span>
                    </div>
                  </div>

                  {diaSeleccionadoInfo.reserva.tipo !== 'bloqueo' && (
                    <div className="n5-inspector-row">
                      <span className="n5-inspector-label">Importe total</span>
                      <strong className="n5-inspector-value">
                        {formatPrice(diaSeleccionadoInfo.reserva.importe_total ?? 0)} €
                      </strong>
                    </div>
                  )}
                </div>

                <div className="n5-inspector-actions">
                  {diaSeleccionadoInfo.reserva.estado === 'confirmada' && (
                    <button
                      type="button"
                      className="n5-btn n5-btn-action-deliver"
                      onClick={() => handleMarcarEntregada(diaSeleccionadoInfo.reserva.id)}
                      disabled={procesandoId === diaSeleccionadoInfo.reserva.id}
                    >
                      {procesandoId === diaSeleccionadoInfo.reserva.id
                        ? 'Guardando…'
                        : 'Marcar Entregada'}
                    </button>
                  )}

                  {diaSeleccionadoInfo.reserva.estado === 'en_curso' && (
                    <button
                      type="button"
                      className="n5-btn n5-btn-action-pickup"
                      onClick={() => handleMarcarRecogida(diaSeleccionadoInfo.reserva.id)}
                      disabled={procesandoId === diaSeleccionadoInfo.reserva.id}
                    >
                      {procesandoId === diaSeleccionadoInfo.reserva.id
                        ? 'Guardando…'
                        : 'Marcar Recogida'}
                    </button>
                  )}

                  {(diaSeleccionadoInfo.reserva.estado === 'confirmada' ||
                    diaSeleccionadoInfo.reserva.estado === 'en_curso') && (
                    <button
                      type="button"
                      className="n5-btn n5-btn-action-cancel"
                      onClick={() => abrirModalCancelar(diaSeleccionadoInfo.reserva)}
                    >
                      ✕ Cancelar
                    </button>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Leyenda y resumen inferior */}
          <div className="n5-calendar-footer">
            <div className="n5-calendar-legend">
              <span className="n5-legend-item">
                <span className="n5-legend-swatch is-booked" />
                Alquiler activo / Confirmado
              </span>
              <span className="n5-legend-item">
                <span className="n5-legend-swatch is-blocked" />
                Bloqueo administrativo (Patrón rayado)
              </span>
              <span className="n5-legend-item">
                <span className="n5-legend-swatch is-free" />
                Día libre (Clic para bloquear)
              </span>
            </div>
            <div className="n5-calendar-summary">
              {reservasMuebleCalendario.length}{' '}
              {reservasMuebleCalendario.length === 1
                ? 'evento activo para este mueble'
                : 'eventos activos para este mueble'}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR RESERVA (CON REEMBOLSO EN CÉNTIMOS) */}
      {reservaACancelar && (
        <div className="admin-modal-overlay n5-modal-overlay">
          <div className="admin-modal-card n5-modal-card">
            <h3 className="n5-modal-title n5-modal-title--danger">¿Cancelar reserva?</h3>
            <p className="n5-modal-description">
              ¿Cancelar la reserva? Se intentará reembolsar al cliente el importe total a través de Stripe.
            </p>

            <div className="n5-refund-box">
              <label className="n5-checkbox-label">
                <input
                  type="checkbox"
                  checked={reembolsarTotal}
                  onChange={(e) => handleToggleReembolsoTotal(e.target.checked)}
                />
                <span>
                  Reembolsar el 100% del importe ({formatPrice(reservaACancelar.importe_total ?? 0)} €)
                </span>
              </label>

              <div className="n5-refund-input-group">
                <label htmlFor="input-reembolso-euros" className="n5-form-label">
                  Importe a reembolsar (€):
                </label>
                <input
                  id="input-reembolso-euros"
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(reservaACancelar.importe_total ?? 0)}
                  className="n5-input"
                  value={importeReembolsoEuros}
                  disabled={reembolsarTotal}
                  onChange={(e) => {
                    setReembolsarTotal(false);
                    setImporteReembolsoEuros(e.target.value);
                  }}
                />
                <small className="n5-refund-helper">
                  Se enviarán{' '}
                  <strong>
                    {Math.max(
                      0,
                      Math.round(
                        Number(
                          reembolsarTotal
                            ? reservaACancelar.importe_total ?? 0
                            : importeReembolsoEuros || 0
                        ) * 100
                      )
                    )}{' '}
                    céntimos
                  </strong>{' '}
                  (`reembolso_importe`) a la pasarela de pago.
                </small>
              </div>
            </div>

            <div className="n5-modal-actions">
              <button
                type="button"
                className="n5-btn n5-btn-ghost"
                onClick={cerrarModalCancelar}
                disabled={cancelando}
              >
                Volver
              </button>
              <button
                type="button"
                className="n5-btn n5-btn-danger"
                onClick={handleConfirmarCancelar}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando y reembolsando…' : 'Cancelar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BLOQUEAR FECHAS */}
      {modalBloqueoAbierto && (
        <div className="admin-modal-overlay n5-modal-overlay">
          <div className="admin-modal-card n5-modal-card">
            <h3 className="n5-modal-title">🔒 Bloquear fechas manualmente</h3>

            {errorBloqueo && <div className="n5-alert-error">{errorBloqueo}</div>}

            <form onSubmit={handleGuardarBloqueo}>
              <div className="n5-form-group">
                <label className="n5-form-label">Mueble:</label>
                <select
                  className="n5-input"
                  value={bloqueoMuebleId}
                  onChange={(e) => setBloqueoMuebleId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecciona un mueble…
                  </option>
                  {listaMuebles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} {m.referencia ? `(${m.referencia})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="n5-form-row-2">
                <div className="n5-form-group">
                  <label className="n5-form-label">Fecha Inicio:</label>
                  <input
                    type="date"
                    className="n5-input"
                    value={bloqueoFechaInicio}
                    onChange={(e) => setBloqueoFechaInicio(e.target.value)}
                    required
                  />
                </div>
                <div className="n5-form-group">
                  <label className="n5-form-label">Fecha Fin:</label>
                  <input
                    type="date"
                    className="n5-input"
                    value={bloqueoFechaFin}
                    onChange={(e) => setBloqueoFechaFin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="n5-form-group">
                <label className="n5-form-label">Motivo:</label>
                <input
                  type="text"
                  className="n5-input"
                  placeholder="Ej. Exposición, Mantenimiento, Restauración"
                  value={bloqueoMotivo}
                  onChange={(e) => setBloqueoMotivo(e.target.value)}
                  required
                />
              </div>

              <div className="n5-modal-actions">
                <button
                  type="button"
                  className="n5-btn n5-btn-ghost"
                  onClick={cerrarModalBloqueo}
                  disabled={guardandoBloqueo}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="n5-btn n5-btn-primary"
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
