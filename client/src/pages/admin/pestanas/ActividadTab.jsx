import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuditLogs } from '../../../services/api';
import DiffModal from '../modales/DiffModal';
import { obtenerResumenDetalle, ETIQUETAS_ACCION, ETIQUETAS_ENTIDAD } from '../actividad';

const ActividadTab = ({ initialLogs = null }) => {
  const [logs, setLogs] = useState(initialLogs || []);
  const [cargando, setCargando] = useState(!initialLogs);
  const [error, setError] = useState(false);
  const [logSeleccionado, setLogSeleccionado] = useState(null);

  // Filtros
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroAdmin, setFiltroAdmin] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const data = await getAuditLogs({
        fecha: filtroFecha,
        accion: filtroAccion,
        admin_email: filtroAdmin
      });
      if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else if (Array.isArray(data)) {
        setLogs(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [filtroFecha, filtroAccion, filtroAdmin]);

  useEffect(() => {
    if (!initialLogs) {
      cargarDatos();
    }
  }, [cargarDatos, initialLogs]);

  // Lista de administradores únicos para el dropdown
  const listaAdmins = useMemo(() => {
    const emails = new Set();
    logs.forEach((log) => {
      if (log.admin_email) emails.add(log.admin_email);
    });
    return Array.from(emails);
  }, [logs]);

  // Filtrado adicional en memoria por si se pasan initialLogs directamente en tests
  const logsVisibles = useMemo(() => {
    return logs.filter((log) => {
      if (filtroAccion && log.accion !== filtroAccion) return false;
      if (filtroAdmin && log.admin_email !== filtroAdmin) return false;
      if (filtroFecha === 'hoy') {
        const fechaLog = new Date(log.created_at);
        const hoy = new Date();
        if (
          fechaLog.getDate() !== hoy.getDate() ||
          fechaLog.getMonth() !== hoy.getMonth() ||
          fechaLog.getFullYear() !== hoy.getFullYear()
        ) {
          return false;
        }
      } else if (filtroFecha === '7dias') {
        const fechaLog = new Date(log.created_at);
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        if (fechaLog < hace7Dias) return false;
      }
      return true;
    });
  }, [logs, filtroAccion, filtroAdmin, filtroFecha]);

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <h2>Actividad</h2>
        <p>
          {logsVisibles.length} {logsVisibles.length === 1 ? 'registro' : 'registros'} de actividad
        </p>
      </div>

      <div className="admin-toolbar audit-toolbar">
        {/* Filtro por Fecha */}
        <select
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          aria-label="Filtrar por fecha"
        >
          <option value="">Todas las fechas</option>
          <option value="hoy">Hoy</option>
          <option value="7dias">Últimos 7 días</option>
        </select>

        {/* Filtro por Admin */}
        <select
          value={filtroAdmin}
          onChange={(e) => setFiltroAdmin(e.target.value)}
          aria-label="Filtrar por admin"
        >
          <option value="">Todos los administradores</option>
          {listaAdmins.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>

        {/* Filtro por Acción */}
        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          aria-label="Filtrar por acción"
        >
          <option value="">Todas las acciones</option>
          <option value="crear">Crear</option>
          <option value="editar">Editar</option>
          <option value="eliminar">Eliminar</option>
          <option value="duplicar">Duplicar</option>
          <option value="cambio_estado">Cambio de estado</option>
          <option value="login">Inicio de sesión</option>
        </select>

        {(filtroFecha || filtroAdmin || filtroAccion) && (
          <button
            type="button"
            className="admin-btn-ghost"
            onClick={() => {
              setFiltroFecha('');
              setFiltroAdmin('');
              setFiltroAccion('');
            }}
          >
            Limpiar filtros
          </button>
        )}

        <button type="button" className="admin-btn-ghost" onClick={cargarDatos} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error ? (
        <div className="mensajes-error" role="alert">
          <p>No se pudo cargar el registro de actividad.</p>
          <button type="button" className="admin-btn-ghost" onClick={cargarDatos}>
            Reintentar
          </button>
        </div>
      ) : logsVisibles.length === 0 ? (
        <p className="admin-empty-note">
          {logs.length === 0
            ? 'Todavía no hay ningún registro de actividad.'
            : 'No hay actividades que coincidan con estos filtros.'}
        </p>
      ) : (
        <div className="audit-table-wrapper">
          <table className="audit-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Admin</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logsVisibles.map((log) => {
                const fecha = log.created_at
                  ? new Date(log.created_at).toLocaleString('es-ES', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })
                  : '—';
                const detalle = obtenerResumenDetalle(log);
                const accionEtiqueta = ETIQUETAS_ACCION[log.accion] || log.accion;
                const entidadEtiqueta = ETIQUETAS_ENTIDAD[log.entidad] || log.entidad;

                return (
                  <tr
                    key={log.id}
                    onClick={() => setLogSeleccionado(log)}
                    onKeyDown={(e) => e.key === 'Enter' && setLogSeleccionado(log)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalle de ${accionEtiqueta} en ${entidadEtiqueta}`}
                    className="audit-row"
                  >
                    <td className="audit-col-fecha">{fecha}</td>
                    <td className="audit-col-admin">{log.admin_email || 'Sistema'}</td>
                    <td className="audit-col-accion">
                      <span className={`audit-badge badge-${log.accion}`}>{accionEtiqueta}</span>
                    </td>
                    <td className="audit-col-entidad">
                      <span className="audit-entidad-tag">{entidadEtiqueta}</span>
                    </td>
                    <td className="audit-col-detalle">{detalle}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {logSeleccionado && (
        <DiffModal log={logSeleccionado} onCerrar={() => setLogSeleccionado(null)} />
      )}
    </div>
  );
};

export default ActividadTab;
