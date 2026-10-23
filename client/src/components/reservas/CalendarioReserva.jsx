// Calendario de un mes para elegir la entrega y la recogida de una reserva (docs/reservas-diseno.md,
// 6.2). Propio, sin dependencias: una tabla de lunes a domingo con un <button> por día. Cada botón
// lleva su fecha completa para los lectores de pantalla ("lunes, 2 de noviembre de 2026, entrega"),
// y los días que no se pueden elegir están desactivados. El primer clic elige la entrega y el
// segundo, la recogida (ver seleccionFechas.js).
import { useId, useRef, useState } from 'react';
import { sumarMeses, semanasDelMes, nombreDelMes, fechaLarga } from '../../utils/reservas';
import { GRUPO_DE_MOTIVO, diaElegible, mesesVisibles, motivoNoElegible, seleccionTrasElegir } from './seleccionFechas';
import { textoMotivo, textoPlazos } from './textosReserva';

const DIAS_SEMANA = [
  ['L', 'lunes'],
  ['M', 'martes'],
  ['X', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
  ['D', 'domingo']
];

const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const instrucciones = ({ inicio, fin }) => {
  if (!inicio) return 'Elige el día de entrega.';
  if (!fin) return `Entrega el ${fechaLarga(inicio)}. Ahora elige el día de recogida.`;
  return `Entrega el ${fechaLarga(inicio)} y recogida el ${fechaLarga(fin)}.`;
};

const CalendarioReserva = ({ disponibilidad, inicio, fin, onCambiar }) => {
  const idMes = useId();
  const instruccionesRef = useRef(null);
  const { primero, ultimo } = mesesVisibles(disponibilidad);
  const [mesElegido, setMesElegido] = useState(disponibilidad.primer_inicio_posible.slice(0, 7));
  // Si la disponibilidad se recarga con otros límites, el mes se queda dentro de ellos.
  const mes = mesElegido < primero ? primero : mesElegido > ultimo ? ultimo : mesElegido;
  const seleccion = { inicio, fin };

  const dia = (fecha) => {
    const elegible = diaElegible(seleccion, fecha, disponibilidad);
    const papel = fecha === inicio ? 'entrega' : fecha === fin ? 'recogida' : null;
    const enRango = inicio && fin && fecha > inicio && fecha < fin;
    // Por qué no se puede pulsar: rayado si lo tiene otra reserva, apagado si está fuera de plazo.
    const motivo = elegible ? null : motivoNoElegible(seleccion, fecha, disponibilidad);
    const clases = [
      'cal-reserva-dia',
      papel && `cal-reserva-dia--${papel}`,
      enRango && 'cal-reserva-dia--rango',
      motivo && `cal-reserva-dia--${GRUPO_DE_MOTIVO[motivo]}`
    ]
      .filter(Boolean)
      .join(' ');
    // Entrega y recogida se anuncian siempre como tales, aunque el día no se pueda volver a pulsar. Un
    // día que no se puede elegir dice también por qué.
    const etiqueta = `${fechaLarga(fecha)}${
      papel ? `, ${papel}` : motivo ? `, no disponible: ${textoMotivo(motivo, disponibilidad.reglas)}` : ''
    }`;
    // Una recogida que no sirve como entrega no se puede volver a pulsar, pero no se desactiva del
    // todo (aria-disabled): un botón desactivado suelta el foco justo después de elegirla.
    const soloAnunciado = !elegible && papel !== null;
    return (
      <button
        type="button"
        className={clases}
        aria-label={etiqueta}
        aria-pressed={papel !== null}
        disabled={!elegible && !soloAnunciado}
        aria-disabled={soloAnunciado || undefined}
        onClick={() => {
          if (elegible) onCambiar(seleccionTrasElegir(seleccion, fecha));
        }}
      >
        {Number(fecha.slice(8))}
      </button>
    );
  };

  // Mes anterior y siguiente: en el primer y el último mes no hacen nada. Van con aria-disabled y no
  // con disabled porque se llega al límite pulsándolos, y un botón desactivado soltaría el foco.
  const navegar = (etiqueta, simbolo, bloqueado, paso) => (
    <button
      type="button"
      className="cal-reserva-nav"
      aria-label={etiqueta}
      aria-disabled={bloqueado || undefined}
      onClick={() => {
        if (!bloqueado) setMesElegido(sumarMeses(mes, paso));
      }}
    >
      {simbolo}
    </button>
  );

  return (
    <div className="cal-reserva">
      <div className="cal-reserva-cabecera">
        {navegar('Mes anterior', '‹', mes <= primero, -1)}
        <h3 id={idMes} className="cal-reserva-mes" aria-live="polite">
          {conMayuscula(nombreDelMes(mes))}
        </h3>
        {navegar('Mes siguiente', '›', mes >= ultimo, 1)}
      </div>

      <table className="cal-reserva-tabla" aria-labelledby={idMes}>
        <thead>
          <tr>
            {DIAS_SEMANA.map(([corto, largo]) => (
              <th key={largo} scope="col">
                <abbr title={largo}>{corto}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanasDelMes(mes).map((semana) => (
            <tr key={semana.find(Boolean)}>
              {semana.map((fecha, i) => (
                <td key={fecha || `hueco-${i}`}>{fecha && dia(fecha)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="cal-reserva-leyenda">
        <li className="cal-reserva-leyenda--libre">Libre</li>
        <li className="cal-reserva-leyenda--ocupado">Ocupado</li>
        <li className="cal-reserva-leyenda--fuera">Fuera de plazo</li>
        <li className="cal-reserva-leyenda--elegido">Tus fechas</li>
      </ul>
      {textoPlazos(disponibilidad.reglas) && (
        <p className="cal-reserva-reglas">{textoPlazos(disponibilidad.reglas)}</p>
      )}

      <div className="cal-reserva-pie">
        <p className="cal-reserva-instrucciones" aria-live="polite" tabIndex={-1} ref={instruccionesRef}>
          {instrucciones(seleccion)}
        </p>
        {inicio && (
          <button
            type="button"
            className="cal-reserva-borrar"
            onClick={() => {
              onCambiar({ inicio: null, fin: null });
              // El botón desaparece: el foco pasa a las instrucciones ("Elige el día de entrega.").
              instruccionesRef.current.focus();
            }}
          >
            Borrar fechas
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarioReserva;
