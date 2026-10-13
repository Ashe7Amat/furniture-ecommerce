// Reglas del alquiler por fechas (docs/reservas-diseno.md, secciones 2.1 y 5; decisión T10).
//
// Son constantes de código y no una tabla: cambiarlas es un despliegue revisado, sin migraciones.
// Cada reserva guarda su propio desglose con `version`, así que cambiar una regla no altera lo que
// ya se aceptó. Sube `version` cada vez que cambie algo que afecte al precio.
//
// TODOS LOS VALORES SON PROVISIONALES: son los valores por defecto del diseño y están pendientes
// de confirmar con el cliente (sección 10.1 del diseño). Los que dependen de una pregunta concreta
// lo dicen al lado.
const REGLAS_ALQUILER = Object.freeze({
  version: 1,

  // Cómo se cuentan los días facturados (pregunta 3 del cliente, decisión T3). Con entrega el
  // lunes 1 y recogida el miércoles 3:
  // - 'noches': 2 días (fin − inicio, como las noches de un hotel). Valor por defecto del diseño.
  // - 'ambos_extremos': 3 días (fin − inicio + 1).
  // Solo cambia el precio: en las dos, la recogida tiene que ser posterior a la entrega, y lo que
  // ocupa el calendario de la pieza es lo mismo.
  conteoDias: 'noches',

  // Límites de la duración, en días facturados (pregunta 9; el mínimo depende también de la 4, los
  // alquileres de menos de un día, que este modelo por días no admite).
  duracionMinDias: 1,
  duracionMaxDias: 180,

  // Antelación: la entrega más temprana es hoy + antelacionMinDias, y la más tardía, hoy +
  // antelacionMaxMeses (pregunta 10). Ojo: la ficha dice hoy "1-2 semanas" de transporte, y eso
  // contradice las 48 h (pregunta 8).
  antelacionMinDias: 2,
  antelacionMaxMeses: 6,

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

  // Tipo de IVA por concepto, en % (5.5, pregunta 6: lo confirma el asesor del cliente). Vacío
  // mientras tanto: los importes son totales con IVA incluido y el desglose deja el tipo y la cuota
  // en null. No se incrusta ningún tipo en el código hasta tenerlo.
  ivaPorConcepto: Object.freeze({})
});

module.exports = { REGLAS_ALQUILER };
