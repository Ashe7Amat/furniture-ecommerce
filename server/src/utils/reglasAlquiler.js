// Reglas del alquiler por fechas (docs/reservas-diseno.md, secciones 2.1 y 5; decisión T10).
//
// Son constantes de código y no una tabla: cambiarlas es un despliegue revisado, sin migraciones.
// Cada reserva guarda su propio desglose con `version`, así que cambiar una regla no altera lo que
// ya se aceptó. Sube `version` cada vez que cambie algo que afecte al precio.
//
// LOS VALORES SON PROVISIONALES: son los valores por defecto del diseño y están pendientes de
// confirmar con el cliente (sección 10.1 del diseño). Los que dependen de una pregunta concreta lo
// dicen al lado.
// La fianza, en % del alquiler (R-e, decisión de Ashe del 29 oct: 30 %). Se puede cambiar sin
// tocar el código con FIANZA_PORCENTAJE (un entero de 0 a 100; 0 = sin fianza); un valor que no lo
// sea se ignora y se usa el 30 %, para no cobrar nunca una fianza absurda por una errata.
const FIANZA_PORCENTAJE_POR_DEFECTO = 30;
const leerFianzaPorcentaje = (valor = process.env.FIANZA_PORCENTAJE) => {
  if (valor === undefined || valor === '') return FIANZA_PORCENTAJE_POR_DEFECTO;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > 100) {
    console.error(
      `FIANZA_PORCENTAJE="${valor}" no es un entero de 0 a 100: se usa el ${FIANZA_PORCENTAJE_POR_DEFECTO} %.`
    );
    return FIANZA_PORCENTAJE_POR_DEFECTO;
  }
  return numero;
};

const REGLAS_ALQUILER = Object.freeze({
  // 2 (29 oct): la fianza y el tope de la recogida a 165 días de la reserva.
  version: 2,

  // Los días facturados no son una regla configurable: son bloques de 24 h desde la hora de entrega
  // (decisión de Ashe, 13 oct 2026; ver diasFacturados en precioReserva.js).

  // Límites de la duración, en días facturados (pregunta 9). No hay alquileres de menos de un día
  // (pregunta 4, decidido el 13 oct): la recogida es, como pronto, al día siguiente de la entrega.
  duracionMinDias: 1,
  duracionMaxDias: 180,

  // Antelación: la entrega más temprana es hoy + antelacionMinDias, y la más tardía, hoy +
  // antelacionMaxMeses (pregunta 10). Ojo: la ficha dice hoy "1-2 semanas" de transporte, y eso
  // contradice las 48 h (pregunta 8).
  antelacionMinDias: 2,
  antelacionMaxMeses: 6,

  // La recogida pactada, como mucho a estos días de hoy (decisión de Ashe del 29 oct): la fianza se
  // devuelve con un reembolso del mismo pago, y así queda dentro de los 180 días desde el cobro con
  // 15 días para revisar la pieza. Junto con la antelación y la duración máxima, manda la más corta.
  diasMaxHastaRecogida: 165,

  // La fianza (6.6, opción A: se cobra con el alquiler y se devuelve tras revisar la pieza): este %
  // del importe del alquiler, ya con el descuento y sin los trayectos. Redondeada al céntimo.
  fianzaPorcentaje: leerFianzaPorcentaje(),

  // Cuánto se tarda como mucho en pagar una reserva (6.3). La reserva provisional dura lo mismo que
  // la sesión de pago de Stripe, que no se puede alargar una vez creada (30 min es lo mínimo que
  // admite Stripe, y 24 h lo máximo), más una gracia para que el aviso de un pago hecho en el último
  // minuto llegue antes de que otra persona pueda quedarse esas fechas. No cambian el precio.
  duracionSesionMin: 30,
  graciaWebhookMin: 15,

  // Días libres entre una reserva y la siguiente de la misma pieza (pregunta 15). Se copia en cada
  // reserva al crearla (T7).
  diasMargen: 2,

  // Descuento por duración, escalonado: el porcentaje del mayor tramo alcanzado se aplica a todo el
  // alquiler (5.2, pregunta 11). Los porcentajes están sin definir; con 0 no hay descuento.
  tramosDescuento: Object.freeze([
    Object.freeze({ desdeDias: 7, porcentaje: 0 }),
    Object.freeze({ desdeDias: 30, porcentaje: 0 })
  ]),

  // Coste de cada trayecto, en céntimos con IVA incluido (5.3, pregunta 7: SIN DECIDIR si va
  // incluido o aparte). 0 = incluido en el precio.
  tarifasTrayectoCentimos: Object.freeze({ domicilio: 0, tienda: 0 }),

  // Política de cancelación (8.4): 'manual' = sin reembolso automático, decide el administrador,
  // hasta que el asesor legal valide la tabla del cliente. Se copia en cada reserva al aceptarla.
  politicaCancelacion: 'manual',

  // Tipo de IVA por concepto, en % (5.5, pregunta 6: lo confirma el asesor del cliente). Vacío
  // mientras tanto: los importes son totales con IVA incluido y el desglose deja el tipo y la cuota
  // en null. No se incrusta ningún tipo en el código hasta tenerlo.
  ivaPorConcepto: Object.freeze({})
});

module.exports = { REGLAS_ALQUILER, leerFianzaPorcentaje, FIANZA_PORCENTAJE_POR_DEFECTO };
