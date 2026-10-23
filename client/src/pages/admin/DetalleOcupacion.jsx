import { Fragment, useEffect, useRef } from 'react';
import ReferenciaProducto from '../../components/ReferenciaProducto';
import { fechaCorta, fechaLarga } from '../../utils/reservas';
import { claseDe, filasDeDetalle } from './ocupacion';

const TIPO = { alquiler: 'Alquiler', bloqueo: 'Bloqueo', venta: 'Venta' };

// Lo que se abre al pulsar un día del calendario de una pieza o una barra de la vista general: la
// reserva (o las dos, si en ese día una retrasada tiene fuera la pieza de otra) con sus fechas, y
// «Ver reserva», que lleva a su tarjeta de la lista, donde están las acciones. Al abrirse se lleva el
// foco: quien usa teclado o lector de pantalla no tiene otra forma de saber que ha salido algo.
const DetalleOcupacion = ({ reservas, dia = null, onVer, onCerrar }) => {
  const raiz = useRef(null);
  const clave = `${dia ?? ''}|${reservas.map((r) => r.id).join(',')}`;

  useEffect(() => {
    raiz.current?.focus();
  }, [clave]);

  return (
    <section
      className="ocupacion-detalle"
      ref={raiz}
      tabIndex={-1}
      aria-label={dia ? `Detalle del ${fechaLarga(dia)}` : 'Detalle de la reserva'}
    >
      <div className="ocupacion-detalle-cabecera">
        {dia && <p className="ocupacion-detalle-dia">{fechaLarga(dia)}</p>}
        <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Cerrar detalle</button>
      </div>
      {reservas.map((r) => (
        <article key={r.id} className={`ocupacion-detalle-reserva ocupacion-detalle--${claseDe(r)}`}>
          <h4>
            <span className={`reserva-etiqueta estado-${r.estado}${r.retrasada || r.en_conflicto ? ' is-aviso' : ''}`}>
              {r.etiqueta}
            </span>{' '}
            {TIPO[r.tipo] ?? r.tipo} {r.referencia}
          </h4>
          <div className="ocupacion-detalle-pieza">
            <strong>{r.pieza.nombre}</strong>
            <ReferenciaProducto referencia={r.pieza.referencia} className="reserva-ref" />
          </div>
          <dl className="reserva-datos">
            {filasDeDetalle(r).map(([etiqueta, valor]) => (
              <Fragment key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </Fragment>
            ))}
          </dl>
          {r.retrasada && (
            <p className="ocupacion-detalle-aviso">
              La recogida estaba prevista el {fechaCorta(r.fecha_fin)} y la pieza sigue fuera.
            </p>
          )}
          {r.en_conflicto && (
            <p className="ocupacion-detalle-aviso">
              Esta reserva está pagada pero no se pudo confirmar: mírala en «En conflicto».
            </p>
          )}
          <button
            type="button"
            className="admin-btn-ghost"
            aria-label={`Ver reserva ${r.referencia} (${r.pieza.nombre}) en la lista`}
            onClick={() => onVer(r)}
          >
            Ver reserva
          </button>
        </article>
      ))}
    </section>
  );
};

export default DetalleOcupacion;
