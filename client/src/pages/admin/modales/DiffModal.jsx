import { useId, useRef } from 'react';
import useDialogoModal from '../../../utils/useDialogoModal';
import Icon from '../Icon';
import {
  CAMPOS_IGNORADOS,
  traducirCampo,
  formatearValor,
  construirMensajeBorrado,
  ETIQUETAS_ACCION,
  ETIQUETAS_ENTIDAD
} from '../actividad';

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
  const entidadTexto = ETIQUETAS_ENTIDAD[log.entidad] || log.entidad;
  const ant = log.datos_anteriores;
  const nue = log.datos_nuevos;

  // Filtrar claves excluyendo siempre los campos técnicos
  const claves = Array.from(
    new Set([...(ant ? Object.keys(ant) : []), ...(nue ? Object.keys(nue) : [])])
  ).filter((c) => !CAMPOS_IGNORADOS.has(c));

  const esBorrado = log.accion === 'eliminar' || (ant && (!nue || Object.keys(nue).length === 0));

  return (
    <div
      className="admin-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
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
          <button
            type="button"
            className="admin-modal-close"
            onClick={onCerrar}
            aria-label="Cerrar modal"
          >
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
            <strong>Entidad:</strong> <span>{entidadTexto}</span>
          </div>
          {log.entidad_id && (
            <div>
              <strong>Referencia/ID:</strong> <span>{ant?.referencia || nue?.referencia || log.entidad_id}</span>
            </div>
          )}
        </div>

        <div className="audit-diff-body">
          {esBorrado ? (
            <div className="audit-borrado-card">
              <div className="audit-borrado-icono" aria-hidden="true">
                <Icon name="trash" />
              </div>
              <p className="audit-borrado-texto">{construirMensajeBorrado(log)}</p>
            </div>
          ) : (
            <>
              <h4 className="audit-diff-subtitulo">Comparativa de cambios</h4>

              {claves.length === 0 ? (
                <p className="admin-empty-note">
                  No hay cambios visibles relevantes para esta acción.
                </p>
              ) : (
                <div className="audit-diff-table-wrapper">
                  <table className="audit-diff-table">
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th className="th-anterior">Antes</th>
                        <th className="th-nuevo">Después</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claves.map((clave) => {
                        const valAnt = ant ? ant[clave] : undefined;
                        const valNue = nue ? nue[clave] : undefined;
                        const campoNombre = traducirCampo(clave);
                        const textoAnt = formatearValor(clave, valAnt, false, log.accion);
                        const textoNue = formatearValor(clave, valNue, true, log.accion);

                        return (
                          <tr key={clave}>
                            <td className="diff-clave">
                              <span className="diff-campo-nombre">{campoNombre}</span>
                            </td>
                            <td className="diff-anterior">
                              <span className="diff-valor">{textoAnt}</span>
                            </td>
                            <td className="diff-nuevo">
                              <span className="diff-valor">{textoNue}</span>
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
