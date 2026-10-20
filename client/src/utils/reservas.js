// Ayudas compartidas de las reservas por fechas (docs/reservas-diseno.md): el interruptor del
// cliente y las fechas, que van SIEMPRE como texto 'AAAA-MM-DD' en hora de Madrid (6.2). Nunca
// `new Date('2026-10-01')`: en un navegador con zona horaria negativa sería el día anterior. Las
// cuentas se hacen en UTC sobre el texto, así que no dependen de la zona del navegador.

// Interruptor del cliente (9.1). Apagado, que es lo que pasa si no se pone, la web se comporta como
// antes de las reservas aunque el código esté desplegado. Solo "true" lo enciende. Es una función,
// y no una constante, para que los tests puedan cambiarlo con vi.stubEnv.
export const reservasActivas = () => import.meta.env.VITE_RESERVAS_ACTIVAS === 'true';

const MS_DIA = 24 * 60 * 60 * 1000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

const aMs = (fecha) => {
  const [, a, m, d] = FORMATO.exec(fecha);
  return Date.UTC(Number(a), Number(m) - 1, Number(d));
};
const desdeMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export const esFecha = (texto) => typeof texto === 'string' && FORMATO.test(texto);
export const sumarDias = (fecha, dias) => desdeMs(aMs(fecha) + dias * MS_DIA);
export const diasEntre = (desde, hasta) => Math.round((aMs(hasta) - aMs(desde)) / MS_DIA);

// 'AAAA-MM' del mes de una fecha, y el primer día de un mes.
export const mesDe = (fecha) => fecha.slice(0, 7);
export const primerDiaDe = (mes) => `${mes}-01`;
export const sumarMeses = (mes, n) => {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

// Día de la semana empezando en lunes (0 = lunes ... 6 = domingo).
export const diaDeLaSemana = (fecha) => (new Date(aMs(fecha)).getUTCDay() + 6) % 7;

// Las semanas de un mes para pintarlo en una rejilla de lunes a domingo: cada semana es una lista
// de 7 fechas, con null en los huecos de antes del día 1 y de después del último.
export const semanasDelMes = (mes) => {
  const primero = primerDiaDe(mes);
  const dias = diasEntre(primero, primerDiaDe(sumarMeses(mes, 1)));
  const celdas = [
    ...Array(diaDeLaSemana(primero)).fill(null),
    ...Array.from({ length: dias }, (_, i) => sumarDias(primero, i))
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// "noviembre de 2026"
export const nombreDelMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
};
// "02/11/2026", como en los emails y los mensajes del servidor.
export const fechaCorta = (fecha) => fecha.split('-').reverse().join('/');
// "2 de noviembre de 2026", como escribe las fechas el resto de la web (sin el día de la semana).
export const fechaSinDia = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};
// "lunes, 2 de noviembre de 2026", para los lectores de pantalla y los resúmenes.
export const fechaLarga = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return `${DIAS[diaDeLaSemana(fecha)]}, ${d} de ${MESES[m - 1]} de ${a}`;
};

// "14:35": la hora de un instante en Madrid, que es la del negocio y la de las reservas.
export const horaDeMadrid = (instante) =>
  new Date(instante).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Madrid'
  });

// "1 día" / "3 días"
export const textoDias = (n) => (n === 1 ? '1 día' : `${n} días`);
// "1 mes" / "6 meses"
export const textoMeses = (n) => (n === 1 ? '1 mes' : `${n} meses`);

// Importes en céntimos (como los devuelve el servidor) a "1.234,50 €".
const formatoEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  useGrouping: true
});
export const eurosDeCentimos = (centimos) => formatoEuros.format(centimos / 100);

// Horas que se ofrecen para entregar y recoger: de 9:00 a 20:00, cada media hora. PROVISIONAL: el
// cliente no ha fijado franjas (el servidor acepta cualquier HH:MM); se cambia aquí.
export const HORAS_TRAYECTO = Array.from({ length: 23 }, (_, i) => {
  const minutos = 9 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
});

// ¿El día está dentro de algún rango ocupado [desde, hasta)? (hasta null = sin fin)
export const estaOcupado = (fecha, ocupado) =>
  ocupado.some((o) => o.desde <= fecha && (o.hasta === null || fecha < o.hasta));

// El último día en que se puede recoger una reserva que empieza en `inicio` sin chocar con lo
// ocupado: la reserva ocupa [inicio, fin + margen), así que el fin + margen no puede pasar del
// principio de lo siguiente. null si no hay nada después.
export const ultimoFinPosible = (inicio, ocupado, diasMargen) => {
  const siguientes = ocupado.filter((o) => o.desde > inicio).map((o) => o.desde);
  if (siguientes.length === 0) return null;
  const primero = siguientes.reduce((a, b) => (b < a ? b : a));
  return sumarDias(primero, -diasMargen);
};
