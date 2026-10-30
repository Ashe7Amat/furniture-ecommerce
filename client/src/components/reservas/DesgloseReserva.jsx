// El desglose del precio de una reserva tal como lo calcula el servidor (GET /api/muebles/:id/presupuesto,
// docs/reservas-diseno.md, 7.2): días × precio por día, descuento, entrega, recogida, la fianza
// reembolsable (R-e) y total. Lo usan la ficha (en vivo, al elegir fechas) y el paso de confirmación.
// Aquí no se calcula nada.
import { eurosDeCentimos, textoDias } from '../../utils/reservas';
import { MODO_TRAYECTO } from './textosReserva';

const Fila = ({ concepto, importe, clase = '' }) => (
  <div className={`reserva-desglose-fila ${clase}`.trim()}>
    <dt>{concepto}</dt>
    <dd>{importe}</dd>
  </div>
);

const importeTrayecto = (centimos) => (centimos > 0 ? eurosDeCentimos(centimos) : 'Gratis');

const DesgloseReserva = ({ presupuesto: p }) => (
  <>
    <dl className="reserva-desglose">
      <Fila
        concepto={`${textoDias(p.dias)} × ${eurosDeCentimos(p.precio_dia_centimos)}`}
        importe={eurosDeCentimos(p.subtotal_alquiler_centimos)}
      />
      {p.descuento_centimos > 0 && (
        <Fila
          clase="reserva-desglose-fila--descuento"
          concepto={
            p.tramo
              ? `Descuento del ${p.tramo.porcentaje} % (${textoDias(p.tramo.desde_dias)} o más)`
              : 'Descuento'
          }
          importe={`−${eurosDeCentimos(p.descuento_centimos)}`}
        />
      )}
      <Fila concepto={`Entrega ${MODO_TRAYECTO[p.entrega.modo]}`} importe={importeTrayecto(p.entrega.importe_centimos)} />
      <Fila concepto={`Recogida ${MODO_TRAYECTO[p.recogida.modo]}`} importe={importeTrayecto(p.recogida.importe_centimos)} />
      {p.fianza?.importe_centimos > 0 && (
        <Fila
          clase="reserva-desglose-fila--fianza"
          concepto={`Fianza reembolsable (${p.fianza.porcentaje} % del alquiler)`}
          importe={eurosDeCentimos(p.fianza.importe_centimos)}
        />
      )}
      <Fila
        clase="reserva-desglose-fila--total"
        concepto="Total"
        importe={
          <>
            {eurosDeCentimos(p.importe_total_centimos)} <span className="reserva-desglose-iva">IVA incluido</span>
          </>
        }
      />
    </dl>
    {p.fianza?.importe_centimos > 0 && (
      <p className="reserva-desglose-nota">
        La fianza te la devolvemos en la misma tarjeta después de la recogida, cuando revisemos la pieza.
      </p>
    )}
  </>
);

export default DesgloseReserva;
