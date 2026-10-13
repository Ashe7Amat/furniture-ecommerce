// Disponibilidad de una pieza para alquilar y para comprar (docs/reservas-diseno.md, 7.1 y 6.7).
//
// Funciones puras: reciben las filas de `reservas` ya leídas, "hoy" (en Madrid) y el instante
// actual, y no tocan la base de datos ni el reloj. El controlador (reservasController.js) hace la
// consulta y les pasa el resultado.
const { ErrorValidacion } = require('./errores');
const { REGLAS_ALQUILER } = require('./reglasAlquiler');
const { limitesDeInicio } = require('./precioReserva');
const { esFechaValida, sumarDias, sumarMeses, diasEntre } = require('./fechasMadrid');

// Los estados que ocupan el calendario: los mismos que el predicado de la restricción de exclusión
// reservas_sin_solape (3.4). Cancelada y expirada no ocupan.
const ESTADOS_QUE_OCUPAN = Object.freeze(['pendiente', 'confirmada', 'en_curso', 'devuelta']);

// Cómo se pinta cada clase de fila en el calendario. Nunca sale ningún dato del cliente, y una
// reserva provisional cuenta como "reservado" (no se revela que alguien está pagando).
const TIPO_EN_CALENDARIO = Object.freeze({
  alquiler: 'reservado',
  bloqueo: 'bloqueado',
  venta: 'vendido'
});

// Lo más que se puede pedir de una vez (7.1): unos 12 meses.
const MAX_DIAS_CONSULTA = 366;

// Postgres devuelve un daterange como texto canónico, siempre "[desde,hasta)": "[2030-06-10,2030-06-15)",
// "[2030-06-19,)" si no tiene fin (una venta) o "empty" si es un rango vacío (no ocupa nada).
const FORMATO_RANGO = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})?\)$/;
const leerRango = (texto) => {
  const partes = FORMATO_RANGO.exec(texto ?? '');
  return partes ? { desde: partes[1], hasta: partes[2] ?? null } : null;
};

// Una fila ocupa el calendario si su estado lo ocupa, salvo una provisional ya caducada: el servidor
// la marca expirada antes de cada escritura (4.6), así que leer con otro criterio haría que la
// ficha dijera "ocupado" donde la reserva sí entraría.
const ocupaElCalendario = (fila, ahora) =>
  ESTADOS_QUE_OCUPAN.includes(fila.estado) &&
  !(fila.estado === 'pendiente' && new Date(fila.expira_en) < ahora);

// ¿Se solapan [desde, hasta) y el rango? (null = sin fin, en los dos).
const seSolapan = (rango, desde, hasta) =>
  (hasta === null || rango.desde < hasta) && (rango.hasta === null || rango.hasta > desde);

// Las fechas de ?desde=&hasta= de la consulta, con sus valores por defecto: de hoy a la última
// entrega posible más la duración máxima. Un `desde` anterior a hoy se lleva a hoy: el calendario
// no enseña el pasado.
const ventanaDeConsulta = ({ desde, hasta, hoy, reglas = REGLAS_ALQUILER }) => {
  const porDefecto = sumarDias(sumarMeses(hoy, reglas.antelacionMaxMeses), reglas.duracionMaxDias);
  for (const valor of [desde, hasta]) {
    if (valor !== undefined && !esFechaValida(valor)) {
      throw new ErrorValidacion('Las fechas tienen que ir en formato AAAA-MM-DD.');
    }
  }
  const inicio = desde && desde > hoy ? desde : hoy;
  const fin = hasta ?? porDefecto;
  if (fin <= inicio) {
    throw new ErrorValidacion('La fecha final tiene que ser posterior a la inicial.');
  }
  if (diasEntre(inicio, fin) > MAX_DIAS_CONSULTA) {
    throw new ErrorValidacion('Se pueden consultar como mucho 12 meses de una vez.');
  }
  return { desde: inicio, hasta: fin };
};

// La respuesta de GET /api/muebles/:id/disponibilidad. `filas` son las de la pieza que ocupan de hoy
// en adelante (con el margen incluido en rango_ocupado); `mueble` trae estado y precio_alquiler_dia.
const calcularDisponibilidad = ({
  mueble,
  filas,
  hoy,
  ahora,
  desde,
  hasta,
  mostrarPrecio,
  reglas = REGLAS_ALQUILER
}) => {
  const ocupadas = filas
    .filter((fila) => ocupaElCalendario(fila, ahora))
    .map((fila) => ({ tipo: fila.tipo, rango: leerRango(fila.rango_ocupado) }))
    .filter(({ rango }) => rango && seSolapan(rango, hoy, null));

  // Mientras muebles.estado se edite a mano (hasta el lanzamiento, R-f), una pieza marcada como
  // vendida en el panel cuenta como vendida aunque no tenga su fila de venta.
  const vendida = mueble.estado === 'vendido' || ocupadas.some((o) => o.tipo === 'venta');
  const precioCentimos = Math.round(Number(mueble.precio_alquiler_dia) * 100);
  const { primerInicio, ultimoInicio } = limitesDeInicio(hoy, reglas);

  // Comprable = nada la ocupa de hoy en adelante (la misma definición que usará el pago, 6.7). Una
  // pieza marcada a mano como alquilada (el alquiler sin fechas de antes, H7) tampoco.
  const comprable = !vendida && mueble.estado === 'disponible' && ocupadas.length === 0;
  let motivoNoComprable = null;
  if (vendida) motivoNoComprable = 'vendida';
  else if (mueble.estado !== 'disponible') motivoNoComprable = 'no_disponible';
  else if (!comprable) motivoNoComprable = 'reservas_activas';

  // Si lo único que impide comprar son reservas, desde qué día se podría entregar (la entrega
  // diferida, 6.7): el final de lo último que ocupa la pieza.
  const comprableDesde =
    motivoNoComprable === 'reservas_activas'
      ? ocupadas.map((o) => o.rango.hasta).reduce((a, b) => (b > a ? b : a))
      : null;

  return {
    mueble_id: mueble.id,
    zona_horaria: 'Europe/Madrid',
    hoy,
    desde,
    hasta,
    alquilable: !vendida && precioCentimos > 0,
    comprable,
    motivo_no_comprable: motivoNoComprable,
    comprable_desde: comprableDesde,
    precio_dia_centimos: mostrarPrecio && precioCentimos > 0 ? precioCentimos : null,
    reglas: {
      version: reglas.version,
      duracion_min_dias: reglas.duracionMinDias,
      duracion_max_dias: reglas.duracionMaxDias,
      antelacion_min_dias: reglas.antelacionMinDias,
      antelacion_max_meses: reglas.antelacionMaxMeses,
      dias_margen: reglas.diasMargen,
      tramos_descuento: reglas.tramosDescuento.map((t) => ({
        desde_dias: t.desdeDias,
        porcentaje: t.porcentaje
      }))
    },
    primer_inicio_posible: primerInicio,
    ultimo_inicio_posible: ultimoInicio,
    ocupado: ocupadas
      .filter(({ rango }) => seSolapan(rango, desde, hasta))
      .map(({ tipo, rango }) => ({
        desde: rango.desde,
        hasta: rango.hasta,
        tipo: TIPO_EN_CALENDARIO[tipo]
      }))
      .sort((a, b) => (a.desde < b.desde ? -1 : 1))
  };
};

module.exports = {
  ESTADOS_QUE_OCUPAN,
  MAX_DIAS_CONSULTA,
  leerRango,
  ocupaElCalendario,
  ventanaDeConsulta,
  calcularDisponibilidad
};
