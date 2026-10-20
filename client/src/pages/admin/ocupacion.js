// Cómo ocupa cada reserva los días de una pieza, para los dos calendarios de «Reservas» (el de una
// pieza, CalendarioPieza.jsx, y la vista general, VistaGeneral.jsx; docs/reservas-diseno.md, 8.2).
// Lo que llega del servidor (GET /api/admin/reservas/calendario) son las reservas con sus fechas:
//   - `fecha_inicio`: el primer día en que la pieza está reservada;
//   - `fin_ocupacion`: el día en que vuelve (exclusivo), o null si no tiene fin (una venta);
//   - `ocupada_hasta`: el primer día libre después del margen (exclusivo), o null sin fin.
// Un día entre `fecha_inicio` y `fin_ocupacion` es de reserva; entre `fin_ocupacion` y `ocupada_hasta`,
// de margen (la pieza descansa antes de la siguiente). La base de datos impide que dos reservas de
// una pieza se solapen, margen incluido.
import { diasEntre, fechaCorta, fechaLarga, sumarDias, textoDias } from '../../utils/reservas';

// El aspecto de una reserva en los calendarios (clase CSS y texto de la leyenda).
export const CLASES = ['alquiler', 'pendiente', 'retrasada', 'bloqueo', 'venta'];
export const claseDe = (reserva) => {
  if (reserva.tipo === 'venta') return 'venta';
  if (reserva.tipo === 'bloqueo') return 'bloqueo';
  if (reserva.retrasada) return 'retrasada';
  if (reserva.estado === 'pendiente') return 'pendiente';
  return 'alquiler';
};

const NOMBRE_TIPO = { alquiler: 'alquiler', bloqueo: 'bloqueo', venta: 'venta' };

// Qué es el día `dia` ('AAAA-MM-DD') para una reserva: 'reserva', 'margen' o null (no la ocupa).
export const parteDelDia = (reserva, dia) => {
  if (dia < reserva.fecha_inicio) return null;
  if (reserva.ocupada_hasta !== null && dia >= reserva.ocupada_hasta) return null;
  if (reserva.fin_ocupacion !== null && dia >= reserva.fin_ocupacion) return 'margen';
  return 'reserva';
};

// Una retrasada tiene la pieza fuera aunque su reserva ya no la ocupe: desde que acaba su ocupación
// hasta hoy. Devuelve [desde, hasta) o null.
export const tramoDeRetraso = (reserva, hoy) =>
  reserva.retrasada && reserva.ocupada_hasta !== null && reserva.ocupada_hasta <= hoy
    ? { desde: reserva.ocupada_hasta, hasta: sumarDias(hoy, 1) }
    : null;

// Lo que pasa con una pieza un día: la reserva que lo ocupa (y si es de reserva o de margen) y la
// retrasada que la tiene fuera sin ocuparlo. `reservas` son las de esa pieza.
export const diaDeLaPieza = (reservas, dia, hoy) => {
  const reserva = reservas.find((r) => parteDelDia(r, dia) !== null) ?? null;
  const retraso =
    reservas.find((r) => {
      const tramo = tramoDeRetraso(r, hoy);
      return tramo && dia >= tramo.desde && dia < tramo.hasta;
    }) ?? null;
  return { reserva, parte: reserva ? parteDelDia(reserva, dia) : null, retraso };
};

// «alquiler A1B2C3D4 de Ana Pérez, confirmada», «bloqueo C3D4E5F6 (Exposición)», «venta E5F6A7B8».
export const describirReserva = (r) => {
  const quien = r.cliente ? ` de ${r.cliente}` : '';
  const base = `${NOMBRE_TIPO[r.tipo] ?? r.tipo} ${r.referencia}`;
  if (r.tipo === 'alquiler') return `${base}${quien}, ${r.etiqueta.toLowerCase()}`;
  return r.motivo ? `${base} (${r.motivo})` : base;
};

// Lo que lee el lector de pantalla de un día del calendario de una pieza.
export const textoDelDia = (dia, { reserva, parte, retraso }) => {
  const fecha = fechaLarga(dia);
  if (!reserva) {
    return retraso
      ? `${fecha}: libre en el calendario, pero la pieza sigue fuera, ${describirReserva(retraso)}`
      : `${fecha}: libre`;
  }
  const texto = parte === 'margen' ? `margen después de ${describirReserva(reserva)}` : describirReserva(reserva);
  return retraso
    ? `${fecha}: ${texto}; la pieza sigue fuera de ${describirReserva(retraso)}`
    : `${fecha}: ${texto}`;
};

// ─── La vista general: una fila por pieza y una columna por día ──────────────────────────────────

// [primera columna, última + 1] de las fechas [desde, hastaExclusivo) dentro de una ventana de `nDias`
// que empieza el día `inicio`, o null si no cae en ella. `hastaExclusivo` null = hasta el final.
const recorte = (desde, hastaExclusivo, inicio, nDias) => {
  const primera = Math.max(diasEntre(inicio, desde), 0);
  const fin = Math.min(hastaExclusivo === null ? nDias : diasEntre(inicio, hastaExclusivo), nDias);
  return fin > primera ? [primera, fin] : null;
};

// Los tramos de una reserva dentro de la ventana, en columnas (0 = el primer día): los días reservados,
// los de margen y, si está retrasada, los que lleva la pieza fuera. `cortaIzq` y `cortaDer` dicen si
// la reserva sigue fuera de la ventana por ese lado.
export const tramosDeLaReserva = (reserva, inicio, nDias, hoy) => {
  const retraso = tramoDeRetraso(reserva, hoy);
  const ultimoDia = sumarDias(inicio, nDias);
  return {
    reservado: recorte(reserva.fecha_inicio, reserva.fin_ocupacion, inicio, nDias),
    margen:
      reserva.fin_ocupacion === null
        ? null
        : recorte(reserva.fin_ocupacion, reserva.ocupada_hasta, inicio, nDias),
    retraso: retraso ? recorte(retraso.desde, retraso.hasta, inicio, nDias) : null,
    cortaIzq: reserva.fecha_inicio < inicio,
    cortaDer: reserva.ocupada_hasta === null || reserva.ocupada_hasta > ultimoDia
  };
};

// Las filas de la rejilla: las piezas con algo en la ventana, por nombre, cada una con sus reservas y
// los tramos de cada una.
export const filasDeOcupacion = (reservas, inicio, nDias, hoy) => {
  const piezas = new Map();
  for (const reserva of reservas) {
    const tramos = tramosDeLaReserva(reserva, inicio, nDias, hoy);
    if (!tramos.reservado && !tramos.margen && !tramos.retraso) continue;
    if (!piezas.has(reserva.pieza.id)) piezas.set(reserva.pieza.id, { pieza: reserva.pieza, barras: [] });
    piezas.get(reserva.pieza.id).barras.push({ reserva, ...tramos });
  }
  return [...piezas.values()].sort((a, b) => a.pieza.nombre.localeCompare(b.pieza.nombre, 'es'));
};

// Los riesgos que la vista general existe para ver (8.2): una retrasada con otra reserva de la misma
// pieza a continuación. Las más cercanas primero.
const porDia = (a, b) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};
const cuando = (dias, fecha) => {
  if (dias < 0) return `tenía que empezar el ${fechaCorta(fecha)}`;
  if (dias === 0) return 'empieza hoy';
  if (dias === 1) return 'empieza mañana';
  return `empieza dentro de ${textoDias(dias)} (el ${fechaCorta(fecha)})`;
};
export const avisosDeOcupacion = (reservas, hoy) => {
  const avisos = [];
  for (const retrasada of reservas.filter((r) => r.retrasada)) {
    const siguiente = reservas
      .filter(
        (r) =>
          r.pieza.id === retrasada.pieza.id &&
          r.id !== retrasada.id &&
          r.fecha_inicio >= retrasada.fecha_inicio
      )
      .sort((a, b) => porDia(a.fecha_inicio, b.fecha_inicio))[0];
    if (!siguiente) continue;
    avisos.push({
      clave: `${retrasada.id}:${siguiente.id}`,
      dia: siguiente.fecha_inicio,
      texto:
        `${retrasada.pieza.nombre}: la reserva ${retrasada.referencia} está retrasada y la siguiente, ` +
        `${siguiente.referencia}, ${cuando(diasEntre(hoy, siguiente.fecha_inicio), siguiente.fecha_inicio)}.`
    });
  }
  return avisos.sort((a, b) => porDia(a.dia, b.dia));
};
