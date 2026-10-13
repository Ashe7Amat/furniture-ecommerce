// Fechas de las reservas por fechas (docs/reservas-diseno.md, sección 3.6).
//
// Una reserva trabaja con días de calendario ('YYYY-MM-DD'), sin hora ni zona. El servidor de
// Vercel y la base de datos van en UTC, pero el negocio va en hora de Madrid: entre las 22:00/23:00
// y las 00:00 UTC (según sea horario de verano o de invierno) "hoy" en Madrid ya es el día
// siguiente. Por eso:
// - "hoy" se calcula siempre aquí, con hoyEnMadrid(), nunca con new Date().toISOString();
// - las cuentas entre fechas se hacen como días de calendario (en UTC, que no cambia de hora), así
//   que un alquiler del 24 al 27 de octubre de 2026 son 3 días aunque el 25 tenga 25 horas.

const MS_DIA = 24 * 60 * 60 * 1000;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

const formateadorMadrid = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// El día de calendario en Madrid en el instante `ahora` (por defecto, ya). Se le puede pasar el
// instante para que los tests no dependan del reloj.
const hoyEnMadrid = (ahora = new Date()) => formateadorMadrid.format(ahora);

const aMs = (fecha) => {
  const [, a, m, d] = FORMATO_FECHA.exec(fecha);
  return Date.UTC(Number(a), Number(m) - 1, Number(d));
};
const desdeMs = (ms) => new Date(ms).toISOString().slice(0, 10);

// 'YYYY-MM-DD' y un día que existe de verdad (no '2026-02-30').
const esFechaValida = (texto) =>
  typeof texto === 'string' && FORMATO_FECHA.test(texto) && desdeMs(aMs(texto)) === texto;

const sumarDias = (fecha, dias) => desdeMs(aMs(fecha) + dias * MS_DIA);

// Días de calendario de `desde` a `hasta` (negativo si `hasta` va antes).
const diasEntre = (desde, hasta) => Math.round((aMs(hasta) - aMs(desde)) / MS_DIA);

// Suma meses de calendario. Si el día no existe en el mes de llegada, se queda en el último día de
// ese mes: del 31 de agosto, 6 meses después es el 28 (o 29) de febrero, no el 3 de marzo.
const sumarMeses = (fecha, meses) => {
  const [, a, m, d] = FORMATO_FECHA.exec(fecha).map(Number);
  const indiceMes = m - 1 + meses;
  const anio = a + Math.floor(indiceMes / 12);
  const mes = ((indiceMes % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return desdeMs(Date.UTC(anio, mes, Math.min(d, ultimoDia)));
};

// '2026-10-25' → '25/10/2026', para los mensajes que se enseñan al cliente.
const fechaLegible = (fecha) => fecha.split('-').reverse().join('/');

module.exports = { hoyEnMadrid, esFechaValida, sumarDias, diasEntre, sumarMeses, fechaLegible };
