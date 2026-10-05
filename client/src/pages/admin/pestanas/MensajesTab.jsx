import { useContext, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { marcarMensajeLeido } from '../../../services/api';
import Icon from '../Icon';
import { recortar, fechaMensaje } from '../mensajes';

// Pestaña "Mensajes": lo que llega por el formulario de contacto (tabla mensajes_contacto). La lista
// viene del contenedor (useAdminDatos), porque la insignia de no leídos está en la barra lateral.
// Pulsar una fila abre el mensaje entero, desde donde se marca como leído.

const MensajeModal = ({ mensaje, marcando, onMarcarLeido, onCerrar }) => (
  <div className="admin-modal-overlay">
    <div className="admin-modal-content mensaje-modal" role="dialog" aria-modal="true" aria-labelledby="mensaje-titulo">
      <div className="admin-modal-header">
        <h3 id="mensaje-titulo">Mensaje de {mensaje.nombre}</h3>
        <button className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <dl className="mensaje-datos">
        <dt>Email</dt>
        <dd><a href={`mailto:${mensaje.email}`}>{mensaje.email}</a></dd>
        <dt>Fecha</dt>
        <dd>{fechaMensaje(mensaje.created_at)}</dd>
        <dt>Estado</dt>
        <dd>{mensaje.leido ? 'Leído' : 'Sin leer'}</dd>
      </dl>
      <p className="mensaje-texto">{mensaje.mensaje}</p>
      <div className="mensaje-acciones">
        {!mensaje.leido && (
          <button className="admin-btn" onClick={onMarcarLeido} disabled={marcando}>
            {marcando ? 'Guardando…' : 'Marcar como leído'}
          </button>
        )}
        <button className="admin-btn-ghost" onClick={onCerrar}>Volver a la lista</button>
      </div>
    </div>
  </div>
);

const MensajesTab = ({ mensajes, setMensajes, errorMensajes, recargarMensajes }) => {
  const { showToast } = useContext(ToastContext);
  const [filtro, setFiltro] = useState('todos');
  const [abierto, setAbierto] = useState(null);
  const [marcando, setMarcando] = useState(false);

  const noLeidos = mensajes.filter((m) => !m.leido).length;
  const visibles = filtro === 'no-leidos' ? mensajes.filter((m) => !m.leido) : mensajes;

  const marcarLeido = async () => {
    setMarcando(true);
    const actualizado = await marcarMensajeLeido(abierto.id);
    setMarcando(false);
    if (!actualizado) {
      showToast('No se pudo marcar el mensaje como leído', 'error');
      return;
    }
    setMensajes((lista) => lista.map((m) => (m.id === actualizado.id ? { ...m, leido: true } : m)));
    setAbierto((actual) => ({ ...actual, leido: true }));
    showToast('Mensaje marcado como leído', 'success');
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <h2>Mensajes</h2>
        <p>{mensajes.length} mensaje{mensajes.length === 1 ? '' : 's'} · {noLeidos} sin leer</p>
      </div>

      {errorMensajes ? (
        <div className="mensajes-error" role="alert">
          <p>No se pudieron cargar los mensajes.</p>
          <button className="admin-btn-ghost" onClick={recargarMensajes}>Reintentar</button>
        </div>
      ) : (
        <>
          <div className="admin-toolbar">
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar mensajes">
              <option value="todos">Todos</option>
              <option value="no-leidos">No leídos</option>
            </select>
          </div>

          {visibles.length === 0 ? (
            <p className="inventory-empty">
              {mensajes.length === 0 ? 'Todavía no ha llegado ningún mensaje.' : 'No hay mensajes sin leer.'}
            </p>
          ) : (
            <table className="mensajes-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Mensaje</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((m) => (
                  <tr key={m.id} className={m.leido ? 'is-leido' : 'is-no-leido'} onClick={() => setAbierto(m)}>
                    <td>
                      <button className="mensajes-abrir" onClick={(e) => { e.stopPropagation(); setAbierto(m); }}>
                        {m.nombre}
                      </button>
                    </td>
                    <td title={m.email}>{recortar(m.email, 28)}</td>
                    <td title={m.mensaje}>{recortar(m.mensaje, 60)}</td>
                    <td>{fechaMensaje(m.created_at)}</td>
                    <td><span className={`mensaje-estado ${m.leido ? 'leido' : 'no-leido'}`}>{m.leido ? 'Leído' : 'Sin leer'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {abierto && (
        <MensajeModal
          mensaje={abierto}
          marcando={marcando}
          onMarcarLeido={marcarLeido}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
};

export default MensajesTab;
