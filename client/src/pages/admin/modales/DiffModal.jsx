import { useId, useRef } from 'react';
import useDialogoModal from '../../../utils/useDialogoModal';
import Icon from '../Icon';

const formatearValor = (valor) => {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí (true)' : 'No (false)';
  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor, null, 2);
    } catch {
      return String(valor);
    }
  }
  return String(valor);
};

const ETIQUETAS_ACCION = {
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  duplicar: 'Duplicar',
  cambio_estado: 'Cambio de estado',
  login: 'Inicio de sesión'
};

const DiffModal = ({ log, onCerrar }) => {
  const ref = useRef(null);
  const idTitulo = useId();
  useDialogoModal(true, ref, onCerrar);

  if (!log) return null;

  const fechaTexto = log.created_at
    ? new Date(log.created_at).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '—';

  const accionTexto = ETIQUETAS_ACCION[log.accion] || log.accion;
  const ant = log.datos_anteriores;
  const nue = log.datos_nuevos;

  // Obtener todas las claves únicas para la comparativa
  const claves = Array.from(
    new Set([...(ant ? Object.keys(ant) : []), ...(nue ? Object.keys(nue) : [])])
  );

  return (
    <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        ref={ref}
        className="admin-modal-content audit-diff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <div className="admin-modal-header">
          <div className="audit-diff-header-info">
            <h3 id={idTitulo}>Detalle de Actividad</h3>
            <span className={`audit-badge badge-${log.accion}`}>{accionTexto}</span>
          </div>
          <button type="button" className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar modal">
            <Icon name="close" />
          </button>
        </div>

        <div className="audit-diff-meta">
          <div>
            <strong>Fecha:</strong> <span>{fechaTexto}</span>
          </div>
          <div>
            <strong>Admin:</strong> <span>{log.admin_email || 'Sistema'}</span>
          </div>
          <div>
            <strong>Entidad:</strong> <span>{log.entidad}</span>
          </div>
          {log.entidad_id && (
            <div>
              <strong>ID Entidad:</strong> <code>{log.entidad_id}</code>
            </div>
          )}
        </div>

        <div className="audit-diff-body">
          <h4 className="audit-diff-subtitulo">Comparativa de cambios (Diff)</h4>

          {claves.length === 0 ? (
            <p className="admin-empty-note">No hay detalles de datos registrados para esta acción.</p>
          ) : (
            <div className="audit-diff-table-wrapper">
              <table className="audit-diff-table">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th className="th-anterior">Datos anteriores</th>
                    <th className="th-nuevo">Datos nuevos</th>
                  </tr>
                </thead>
                <tbody>
                  {claves.map((clave) => {
                    const valAnt = ant ? ant[clave] : undefined;
                    const valNue = nue ? nue[clave] : undefined;
                    return (
                      <tr key={clave}>
                        <td className="diff-clave">
                          <code>{clave}</code>
                        </td>
                        <td className="diff-anterior">
                          {valAnt !== undefined ? (
                            <pre className="diff-pre">{formatearValor(valAnt)}</pre>
                          ) : (
                            <span className="diff-vacio">(vacío / no definido)</span>
                          )}
                        </td>
                        <td className="diff-nuevo">
                          {valNue !== undefined ? (
                            <pre className="diff-pre">{formatearValor(valNue)}</pre>
                          ) : (
                            <span className="diff-vacio">(vacío / no definido)</span>
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

        <div className="admin-modal-footer">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiffModal;
