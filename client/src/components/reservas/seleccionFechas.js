// Reglas del calendario de la ficha (docs/reservas-diseno.md, 6.2 y 7.1), puras para poder probarlas
// sin pintar nada. Trabajan con la respuesta de GET /api/muebles/:id/disponibilidad (`disp`) y con
// fechas 'AAAA-MM-DD' (utils/reservas.js). Lo que se decide aquí es solo orientativo: el servidor
// vuelve a comprobarlo todo al dar el precio y al crear la reserva.
import { sumarDias, diasEntre, mesDe, estaOcupado, ultimoFinPosible } from '../../utils/reservas';

// Nunca menos de 1 día: la recogida es siempre posterior a la entrega.
const duracionMinima = (reglas) => Math.max(1, reglas.duracion_min_dias);

// ¿Se puede empezar una reserva este día? Dentro de la antelación permitida, en un día libre y con
// sitio para la duración mínima antes de lo siguiente que esté ocupado (margen incluido).
export const esInicioPosible = (fecha, disp) => {
  if (fecha < disp.primer_inicio_posible || fecha > disp.ultimo_inicio_posible) return false;
  if (estaOcupado(fecha, disp.ocupado)) return false;
  const ultimo = ultimoFinPosible(fecha, disp.ocupado, disp.reglas.dias_margen);
  return ultimo === null || sumarDias(fecha, duracionMinima(disp.reglas)) <= ultimo;
};

// ¿Se puede recoger este día una reserva que empieza en `inicio`? Entre la duración mínima y la
// máxima, y sin que la reserva más su margen llegue a lo siguiente que esté ocupado. `ocupado` solo
// trae lo que cae dentro de la ventana consultada (`hasta`, exclusivo): lo que queda más allá no se
// sabe, así que no se ofrece una recogida cuyo margen salga de la ventana.
export const esFinPosible = (inicio, fecha, disp) => {
  const dias = diasEntre(inicio, fecha);
  if (dias < duracionMinima(disp.reglas) || dias > disp.reglas.duracion_max_dias) return false;
  if (disp.hasta && fecha > sumarDias(disp.hasta, -disp.reglas.dias_margen)) return false;
  const ultimo = ultimoFinPosible(inicio, disp.ocupado, disp.reglas.dias_margen);
  return ultimo === null || fecha <= ultimo;
};

// Qué hace un clic en un día con la selección { inicio, fin } que hay. Con la entrega elegida y sin
// recogida, un día posterior es la recogida, la misma entrega deshace la selección y un día anterior
// empieza otra. En cualquier otro caso, el día es la nueva entrega.
export const seleccionTrasElegir = ({ inicio, fin }, fecha) => {
  if (inicio && !fin) {
    if (fecha === inicio) return { inicio: null, fin: null };
    if (fecha > inicio) return { inicio, fin: fecha };
  }
  return { inicio: fecha, fin: null };
};

// ¿Se puede pulsar el día? Solo lo que lleva a una selección válida (ver seleccionTrasElegir).
export const diaElegible = ({ inicio, fin }, fecha, disp) =>
  inicio && !fin && fecha > inicio ? esFinPosible(inicio, fecha, disp) : esInicioPosible(fecha, disp);

// Por qué un día no se puede pulsar, para decírselo a la clienta (el color en el calendario y el nombre
// que oyen los lectores de pantalla). null si se puede pulsar. Con la entrega elegida y sin recogida, un
// día posterior se valora como recogida; en cualquier otro caso, como entrega.
//   ocupado, sin_hueco ......... lo ocupa otra reserva (o su margen), o no cabe un alquiler antes de la siguiente
//   pasado, antelacion, lejos ... fuera del plazo para reservar
//   duracion_min, duracion_max . la recogida deja el alquiler más corto o más largo de lo permitido
export const motivoNoElegible = (seleccion, fecha, disp) => {
  if (diaElegible(seleccion, fecha, disp)) return null;
  const { inicio, fin } = seleccion;
  if (inicio && !fin && fecha > inicio) {
    const ultimo = ultimoFinPosible(inicio, disp.ocupado, disp.reglas.dias_margen);
    if (ultimo !== null && fecha > ultimo) return 'ocupado';
    const dias = diasEntre(inicio, fecha);
    if (dias > disp.reglas.duracion_max_dias) return 'duracion_max';
    if (dias < duracionMinima(disp.reglas)) return 'duracion_min';
    return 'lejos';
  }
  if (fecha < disp.hoy) return 'pasado';
  if (fecha < disp.primer_inicio_posible) return 'antelacion';
  if (fecha > disp.ultimo_inicio_posible) return 'lejos';
  return estaOcupado(fecha, disp.ocupado) ? 'ocupado' : 'sin_hueco';
};

// Cómo se pinta cada motivo: "ocupado" (rayado, lo tiene otra reserva) o "fuera" (apagado, fuera de plazo).
export const GRUPO_DE_MOTIVO = {
  ocupado: 'ocupado',
  sin_hueco: 'ocupado',
  pasado: 'fuera',
  antelacion: 'fuera',
  lejos: 'fuera',
  duracion_min: 'fuera',
  duracion_max: 'fuera'
};

// Los meses que se pueden ver: desde el de hoy hasta el de la última recogida posible.
export const mesesVisibles = (disp) => ({
  primero: mesDe(disp.hoy),
  ultimo: mesDe(sumarDias(disp.ultimo_inicio_posible, disp.reglas.duracion_max_dias))
});
