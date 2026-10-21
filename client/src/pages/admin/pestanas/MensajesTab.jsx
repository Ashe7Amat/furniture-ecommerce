import { useContext, useRef, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { marcarMensajeLeido, crearEnCalendarioAdmin } from '../../../services/api';
import { reservasActivas } from '../../../utils/reservas';
import Icon from '../Icon';
import AltaCalendarioModal from '../modales/AltaCalendarioModal';
import { recortar, fechaMensaje, piezasDelMensaje, textoEstado } from '../mensajes';
import { hoyMasReciente } from '../reservasAdmin';
import '../../../styles/AdminReservas.css';

// Pestaña "Mensajes": lo que llega por el formulario de contacto (tabla mensajes_contacto). La lista
// viene del contenedor (useAdminDatos), porque la insignia de no leídos está en la barra lateral.
// Pulsar una fila abre el mensaje entero, desde donde se marca como leído.
// Si el mensaje nombra piezas por su referencia (el botón «Preguntar por esta pieza» de la web escribe
// «(ref. NAV-SIL-001)»), el modal enseña una tarjeta por pieza, con botones para abrir su editor y,
// con las reservas encendidas (VITE_RESERVAS_ACTIVAS), para registrar un alquiler con los datos del cliente.

const TarjetaPieza = ({ referencia, mueble, onEditar, onReservar }) => {
  if (!mueble) {
    return <li className="mensaje-pieza no-encontrada">Pieza no encontrada ({referencia})</li>;
  }
  const foto = mueble.imagenes?.[0];
  return (
    <li className="mensaje-pieza">
      {foto
        ? <img className="mensaje-pieza-foto" src={foto} alt="" width="60" height="60" />
        : <span className="mensaje-pieza-foto sin-foto" aria-hidden="true" />}
      <div className="mensaje-pieza-datos">
        <strong>{mueble.nombre}</strong>
        <span className="mensaje-pieza-ref">{referencia}</span>
        <span className={`status-pill ${mueble.estado || 'disponible'}`}>{textoEstado(mueble.estado)}</span>
      </div>
      <div className="mensaje-pieza-botones">
        <button type="button" className="admin-btn-ghost" onClick={() => onEditar(mueble)}>
          Ver/Editar pieza
        </button>
        {onReservar && (
          <button type="button" className="admin-btn-ghost" onClick={() => onReservar(mueble)}>
            Crear reserva
          </button>
        )}
      </div>
    </li>
  );
};

const MensajeModal = ({ mensaje, piezas, marcando, onMarcarLeido, onEditar, onReservar, onCerrar }) => (
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
      {piezas.length > 0 && (
        <section className="mensaje-piezas" aria-label="Piezas del mensaje">
          <h4>{piezas.length === 1 ? 'Pieza del mensaje' : 'Piezas del mensaje'}</h4>
          <ul>
            {piezas.map((p) => (
              <TarjetaPieza key={p.referencia} {...p} onEditar={onEditar} onReservar={onReservar} />
            ))}
          </ul>
        </section>
      )}
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

const MensajesTab = ({ mensajes, setMensajes, errorMensajes, recargarMensajes, muebles, abrirEditorMueble }) => {
  const { showToast } = useContext(ToastContext);
  const [filtro, setFiltro] = useState('todos');
  const [abierto, setAbierto] = useState(null);
  const [marcando, setMarcando] = useState(false);
  // El alta de alquiler abierta desde un mensaje: { inicial, hoy }, y lo que pasa al guardarla.
  const [alta, setAlta] = useState(null);
  const [guardandoAlta, setGuardandoAlta] = useState(false);
  // La guarda de un segundo envío (Intro dos veces) antes de que el botón se desactive.
  const guardando = useRef(false);
  const [errorAlta, setErrorAlta] = useState('');

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

  // El editor de la pieza es el del inventario (vive en Admin.jsx); el mensaje se cierra para que no
  // haya dos diálogos abiertos a la vez.
  const editarPieza = (mueble) => {
    setAbierto(null);
    abrirEditorMueble(mueble);
  };

  const reservarPieza = (mueble) => {
    setErrorAlta('');
    setAlta({ inicial: { mueble_id: mueble.id, nombre: abierto.nombre, email: abierto.email }, hoy: hoyMasReciente(null) });
    setAbierto(null);
  };

  const enviarAlta = async (datos) => {
    if (guardando.current) return;
    guardando.current = true;
    setGuardandoAlta(true);
    const { error } = await crearEnCalendarioAdmin('alquiler', datos);
    guardando.current = false;
    setGuardandoAlta(false);
    if (error) {
      setErrorAlta(error);
      return;
    }
    setAlta(null);
    showToast('Alquiler registrado', 'success');
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
          piezas={piezasDelMensaje(abierto, muebles)}
          marcando={marcando}
          onMarcarLeido={marcarLeido}
          onEditar={editarPieza}
          onReservar={reservasActivas() ? reservarPieza : null}
          onCerrar={() => setAbierto(null)}
        />
      )}

      {alta && (
        <AltaCalendarioModal
          tipo="alquiler"
          muebles={muebles}
          hoy={alta.hoy}
          inicial={alta.inicial}
          enviando={guardandoAlta}
          error={errorAlta}
          onEnviar={enviarAlta}
          onCerrar={() => setAlta(null)}
        />
      )}
    </div>
  );
};

export default MensajesTab;
