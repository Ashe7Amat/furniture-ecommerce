// Lógica pura de cálculo de precios, fechas y reglas de reservas de alquiler (docs/reservas-diseno.md).
// Todo cálculo monetario se realiza en céntimos enteros para evitar errores de coma flotante.
// "Hoy" y los límites de calendario siempre se calculan en 'Europe/Madrid'.

const CONFIG_RESERVAS = {
  version: '2026-10-14',
  duracionMinDias: 1,
  duracionMaxDias: 180,
  antelacionMinDias: 2,
  antelacionMaxMeses: 6,
  diasMargen: 2,
  tramosDescuento: [
    { desdeDias: 7, porcentaje: 10 },
    { desdeDias: 30, porcentaje: 20 }
  ],
  costeEnvioDomicilioCentimos: 0,
  costeRecogidaDomicilioCentimos: 0,
  duracionSesionMin: 30,
  graciaWebhookMin: 15,
  politicaCancelacion: 'manual',
  ivaPorConcepto: null
};

const FORMATO_FECHA_MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Devuelve la fecha actual en la zona horaria 'Europe/Madrid' en formato YYYY-MM-DD.
 * @param {Date} [fechaReferencia=new Date()]
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function hoyEnMadrid(fechaReferencia = new Date()) {
  return FORMATO_FECHA_MADRID.format(fechaReferencia);
}

/**
 * Parsea una cadena 'YYYY-MM-DD' a sus componentes numéricos [año, mes, día].
 * @param {string} fechaStr
 * @returns {[number, number, number]}
 */
function parsearFecha(fechaStr) {
  if (typeof fechaStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    throw new Error(`Formato de fecha inválido: "${fechaStr}". Se espera YYYY-MM-DD.`);
  }
  const [año, mes, dia] = fechaStr.split('-').map(Number);
  return [año, mes, dia];
}

/**
 * Calcula los días de calendario facturados (fechaFin - fechaInicio).
 * Siempre resta días de calendario sin verse afectado por cambios de hora UTC.
 * @param {string} fechaInicio 'YYYY-MM-DD'
 * @param {string} fechaFin 'YYYY-MM-DD'
 * @returns {number} Número de días
 */
function diasEntreFechas(fechaInicio, fechaFin) {
  const [a1, m1, d1] = parsearFecha(fechaInicio);
  const [a2, m2, d2] = parsearFecha(fechaFin);
  const utc1 = Date.UTC(a1, m1 - 1, d1);
  const utc2 = Date.UTC(a2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

/**
 * Suma `dias` a una fecha 'YYYY-MM-DD' en tiempo de calendario.
 * @param {string} fechaStr 'YYYY-MM-DD'
 * @param {number} dias
 * @returns {string} 'YYYY-MM-DD'
 */
function sumarDias(fechaStr, dias) {
  const [año, mes, dia] = parsearFecha(fechaStr);
  const d = new Date(Date.UTC(año, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/**
 * Suma `meses` a una fecha 'YYYY-MM-DD' en tiempo de calendario.
 * @param {string} fechaStr 'YYYY-MM-DD'
 * @param {number} meses
 * @returns {string} 'YYYY-MM-DD'
 */
function sumarMeses(fechaStr, meses) {
  const [año, mes, dia] = parsearFecha(fechaStr);
  const d = new Date(Date.UTC(año, mes - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
}

/**
 * Valida un rango de fechas de reserva contra las reglas de negocio configuradas.
 * @param {Object} params
 * @param {string} params.fechaInicio 'YYYY-MM-DD'
 * @param {string} params.fechaFin 'YYYY-MM-DD'
 * @param {Date} [params.ahora=new Date()]
 * @param {typeof CONFIG_RESERVAS} [params.config=CONFIG_RESERVAS]
 * @returns {{ valido: boolean, error?: string, dias?: number }}
 */
function validarRangoReserva({
  fechaInicio,
  fechaFin,
  ahora = new Date(),
  config = CONFIG_RESERVAS
}) {
  try {
    parsearFecha(fechaInicio);
    parsearFecha(fechaFin);
  } catch {
    return { valido: false, error: 'Las fechas deben tener el formato YYYY-MM-DD.' };
  }

  const dias = diasEntreFechas(fechaInicio, fechaFin);
  if (dias <= 0) {
    return {
      valido: false,
      error: 'La fecha de fin debe ser posterior a la fecha de inicio (mínimo 1 día de alquiler).'
    };
  }

  if (dias < config.duracionMinDias) {
    return {
      valido: false,
      error: `La duración mínima de alquiler es de ${config.duracionMinDias} día${config.duracionMinDias > 1 ? 's' : ''}.`
    };
  }

  if (dias > config.duracionMaxDias) {
    return {
      valido: false,
      error: `La duración máxima de alquiler es de ${config.duracionMaxDias} días.`
    };
  }

  const hoy = hoyEnMadrid(ahora);
  const primerInicioPosible = sumarDias(hoy, config.antelacionMinDias);
  const ultimoInicioPosible = sumarMeses(hoy, config.antelacionMaxMeses);

  if (fechaInicio < primerInicioPosible) {
    return {
      valido: false,
      error: `Las reservas deben realizarse con al menos ${config.antelacionMinDias} días de antelación (a partir del ${primerInicioPosible}).`
    };
  }

  if (fechaInicio > ultimoInicioPosible) {
    return {
      valido: false,
      error: `No se pueden realizar reservas con más de ${config.antelacionMaxMeses} meses de antelación (hasta el ${ultimoInicioPosible}).`
    };
  }

  return { valido: true, dias };
}

/**
 * Calcula el desglose económico exacto de una reserva en céntimos y lo devuelve formateado en euros.
 * @param {Object} params
 * @param {number|string} params.precioAlquilerDia Precio por día en euros
 * @param {string} params.fechaInicio 'YYYY-MM-DD'
 * @param {string} params.fechaFin 'YYYY-MM-DD'
 * @param {string} [params.modoEntrega='tienda'] 'domicilio' o 'tienda'
 * @param {string} [params.modoDevolucion='tienda'] 'domicilio' o 'tienda'
 * @param {typeof CONFIG_RESERVAS} [params.config=CONFIG_RESERVAS]
 * @returns {Object} Desglose detallado del presupuesto
 */
function calcularPrecioReserva({
  precioAlquilerDia,
  fechaInicio,
  fechaFin,
  modoEntrega = 'tienda',
  modoDevolucion = 'tienda',
  config = CONFIG_RESERVAS
}) {
  const precioNum = Number(precioAlquilerDia);
  if (isNaN(precioNum) || precioNum <= 0) {
    throw new Error('El mueble no tiene un precio de alquiler diario válido.');
  }

  const dias = diasEntreFechas(fechaInicio, fechaFin);
  if (dias <= 0) {
    throw new Error('La fecha de fin debe ser posterior a la fecha de inicio.');
  }

  const precioDiaCentimos = Math.round(precioNum * 100);
  const subtotalCentimos = dias * precioDiaCentimos;

  // Encontrar el tramo aplicable con mayor desdeDias <= dias
  const tramosOrdenados = [...(config.tramosDescuento || [])].sort(
    (a, b) => b.desdeDias - a.desdeDias
  );
  const tramoAplicable = tramosOrdenados.find((t) => dias >= t.desdeDias) || {
    desdeDias: 0,
    porcentaje: 0
  };

  const descuentoCentimos = Math.round(
    (subtotalCentimos * tramoAplicable.porcentaje) / 100
  );
  const importeAlquilerCentimos = subtotalCentimos - descuentoCentimos;

  const costeEntregaCentimos =
    modoEntrega === 'domicilio' ? config.costeEnvioDomicilioCentimos : 0;
  const costeRecogidaCentimos =
    modoDevolucion === 'domicilio' ? config.costeRecogidaDomicilioCentimos : 0;
  const importeEnvioCentimos = costeEntregaCentimos + costeRecogidaCentimos;

  const importeTotalCentimos = importeAlquilerCentimos + importeEnvioCentimos;

  const lineasDesglose = [
    {
      concepto: 'alquiler',
      dias,
      precio_dia: precioDiaCentimos / 100,
      subtotal: subtotalCentimos / 100,
      descuento_porcentaje: tramoAplicable.porcentaje,
      descuento: descuentoCentimos / 100,
      importe_total: importeAlquilerCentimos / 100,
      tipo_iva: config.ivaPorConcepto?.alquiler?.tipo ?? null,
      cuota_iva: config.ivaPorConcepto?.alquiler?.cuota ?? null
    }
  ];

  if (costeEntregaCentimos > 0) {
    lineasDesglose.push({
      concepto: 'entrega',
      importe_total: costeEntregaCentimos / 100,
      tipo_iva: config.ivaPorConcepto?.entrega?.tipo ?? null,
      cuota_iva: config.ivaPorConcepto?.entrega?.cuota ?? null
    });
  }

  if (costeRecogidaCentimos > 0) {
    lineasDesglose.push({
      concepto: 'recogida',
      importe_total: costeRecogidaCentimos / 100,
      tipo_iva: config.ivaPorConcepto?.recogida?.tipo ?? null,
      cuota_iva: config.ivaPorConcepto?.recogida?.cuota ?? null
    });
  }

  return {
    dias,
    precio_dia: precioDiaCentimos / 100,
    subtotal: subtotalCentimos / 100,
    descuento_porcentaje: tramoAplicable.porcentaje,
    descuento: descuentoCentimos / 100,
    importe_alquiler: importeAlquilerCentimos / 100,
    importe_envio: importeEnvioCentimos / 100,
    importe_total: importeTotalCentimos / 100,
    modo_entrega: modoEntrega,
    modo_devolucion: modoDevolucion,
    iva_incluido: true,
    version_reglas: config.version,
    lineas: lineasDesglose
  };
}

module.exports = {
  CONFIG_RESERVAS,
  hoyEnMadrid,
  parsearFecha,
  diasEntreFechas,
  sumarDias,
  sumarMeses,
  validarRangoReserva,
  calcularPrecioReserva
};
