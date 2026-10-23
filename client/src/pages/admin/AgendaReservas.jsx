import ReferenciaProducto from '../../components/ReferenciaProducto';
import { fechaCorta, fechaLarga } from '../../utils/reservas';
import { MODOS, horaCorta, textoTrayectos } from './reservasAdmin';

const TIPO = { entrega: 'Entrega', recogida: 'Recogida' };
const MODO = Object.fromEntries(MODOS);

// Lo que se hace con una reserva hoy o mañana: la hora, entrega o recogida, la pieza, quién, un teléfono y
// dónde llevarla. Sin abrir cada tarjeta (docs/reservas-diseno.md, 8.2: la lista de trayectos del día).
// «Ver reserva» lleva a su tarjeta, que es donde están las acciones.
const Trayecto = ({ trayecto, onVer }) => {
  const { reserva, tipo, modo, hora, atrasada, prevista } = trayecto;
  const { pieza, cliente, direccion } = reserva;
  return (
    <li className="agenda-trayecto">
      <span className="agenda-hora">{hora ? horaCorta(hora) : 'Sin hora'}</span>
      <div className="agenda-datos">
        <p className="agenda-que">
          <span className={`agenda-tipo agenda-tipo--${tipo}`}>{TIPO[tipo]}</span>
          {MODO[modo] && <span className="agenda-modo">{MODO[modo]}</span>}
          {atrasada && (
            <span className="agenda-atrasada">Tenía que entregarse el {fechaCorta(prevista)}</span>
          )}
        </p>
        <div className="agenda-pieza">
          <strong>{pieza.nombre}</strong>
          <ReferenciaProducto referencia={pieza.referencia} className="reserva-ref" />
        </div>
        {cliente && (
          <p className="agenda-cliente">
            {cliente.nombre}
            {cliente.telefono && (
              <>
                {' · '}
                <a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a>
              </>
            )}
          </p>
        )}
        {direccion && <p className="agenda-direccion">{direccion}</p>}
      </div>
      <button
        type="button"
        className="admin-btn-ghost"
        aria-label={`Ver reserva ${reserva.referencia} (${pieza.nombre})`}
        onClick={() => onVer(trayecto)}
      >
        Ver reserva
      </button>
    </li>
  );
};

// «Hoy y mañana» en lo alto de «Reservas»: entregas y recogidas juntas, por día y hora. Mientras no hay
// agenda ni error (la primera lectura, o una respuesta vacía) no pinta nada. Si una lectura falla y había
// una agenda de antes, se queda y el aviso va encima.
const AgendaReservas = ({ datos, error, onRecargar, onVer }) => {
  if (!datos && !error) return null;
  const dias = datos
    ? [
        ['Hoy', datos.hoy],
        ['Mañana', datos.manana]
      ]
    : [];
  return (
    <section className="reservas-agenda" aria-labelledby="agenda-titulo">
      <h3 id="agenda-titulo">Hoy y mañana</h3>
      {datos && <p className="reservas-agenda-resumen">{textoTrayectos(datos.trayectos)}</p>}
      {error && (
        <div className="reservas-agenda-error" role="status">
          <p>{error}</p>
          <button type="button" className="admin-btn-ghost" onClick={onRecargar}>
            Volver a cargar la agenda
          </button>
        </div>
      )}
      {dias.map(([nombre, dia]) => {
        const delDia = datos.trayectos.filter((t) => t.dia === dia);
        return (
          <div key={dia} className="agenda-dia">
            <h4>
              {nombre} <span>{fechaLarga(dia)}</span>
            </h4>
            {delDia.length === 0 ? (
              <p className="agenda-vacio">Nada que entregar ni recoger.</p>
            ) : (
              <ul className="agenda-lista">
                {delDia.map((t) => (
                  <Trayecto key={t.clave} trayecto={t} onVer={onVer} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default AgendaReservas;
