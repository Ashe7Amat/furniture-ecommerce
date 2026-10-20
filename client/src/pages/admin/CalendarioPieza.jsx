import { useMemo, useRef, useState } from 'react';
import DetalleOcupacion from './DetalleOcupacion';
import LeyendaOcupacion from './LeyendaOcupacion';
import CampoReserva from './modales/CampoReserva';
import useCalendarioReservas from './hooks/useCalendarioReservas';
import { claseDe, diaDeLaPieza, textoDelDia, textoReservasDelMes } from './ocupacion';
import { mesDe, nombreDelMes, primerDiaDe, semanasDelMes, sumarDias, sumarMeses } from '../../utils/reservas';

// De lunes a domingo: lo que se ve y lo que lee el lector de pantalla.
const SEMANA = [
  ['lun', 'lunes'],
  ['mar', 'martes'],
  ['mié', 'miércoles'],
  ['jue', 'jueves'],
  ['vie', 'viernes'],
  ['sáb', 'sábado'],
  ['dom', 'domingo']
];

// Un día de la pieza. Si algo la ocupa (o una retrasada la tiene fuera) es un botón que abre su detalle;
// si no, solo el número y, para el lector de pantalla, que está libre.
const CeldaDia = ({ dia, info, esHoy, elegido, onElegir }) => {
  const { reserva, parte, retraso } = info;
  const ocupado = Boolean(reserva || retraso);
  const clases = [
    'ocupacion-dia',
    ocupado && `ocupacion-dia--${reserva ? claseDe(reserva) : 'retrasada'}`,
    parte === 'margen' && 'ocupacion-dia--margen',
    reserva && retraso && 'ocupacion-dia--con-retraso',
    esHoy && 'ocupacion-dia--hoy',
    elegido && 'is-seleccionado'
  ]
    .filter(Boolean)
    .join(' ');
  const numero = Number(dia.slice(8));
  const texto = `${textoDelDia(dia, info)}${esHoy ? ' (hoy)' : ''}`;
  return (
    <td className={clases}>
      {ocupado ? (
        <button
          type="button"
          className="ocupacion-dia-boton"
          aria-pressed={elegido}
          aria-label={texto}
          onClick={(evento) => onElegir(dia, evento.currentTarget)}
        >
          <span className="ocupacion-numero" aria-hidden="true">{numero}</span>
          {reserva && retraso && <span className="ocupacion-marca" aria-hidden="true">!</span>}
        </button>
      ) : (
        <span className="ocupacion-libre">
          <span className="ocupacion-numero" aria-hidden="true">{numero}</span>
          <span className="ocupacion-solo-lector">{texto}</span>
        </span>
      )}
    </td>
  );
};

// El calendario de una pieza (docs/reservas-diseno.md, 8.2): un mes con sus días libres, reservados,
// bloqueados y de margen, para ir mes a mes, y el detalle de cada reserva al pulsar su día. Se dibuja
// con lo que devuelve GET /api/admin/reservas/calendario; el servidor impide que dos reservas de una
// pieza se pisen, así que cada día es de una sola reserva (más, a lo sumo, una retrasada que sigue
// teniendo la pieza fuera). `hoy` es el día de ahora, para el mes con que se abre.
const CalendarioPieza = ({ muebles = [], hoy, version = 0, activo = true, onVer }) => {
  const [muebleId, setMuebleId] = useState('');
  const [mes, setMes] = useState(() => mesDe(hoy));
  const [seleccion, setSeleccion] = useState(null);
  const [intento, setIntento] = useState(0);
  // El botón del día pulsado: al cerrar el detalle el foco vuelve a él.
  const disparador = useRef(null);

  const piezas = useMemo(
    () => [...muebles].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [muebles]
  );
  const pieza = piezas.find((m) => m.id === muebleId) ?? null;
  const desde = primerDiaDe(mes);
  const hasta = sumarDias(primerDiaDe(sumarMeses(mes, 1)), -1);
  const { datos, error, cargando } = useCalendarioReservas({
    desde,
    hasta,
    muebleId,
    version: `${version}.${intento}`,
    activo: activo && Boolean(pieza)
  });

  const hoyReal = datos?.hoy ?? hoy;
  const reservas = useMemo(
    () => (datos?.reservas ?? []).filter((r) => r.pieza.id === muebleId),
    [datos, muebleId]
  );
  const semanas = semanasDelMes(mes);
  const dias = semanas.flat().filter(Boolean);
  const delDia = (dia) => diaDeLaPieza(reservas, dia, hoyReal);

  const enElMes = new Set();
  for (const dia of dias) {
    const { reserva, retraso } = delDia(dia);
    if (reserva) enElMes.add(reserva.id);
    if (retraso) enElMes.add(retraso.id);
  }

  const elegirPieza = (evento) => {
    setMuebleId(evento.target.value);
    setSeleccion(null);
  };
  const irAlMes = (nuevo) => {
    setMes(nuevo);
    setSeleccion(null);
  };
  const elegirDia = (dia, boton) => {
    disparador.current = boton;
    setSeleccion(dia === seleccion ? null : dia);
  };
  const cerrarDetalle = () => {
    setSeleccion(null);
    disparador.current?.focus();
  };

  const detalle = seleccion && datos ? delDia(seleccion) : null;
  const delDetalle = detalle ? [detalle.reserva, detalle.retraso].filter(Boolean) : [];

  return (
    <div className="ocupacion ocupacion-pieza">
      <div className="ocupacion-controles">
        <CampoReserva etiqueta="Pieza">
          <select value={muebleId} onChange={elegirPieza}>
            <option value="">Elige una pieza</option>
            {piezas.map((m) => (
              <option key={m.id} value={m.id}>{m.referencia ? `${m.nombre} (${m.referencia})` : m.nombre}</option>
            ))}
          </select>
        </CampoReserva>
      </div>

      {!pieza ? (
        <p className="admin-empty-note">Elige una pieza para ver sus reservas mes a mes.</p>
      ) : (
        <>
          <div className="ocupacion-navegacion">
            <button type="button" className="admin-btn-ghost" onClick={() => irAlMes(sumarMeses(mes, -1))}>
              Mes anterior
            </button>
            <h3 className="ocupacion-titulo" aria-live="polite">{nombreDelMes(mes)}</h3>
            <button type="button" className="admin-btn-ghost" onClick={() => irAlMes(sumarMeses(mes, 1))}>
              Mes siguiente
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              disabled={mes === mesDe(hoyReal)}
              onClick={() => irAlMes(mesDe(hoyReal))}
            >
              Este mes
            </button>
          </div>

          <LeyendaOcupacion />

          {error && (
            <div className="mensajes-error" role="alert">
              <p>{error}</p>
              <button type="button" className="admin-btn-ghost" onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          )}
          {!datos && cargando && <p className="admin-empty-note" role="status">Cargando el calendario…</p>}

          {datos && (
            <>
              <p className="ocupacion-resumen" role="status">{textoReservasDelMes(enElMes.size, mes)}</p>
              {datos.limitada && (
                <p className="reservas-busqueda-limite" role="status">
                  Hay más reservas de las que caben en el calendario: faltan algunas.
                </p>
              )}
              <table className="ocupacion-mes" aria-busy={cargando}>
                <caption className="ocupacion-solo-lector">
                  Calendario de {pieza.nombre}, {nombreDelMes(mes)}
                </caption>
                <thead>
                  <tr>
                    {SEMANA.map(([corto, largo]) => (
                      <th key={corto} scope="col" abbr={largo}>{corto}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((semana) => (
                    <tr key={semana.find(Boolean)}>
                      {semana.map((dia, i) =>
                        dia === null ? (
                          <td key={`hueco-${i}`} className="ocupacion-dia ocupacion-dia--fuera" />
                        ) : (
                          <CeldaDia
                            key={dia}
                            dia={dia}
                            info={delDia(dia)}
                            esHoy={dia === hoyReal}
                            elegido={dia === seleccion}
                            onElegir={elegirDia}
                          />
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {delDetalle.length > 0 && (
            <DetalleOcupacion reservas={delDetalle} dia={seleccion} onVer={onVer} onCerrar={cerrarDetalle} />
          )}
        </>
      )}
    </div>
  );
};

export default CalendarioPieza;
