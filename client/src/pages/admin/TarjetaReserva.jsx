import { Fragment } from 'react';
import ReferenciaProducto from '../../components/ReferenciaProducto';
import { ETIQUETA_ACCION, ORIGEN, datosReserva, etiquetaAccion } from './reservasAdmin';

// Una reserva de la lista del panel: su etiqueta legible (la da el servidor, 8.7), la pieza, las
// fechas, el contacto del cliente si es un alquiler, el importe y el reembolso, y un botón por cada
// acción que el servidor permite ahora (`acciones`). Si el cliente pidió cancelarla desde "Mis
// reservas", lo dice una marca junto a la etiqueta. Mientras se guarda una acción, todos los botones
// de la lista están desactivados (`enviando`), y el que se pulsó dice "Guardando…". Debajo, el aviso
// con el que el servidor acompañó la última acción (`aviso`, p. ej. un margen recortado al
// recogerla) o su error (`error`). La tarjeta se puede enfocar (ReservasTab lo hace al acabar una
// acción cuyo botón ya no está), así el lector de pantalla no se queda sin sitio.
const TarjetaReserva = ({ reserva, aviso, error, enviando, onAccion }) => {
  // Cada botón se describe con la pieza y la referencia de la reserva: hay muchos "Marcar entregada".
  const idTitulo = `reserva-${reserva.id}-pieza`;
  const idReferencia = `reserva-${reserva.id}-ref`;
  const { pieza, contacto } = reserva;
  const acciones = (reserva.acciones ?? []).filter((accion) => ETIQUETA_ACCION[accion]);
  const claseAviso = reserva.retrasada || reserva.en_conflicto ? ' is-aviso' : '';

  return (
    <li className="pedido-card reserva-card" id={`reserva-tarjeta-${reserva.id}`} tabIndex={-1}>
      <div className="pedido-card-header">
        <div className="reserva-cabecera">
          <span className={`reserva-etiqueta estado-${reserva.estado}${claseAviso}`}>{reserva.etiqueta}</span>
          <span className="pedido-id" id={idReferencia}>Reserva {reserva.referencia}</span>
          {ORIGEN[reserva.origen] && <span className="reserva-origen">{ORIGEN[reserva.origen]}</span>}
          {reserva.cancelacion_solicitada && <span className="reserva-solicitud">Cancelación solicitada</span>}
        </div>
      </div>

      <div className="pedido-card-body reserva-card-body">
        <div>
          <h3 className="reserva-pieza" id={idTitulo}>{pieza.nombre}</h3>
          <ReferenciaProducto referencia={pieza.referencia} className="reserva-ref" />
          <dl className="reserva-datos">
            {datosReserva(reserva).map(([etiqueta, valor]) => (
              <Fragment key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </Fragment>
            ))}
          </dl>
        </div>

        {contacto && (
          <div className="pedido-cliente reserva-contacto">
            <h4>Cliente</h4>
            <p><strong>{contacto.nombre}</strong></p>
            {contacto.telefono && <p><a href={`tel:${contacto.telefono}`}>{contacto.telefono}</a></p>}
            {contacto.email && <p><a href={`mailto:${contacto.email}`}>{contacto.email}</a></p>}
            {contacto.direccion && <p className="pedido-direccion">{contacto.direccion}</p>}
            {contacto.notas && <p className="pedido-notas"><strong>Notas:</strong> {contacto.notas}</p>}
          </div>
        )}
      </div>

      {reserva.reembolso_a_medias && (
        <p className="reserva-aviso">
          El reembolso se quedó a medias: Stripe no lo ha confirmado. «Reintentar reembolso» comprueba primero
          en Stripe si ya se hizo y no lo repite.
          {acciones.includes('dar-por-reembolsado') &&
            ' Solo si lo has devuelto tú desde el Dashboard de Stripe, usa «Dar por reembolsado».'}
        </p>
      )}
      {reserva.en_conflicto && !reserva.reembolso_a_medias && (
        <p className="reserva-aviso">
          Esta reserva no se pudo confirmar: el reembolso se hace desde el Dashboard de Stripe.
        </p>
      )}
      {aviso && <p className="reserva-aviso" role="alert">{aviso}</p>}
      {error && <p className="reservas-error reserva-error" role="alert">{error}</p>}

      {acciones.length > 0 && (
        <div className="reserva-acciones">
          {acciones.map((accion) => (
            <button
              key={accion}
              type="button"
              className={accion === 'cancelar' ? 'admin-btn-danger-ghost' : 'admin-btn-ghost'}
              aria-describedby={`${idTitulo} ${idReferencia}`}
              disabled={enviando !== null}
              onClick={() => onAccion(reserva, accion)}
            >
              {enviando === `${reserva.id}:${accion}` ? 'Guardando…' : etiquetaAccion(reserva, accion)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
};

export default TarjetaReserva;
