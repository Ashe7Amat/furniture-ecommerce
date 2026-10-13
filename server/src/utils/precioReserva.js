// Precio de una reserva de alquiler por fechas (docs/reservas-diseno.md, sección 5).
//
// Función pura: no lee la base de datos ni el reloj (la fecha de "hoy" se le pasa), para poder
// probarla con tablas de casos. La usarán el presupuesto que ve el cliente, la creación del pago y
// el cálculo de reembolsos, así que el precio se calcula en un solo sitio y nunca en el navegador.
//
// Todo en céntimos enteros (T10): los euros con decimales solo aparecen al leer el precio de la
// pieza, y se pasan a céntimos una vez, al entrar. Los importes son totales con IVA incluido.
const { ErrorValidacion } = require('./errores');
const { REGLAS_ALQUILER } = require('./reglasAlquiler');
const { esFechaValida, sumarDias, diasEntre, sumarMeses, fechaLegible } = require('./fechasMadrid');

const dias = (n) => (n === 1 ? '1 día' : `${n} días`);

// Días que se cobran entre la entrega y la recogida, según cómo se cuenten (reglas.conteoDias).
const diasFacturados = (fechaInicio, fechaFin, reglas = REGLAS_ALQUILER) =>
  diasEntre(fechaInicio, fechaFin) + (reglas.conteoDias === 'ambos_extremos' ? 1 : 0);

// Primer y último día en que puede empezar un alquiler reservado hoy.
const limitesDeInicio = (hoy, reglas = REGLAS_ALQUILER) => ({
  primerInicio: sumarDias(hoy, reglas.antelacionMinDias),
  ultimoInicio: sumarMeses(hoy, reglas.antelacionMaxMeses)
});

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
    importe_total: importe,
    tipo_iva: tieneTipo ? tipo : null,
    cuota_iva: tieneTipo ? Math.round((importe * tipo) / (100 + tipo)) : null
  };
};

const validarTrayecto = (valor, reglas, mensaje) => {
  if (!Object.hasOwn(reglas.tarifasTrayectoCentimos, valor)) throw new ErrorValidacion(mensaje);
  return reglas.tarifasTrayectoCentimos[valor];
};

// Calcula el presupuesto de alquilar una pieza de `fechaInicio` (día de entrega) a `fechaFin` (día
// de recogida). Lanza ErrorValidacion, con un mensaje que se puede enseñar tal cual, si la reserva
// incumple alguna regla.
const calcularPrecioReserva = ({
  precioDia,
  fechaInicio,
  fechaFin,
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
  if (fechaFin <= fechaInicio) {
    throw new ErrorValidacion('La recogida tiene que ser después del día de entrega.');
  }

  const { primerInicio, ultimoInicio } = limitesDeInicio(hoy, reglas);
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

  const n = diasFacturados(fechaInicio, fechaFin, reglas);
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
  return {
    version_reglas: reglas.version,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    dias: n,
    conteo_dias: reglas.conteoDias,
    precio_dia: precioDiaCentimos,
    subtotal_alquiler: alquiler.subtotal,
    tramo: alquiler.tramo
      ? { desde_dias: alquiler.tramo.desdeDias, porcentaje: alquiler.tramo.porcentaje }
      : null,
    descuento: alquiler.descuento,
    entrega: { modo: entrega, importe: importeEntrega },
    recogida: { modo: recogida, importe: importeRecogida },
    importe_total: alquiler.importe + importeEntrega + importeRecogida,
    lineas: [
      linea('alquiler', alquiler.importe, reglas),
      linea('entrega', importeEntrega, reglas),
      linea('recogida', importeRecogida, reglas)
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
