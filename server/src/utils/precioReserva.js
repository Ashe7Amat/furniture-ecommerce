// Precio de una reserva de alquiler por fechas (docs/reservas-diseno.md, sección 5).
//
// Función pura: no lee la base de datos ni el reloj (la fecha de "hoy" se le pasa), para poder
// probarla con tablas de casos. La usarán el presupuesto que ve el cliente, la creación del pago y
// el cálculo de reembolsos, así que el precio se calcula en un solo sitio y nunca en el navegador.
//
// Todo en céntimos enteros (T10), y cada campo con importes lo dice en su nombre (`_centimos`):
// los euros con decimales solo aparecen al leer el precio de la pieza, y se pasan a céntimos una
// vez, al entrar. Los importes son totales con IVA incluido.
const { ErrorValidacion } = require('./errores');
const { REGLAS_ALQUILER } = require('./reglasAlquiler');
const {
  esFechaValida,
  esHoraValida,
  sumarDias,
  diasEntre,
  sumarMeses,
  fechaLegible
} = require('./fechasMadrid');

const dias = (n) => (n === 1 ? '1 día' : `${n} días`);

// Días que se cobran: bloques de 24 h desde la hora de entrega (decisión de Ashe, 13 oct 2026, a la
// pregunta 3). Del lunes 1 a las 10:00 al miércoles 3 a las 10:00 son 2 días, como las noches de un
// hotel; si la recogida es más tarde que esa hora (el miércoles a las 10:30), empieza un tercero.
// Se cuenta con la hora del reloj de Madrid y no con horas reales, así que un cambio de hora en
// medio (un día de 23 o 25 horas) no añade ni quita ningún día.
const diasFacturados = (fechaInicio, horaEntrega, fechaFin, horaRecogida) =>
  diasEntre(fechaInicio, fechaFin) + (horaRecogida > horaEntrega ? 1 : 0);

// Primer y último día en que puede empezar un alquiler reservado hoy, y el último en que puede
// terminar (la recogida pactada, diasMaxHastaRecogida). El último inicio deja sitio a la duración
// mínima antes de esa última recogida.
const limitesDeInicio = (hoy, reglas = REGLAS_ALQUILER) => {
  const ultimaRecogida = sumarDias(hoy, reglas.diasMaxHastaRecogida);
  const porAntelacion = sumarMeses(hoy, reglas.antelacionMaxMeses);
  const porRecogida = sumarDias(ultimaRecogida, -Math.max(1, reglas.duracionMinDias));
  return {
    primerInicio: sumarDias(hoy, reglas.antelacionMinDias),
    ultimoInicio: porRecogida < porAntelacion ? porRecogida : porAntelacion,
    ultimaRecogida
  };
};

// El mayor tramo alcanzado, o null si no se llega a ninguno.
const tramoPara = (n, reglas) =>
  reglas.tramosDescuento
    .filter((t) => n >= t.desdeDias)
    .reduce((mayor, t) => (!mayor || t.desdeDias > mayor.desdeDias ? t : mayor), null);

const importeAlquilerCentimos = (n, precioDiaCentimos, reglas) => {
  const subtotal = n * precioDiaCentimos;
  const tramo = tramoPara(n, reglas);
  const descuento = tramo ? Math.round((subtotal * tramo.porcentaje) / 100) : 0;
  return { subtotal, tramo, descuento, importe: subtotal - descuento };
};

// Una línea del desglose. Cada concepto lleva su propio tipo de IVA porque puede tributar distinto
// (5.5); mientras el asesor no lo confirme, tipo y cuota van en null.
const linea = (concepto, importe, reglas) => {
  const tipo = reglas.ivaPorConcepto[concepto];
  const tieneTipo = typeof tipo === 'number';
  return {
    concepto,
    importe_centimos: importe,
    tipo_iva: tieneTipo ? tipo : null,
    cuota_iva_centimos: tieneTipo ? Math.round((importe * tipo) / (100 + tipo)) : null
  };
};

const validarTrayecto = (valor, reglas, mensaje) => {
  if (typeof valor !== 'string' || !Object.hasOwn(reglas.tarifasTrayectoCentimos, valor)) {
    throw new ErrorValidacion(mensaje);
  }
  return reglas.tarifasTrayectoCentimos[valor];
};

// Calcula el presupuesto de alquilar una pieza de `fechaInicio` a las `horaEntrega` (día y hora de
// entrega, 'YYYY-MM-DD' y 'HH:MM' en hora de Madrid) a `fechaFin` a las `horaRecogida`. Lanza
// ErrorValidacion, con un mensaje que se puede enseñar tal cual, si la reserva incumple alguna regla.
const calcularPrecioReserva = ({
  precioDia,
  fechaInicio,
  horaEntrega,
  fechaFin,
  horaRecogida,
  entrega,
  recogida,
  hoy,
  reglas = REGLAS_ALQUILER
}) => {
  const precioDiaCentimos = Math.round(Number(precioDia) * 100);
  if (!Number.isFinite(precioDiaCentimos) || precioDiaCentimos <= 0) {
    throw new ErrorValidacion('Esta pieza no se puede alquilar.');
  }
  if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) {
    throw new ErrorValidacion('Elige las fechas de entrega y de recogida.');
  }
  if (!esHoraValida(horaEntrega) || !esHoraValida(horaRecogida)) {
    throw new ErrorValidacion('Elige la hora de entrega y la de recogida.');
  }
  // No hay alquileres de menos de un día (pregunta 4): la recogida es, como pronto, al día siguiente.
  if (fechaFin <= fechaInicio) {
    throw new ErrorValidacion('La recogida tiene que ser después del día de entrega.');
  }

  const { primerInicio, ultimoInicio, ultimaRecogida } = limitesDeInicio(hoy, reglas);
  if (fechaInicio < primerInicio) {
    throw new ErrorValidacion(
      `La entrega más temprana posible es el ${fechaLegible(primerInicio)}.`
    );
  }
  if (fechaInicio > ultimoInicio) {
    throw new ErrorValidacion(
      `Por ahora solo se puede reservar con entrega hasta el ${fechaLegible(ultimoInicio)}.`
    );
  }

  if (fechaFin > ultimaRecogida) {
    throw new ErrorValidacion(
      `Por ahora la recogida tiene que ser, como muy tarde, el ${fechaLegible(ultimaRecogida)}.`
    );
  }

  const n = diasFacturados(fechaInicio, horaEntrega, fechaFin, horaRecogida);
  if (n < reglas.duracionMinDias) {
    throw new ErrorValidacion(`El alquiler mínimo es de ${dias(reglas.duracionMinDias)}.`);
  }
  if (n > reglas.duracionMaxDias) {
    throw new ErrorValidacion(`El alquiler máximo es de ${dias(reglas.duracionMaxDias)}.`);
  }

  const importeEntrega = validarTrayecto(
    entrega,
    reglas,
    'Elige si la entrega es a domicilio o en la tienda.'
  );
  const importeRecogida = validarTrayecto(
    recogida,
    reglas,
    'Elige si la recogida es a domicilio o en la tienda.'
  );

  const alquiler = importeAlquilerCentimos(n, precioDiaCentimos, reglas);
  const fianza = Math.round((alquiler.importe * reglas.fianzaPorcentaje) / 100);
  return {
    version_reglas: reglas.version,
    fecha_inicio: fechaInicio,
    hora_entrega: horaEntrega,
    fecha_fin: fechaFin,
    hora_recogida: horaRecogida,
    dias: n,
    precio_dia_centimos: precioDiaCentimos,
    subtotal_alquiler_centimos: alquiler.subtotal,
    tramo: alquiler.tramo
      ? { desde_dias: alquiler.tramo.desdeDias, porcentaje: alquiler.tramo.porcentaje }
      : null,
    descuento_centimos: alquiler.descuento,
    entrega: { modo: entrega, importe_centimos: importeEntrega },
    recogida: { modo: recogida, importe_centimos: importeRecogida },
    // La fianza se cobra en el mismo pago y se devuelve tras la recogida (6.6): va en el total, en
    // su propia línea, y aparte para enseñarla como "reembolsable".
    fianza: { porcentaje: reglas.fianzaPorcentaje, importe_centimos: fianza },
    importe_total_centimos: alquiler.importe + importeEntrega + importeRecogida + fianza,
    lineas: [
      linea('alquiler', alquiler.importe, reglas),
      linea('entrega', importeEntrega, reglas),
      linea('recogida', importeRecogida, reglas),
      linea('fianza', fianza, reglas)
    ]
  };
};

// Duraciones en las que alquilar un día más sale más barato que uno menos (5.2): con un 20 % a
// partir de 7 días y 100 €/día, 6 días cuestan 600 € y 7, 560 €. Es habitual, pero el cliente tiene
// que saberlo antes de fijar los tramos. Devuelve los días en que baja el precio.
const duracionesConPrecioMasBajo = (reglas = REGLAS_ALQUILER, precioDiaCentimos = 10000) => {
  const bajadas = [];
  for (let n = reglas.duracionMinDias + 1; n <= reglas.duracionMaxDias; n += 1) {
    const anterior = importeAlquilerCentimos(n - 1, precioDiaCentimos, reglas).importe;
    if (importeAlquilerCentimos(n, precioDiaCentimos, reglas).importe < anterior) bajadas.push(n);
  }
  return bajadas;
};

module.exports = {
  calcularPrecioReserva,
  diasFacturados,
  limitesDeInicio,
  duracionesConPrecioMasBajo
};
