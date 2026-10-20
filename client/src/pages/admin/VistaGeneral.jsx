import { useMemo, useRef, useState } from 'react';
import ReferenciaProducto from '../../components/ReferenciaProducto';
import DetalleOcupacion from './DetalleOcupacion';
import LeyendaOcupacion from './LeyendaOcupacion';
import useCalendarioReservas from './hooks/useCalendarioReservas';
import {
  avisosDeOcupacion,
  claseDe,
  filasDeOcupacion,
  textoDeBarra,
  textoDeRetraso,
  textoPiezasConReservas
} from './ocupacion';
import { diaDeLaSemana, diasEntre, fechaCorta, mesDe, nombreDelMes, sumarDias } from '../../utils/reservas';

// Cuántos días se ven. El servidor enseña hasta 100 seguidos.
const LARGOS = [30, 60];
// Cuánto se mueve la vista con «Semana anterior» y «Semana siguiente».
const SEMANA = 7;

// Los meses que cruza la ventana, con las columnas que ocupa cada uno (la primera columna es la 0).
const mesesDe = (dias) => {
  const meses = [];
  dias.forEach((dia, columna) => {
    const mes = mesDe(dia);
    const ultimo = meses[meses.length - 1];
    if (ultimo?.mes === mes) ultimo.hasta = columna + 1;
    else meses.push({ mes, desde: columna, hasta: columna + 1 });
  });
  return meses;
};

// La columna de la rejilla en que va un tramo [desde, hasta) de columnas de la ventana (la CSS cuenta desde 1).
const columnas = ([desde, hasta]) => `${desde + 1} / ${hasta + 1}`;

// La barra de una reserva en la fila de su pieza: su botón, con los días reservados y el margen
// pegado detrás, y debajo, si está retrasada, la franja de los días que lleva la pieza fuera.
const Barra = ({ barra, elegida, onElegir }) => {
  const { reserva, reservado, margen, retraso, cortaIzq, cortaDer } = barra;
  const tramos = [reservado, margen].filter(Boolean);
  const dias = (tramo) => (tramo ? tramo[1] - tramo[0] : 0);
  return (
    <>
      {tramos.length > 0 && (
        <button
          type="button"
          className={[
            'ocupacion-barra',
            `ocupacion-barra--${claseDe(reserva)}`,
            cortaIzq && 'es-cortada-izq',
            cortaDer && 'es-cortada-der',
            elegida && 'is-seleccionado'
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            gridColumn: columnas([Math.min(...tramos.map((t) => t[0])), Math.max(...tramos.map((t) => t[1]))]),
            gridTemplateColumns: `${dias(reservado)}fr ${dias(margen)}fr`
          }}
          aria-pressed={elegida}
          aria-label={textoDeBarra(reserva)}
          onClick={(evento) => onElegir(reserva, evento.currentTarget)}
        >
          <span className="ocupacion-barra-reserva" aria-hidden="true">{reservado ? reserva.referencia : ''}</span>
          <span className="ocupacion-barra-margen" aria-hidden="true" />
        </button>
      )}
      {retraso && (
        <button
          type="button"
          className={`ocupacion-fuera${elegida ? ' is-seleccionado' : ''}`}
          style={{ gridColumn: columnas(retraso) }}
          aria-pressed={elegida}
          aria-label={textoDeRetraso(reserva)}
          onClick={(evento) => onElegir(reserva, evento.currentTarget)}
        >
          <span aria-hidden="true">Fuera</span>
        </button>
      )}
    </>
  );
};

// La vista general (docs/reservas-diseno.md, 8.2): una fila por pieza y una columna por día, con una
// barra por reserva y el margen detrás, y encima los riesgos: lo que esta vista existe para ver. El
// overbooking no se previene aquí, lo impide la base de datos. Empieza hoy y se mueve de semana en semana.
// `hoy` es el día de ahora, para empezar.
const VistaGeneral = ({ hoy, version = 0, activo = true, onVer }) => {
  const [inicio, setInicio] = useState(hoy);
  const [nDias, setNDias] = useState(LARGOS[0]);
  const [seleccion, setSeleccion] = useState(null);
  const [intento, setIntento] = useState(0);
  // El botón pulsado: al cerrar el detalle el foco vuelve a él.
  const disparador = useRef(null);

  const hasta = sumarDias(inicio, nDias - 1);
  const { datos, error, cargando } = useCalendarioReservas({
    desde: inicio,
    hasta,
    version: `${version}.${intento}`,
    activo
  });

  const hoyReal = datos?.hoy ?? hoy;
  const dias = useMemo(() => Array.from({ length: nDias }, (_, i) => sumarDias(inicio, i)), [inicio, nDias]);
  const reservas = useMemo(() => datos?.reservas ?? [], [datos]);
  const filas = useMemo(() => filasDeOcupacion(reservas, inicio, nDias, hoyReal), [reservas, inicio, nDias, hoyReal]);
  const avisos = useMemo(() => avisosDeOcupacion(reservas, hoyReal), [reservas, hoyReal]);
  const columnaDeHoy = diasEntre(inicio, hoyReal);
  const elegida = reservas.find((r) => r.id === seleccion) ?? null;

  const mover = (n) => {
    setInicio((i) => sumarDias(i, n));
    setSeleccion(null);
  };
  const elegir = (reserva, boton) => {
    disparador.current = boton;
    setSeleccion(reserva.id === seleccion ? null : reserva.id);
  };
  const cerrarDetalle = () => {
    setSeleccion(null);
    disparador.current?.focus();
  };

  return (
    <div className="ocupacion ocupacion-general">
      <div className="ocupacion-navegacion">
        <button type="button" className="admin-btn-ghost" onClick={() => mover(-SEMANA)}>
          Semana anterior
        </button>
        <h3 className="ocupacion-titulo" aria-live="polite">
          Del {fechaCorta(inicio)} al {fechaCorta(hasta)}
        </h3>
        <button type="button" className="admin-btn-ghost" onClick={() => mover(SEMANA)}>
          Semana siguiente
        </button>
        <button
          type="button"
          className="admin-btn-ghost"
          disabled={inicio === hoyReal}
          onClick={() => {
            setInicio(hoyReal);
            setSeleccion(null);
          }}
        >
          Hoy
        </button>
      </div>
      <div className="reservas-vistas" role="group" aria-label="Cuántos días ver">
        {LARGOS.map((n) => (
          <button key={n} type="button" className="reservas-vista" aria-pressed={n === nDias} onClick={() => setNDias(n)}>
            {n} días
          </button>
        ))}
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
          <p className="ocupacion-resumen" role="status">{textoPiezasConReservas(filas.length, nDias)}</p>
          {datos.limitada && (
            <p className="reservas-busqueda-limite" role="status">
              Hay más reservas de las que caben en el calendario: faltan algunas. Elige menos días.
            </p>
          )}
          {avisos.length > 0 && (
            <section className="ocupacion-riesgos" aria-labelledby="ocupacion-riesgos-titulo">
              <h4 id="ocupacion-riesgos-titulo">A vigilar</h4>
              <ul>
                {avisos.map((aviso) => (
                  <li key={aviso.clave}>{aviso.texto}</li>
                ))}
              </ul>
            </section>
          )}
          {filas.length > 0 && (
            <div
              className="ocupacion-rejilla"
              role="region"
              aria-label="Rejilla de reservas por pieza y día; se desplaza hacia los lados"
              style={{ '--dias': nDias }}
              aria-busy={cargando}
            >
              <div className="ocupacion-cuerpo">
                <div className="ocupacion-cabecera" aria-hidden="true">
                  <div className="ocupacion-pieza-celda" />
                  <div className="ocupacion-escala">
                    <div className="ocupacion-meses">
                      {mesesDe(dias).map((m) => (
                        <span key={m.mes} style={{ gridColumn: columnas([m.desde, m.hasta]) }}>
                          {nombreDelMes(m.mes)}
                        </span>
                      ))}
                    </div>
                    <div className="ocupacion-numeros">
                      {dias.map((dia) => (
                        <span
                          key={dia}
                          className={[
                            diaDeLaSemana(dia) >= 5 && 'es-finde',
                            dia === hoyReal && 'es-hoy'
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {Number(dia.slice(8))}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <ul className="ocupacion-filas">
                  {filas.map(({ pieza, barras }) => (
                    <li key={pieza.id} className="ocupacion-fila">
                      <div className="ocupacion-pieza-celda">
                        <strong>{pieza.nombre}</strong>
                        <ReferenciaProducto referencia={pieza.referencia} className="reserva-ref" />
                      </div>
                      <div className="ocupacion-barras" role="group" aria-label={`Reservas de ${pieza.nombre}`}>
                        {columnaDeHoy >= 0 && columnaDeHoy < nDias && (
                          <span
                            className="ocupacion-hoy"
                            aria-hidden="true"
                            style={{ gridColumn: `${columnaDeHoy + 1} / ${columnaDeHoy + 2}` }}
                          />
                        )}
                        {barras.map((barra) => (
                          <Barra
                            key={barra.reserva.id}
                            barra={barra}
                            elegida={barra.reserva.id === seleccion}
                            onElegir={elegir}
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {elegida && <DetalleOcupacion reservas={[elegida]} onVer={onVer} onCerrar={cerrarDetalle} />}
    </div>
  );
};

export default VistaGeneral;
