// Cómo ocupa cada reserva los días de una pieza, para los dos calendarios de «Reservas» (el de una
// pieza, CalendarioPieza.jsx, y la vista general, VistaGeneral.jsx; docs/reservas-diseno.md, 8.2).
// Lo que llega del servidor (GET /api/admin/reservas/calendario) son las reservas con sus fechas:
//   - `fecha_inicio`: el primer día en que la pieza está reservada;
//   - `fin_ocupacion`: el día en que vuelve (exclusivo), o null si no tiene fin (una venta);
//   - `ocupada_hasta`: el primer día libre después del margen (exclusivo), o null sin fin.
// Un día entre `fecha_inicio` y `fin_ocupacion` es de reserva; entre `fin_ocupacion` y `ocupada_hasta`,
// de margen (la pieza descansa antes de la siguiente). La base de datos impide que dos reservas de
// una pieza se solapen, margen incluido.
import { diasEntre, fechaCorta, fechaLarga, nombreDelMes, sumarDias, textoDias } from '../../utils/reservas';
import { momento } from './reservasAdmin';

// El aspecto de una reserva en los calendarios: la clase CSS de cada uno y su texto en la leyenda. Cada
// uno se distingue también por el dibujo (relleno, rayas, puntos), no solo por el color.
export const LEYENDA = [
  ['alquiler', 'Alquiler'],
  ['pendiente', 'Esperando pago'],
  ['retrasada', 'Retrasada: la pieza sigue fuera'],
  ['bloqueo', 'Bloqueo'],
  ['venta', 'Venta'],
  ['margen', 'Margen: la pieza descansa']
];
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

// Lo que lee el lector de pantalla de la barra de una reserva en la vista general.
export const textoDeBarra = (r) => {
  const base = describirReserva(r);
  if (r.fin_ocupacion === null) return `${base}, desde el ${fechaCorta(r.fecha_inicio)}, sin fin`;
  const margen = r.dias_margen > 0 ? `, con ${textoDias(r.dias_margen)} de margen` : '';
  return `${base}, del ${fechaCorta(r.fecha_inicio)} al ${fechaCorta(r.fin_ocupacion)}${margen}`;
};
// Y el de la franja roja de una retrasada: los días en que la pieza sigue fuera sin que nada la reserve.
export const textoDeRetraso = (r) =>
  `${describirReserva(r)}: la recogida estaba prevista el ${fechaCorta(r.fecha_fin)} y la pieza sigue fuera`;

// Los datos de una reserva para el detalle que se abre al pulsarla, [etiqueta, valor], solo los que
// tienen valor. Es lo de la tarjeta de la lista, sin importes ni contacto (el calendario no los trae).
export const filasDeDetalle = (r) =>
  (r.tipo === 'alquiler'
    ? [
        ['Cliente', r.cliente],
        ['Entrega', momento(r.fecha_inicio, r.hora_entrega)],
        ['Recogida', r.fecha_fin && momento(r.fecha_fin, r.hora_recogida)],
        // Una devuelta ocupa hasta el día real de la devolución: eso no es una ampliación.
        [
          'Ocupación ampliada hasta',
          r.estado !== 'devuelta' && r.fin_ocupacion && r.fin_ocupacion !== r.fecha_fin && fechaCorta(r.fin_ocupacion)
        ],
        ['Margen', r.dias_margen > 0 && `${textoDias(r.dias_margen)} después de la recogida`],
        ['Libre de nuevo el', r.ocupada_hasta && fechaCorta(r.ocupada_hasta)]
      ]
    : [
        ['Desde', fechaCorta(r.fecha_inicio)],
        ['Libre de nuevo el', r.fecha_fin && fechaCorta(r.fecha_fin)],
        ['Motivo', r.motivo]
      ]
  ).filter(([, valor]) => valor);

// «3 reservas en noviembre de 2026»
export const textoReservasDelMes = (n, mes) => {
  if (n === 0) return `Ninguna reserva en ${nombreDelMes(mes)}.`;
  return `${n === 1 ? '1 reserva' : `${n} reservas`} en ${nombreDelMes(mes)}.`;
};
// «2 piezas con reservas en los 30 días que se ven»
export const textoPiezasConReservas = (n, dias) => {
  if (n === 0) return `Ninguna pieza tiene reservas en los ${dias} días que se ven.`;
  return `${n === 1 ? '1 pieza tiene' : `${n} piezas tienen`} reservas en los ${dias} días que se ven.`;
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

// Los riesgos que la vista general existe para ver (8.2). El overbooking no está entre ellos: lo impide la
// base de datos. Son tres: una retrasada con otra reserva de la misma pieza a continuación, dos alquileres
// seguidos sin un día de sobra y un alquiler sin la hora de entrega o de recogida. Los más cercanos primero.
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

const avisosDeRetraso = (reservas, hoy) => {
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
      tipo: 'retraso',
      dia: siguiente.fecha_inicio,
      texto:
        `${retrasada.pieza.nombre}: la reserva ${retrasada.referencia} está retrasada y la siguiente, ` +
        `${siguiente.referencia}, ${cuando(diasEntre(hoy, siguiente.fecha_inicio), siguiente.fecha_inicio)}.`
    });
  }
  return avisos;
};

// Dos alquileres de una pieza uno detrás de otro: la segunda empieza el mismo día en que la primera
// deja la pieza libre. Está permitido, pero cualquier retraso de la primera la deja sin pieza. Las
// retrasadas ya tienen su aviso, y una que ya empezó no se puede retrasar.
const avisosDeMargenJusto = (reservas, hoy) => {
  const avisos = [];
  const porPieza = new Map();
  for (const r of reservas.filter((x) => x.tipo === 'alquiler')) {
    if (!porPieza.has(r.pieza.id)) porPieza.set(r.pieza.id, []);
    porPieza.get(r.pieza.id).push(r);
  }
  for (const delaPieza of porPieza.values()) {
    delaPieza.sort((a, b) => porDia(a.fecha_inicio, b.fecha_inicio));
    for (let i = 0; i + 1 < delaPieza.length; i += 1) {
      const [antes, despues] = [delaPieza[i], delaPieza[i + 1]];
      if (antes.retrasada || antes.estado === 'devuelta' || despues.fecha_inicio < hoy) continue;
      if (antes.ocupada_hasta !== despues.fecha_inicio) continue;
      avisos.push({
        clave: `${antes.id}:${despues.id}:justo`,
        tipo: 'justo',
        dia: despues.fecha_inicio,
        texto:
          `${antes.pieza.nombre}: las reservas ${antes.referencia} y ${despues.referencia} van seguidas, sin ningún ` +
          `día de sobra: la pieza queda libre el ${fechaCorta(antes.ocupada_hasta)} y ${despues.referencia} empieza ese día.`
      });
    }
  }
  return avisos;
};

// Un alquiler confirmado sin hora de entrega, o por recoger sin hora de recogida: nadie ha acordado cuándo.
const avisosSinHora = (reservas, hoy) => {
  const avisos = [];
  for (const r of reservas.filter((x) => x.tipo === 'alquiler' && !x.retrasada)) {
    if (r.estado === 'confirmada' && !r.hora_entrega && r.fecha_inicio >= hoy) {
      avisos.push({
        clave: `${r.id}:sin-hora-entrega`,
        tipo: 'sin_hora',
        dia: r.fecha_inicio,
        texto: `${r.pieza.nombre}: la reserva ${r.referencia} no tiene hora de entrega (el ${fechaCorta(r.fecha_inicio)}).`
      });
    }
    if (['confirmada', 'en_curso'].includes(r.estado) && r.fecha_fin && !r.hora_recogida && r.fecha_fin >= hoy) {
      avisos.push({
        clave: `${r.id}:sin-hora-recogida`,
        tipo: 'sin_hora',
        dia: r.fecha_fin,
        texto: `${r.pieza.nombre}: la reserva ${r.referencia} no tiene hora de recogida (el ${fechaCorta(r.fecha_fin)}).`
      });
    }
  }
  return avisos;
};

export const avisosDeOcupacion = (reservas, hoy) =>
  [...avisosDeRetraso(reservas, hoy), ...avisosDeMargenJusto(reservas, hoy), ...avisosSinHora(reservas, hoy)].sort(
    (a, b) => porDia(a.dia, b.dia)
  );
