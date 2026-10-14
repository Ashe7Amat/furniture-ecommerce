const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CONFIG_RESERVAS,
  hoyEnMadrid,
  diasEntreFechas,
  sumarDias,
  sumarMeses,
  validarRangoReserva,
  calcularPrecioReserva
} = require('../utils/reservas');

describe('utils/reservas — fechas y zona horaria', () => {
  it('hoyEnMadrid calcula correctamente el día en Madrid alrededor de la medianoche UTC', () => {
    // 23:30 UTC en invierno (CET = UTC+1): en Madrid ya es el día siguiente (00:30)
    const nocheInvierno = new Date('2026-11-15T23:30:00.000Z');
    assert.equal(hoyEnMadrid(nocheInvierno), '2026-11-16');

    // 21:30 UTC en invierno: en Madrid son las 22:30 del mismo día
    const antesMedianocheInvierno = new Date('2026-11-15T21:30:00.000Z');
    assert.equal(hoyEnMadrid(antesMedianocheInvierno), '2026-11-15');

    // 22:30 UTC en verano (CEST = UTC+2): en Madrid son las 00:30 del día siguiente
    const nocheVerano = new Date('2026-07-10T22:30:00.000Z');
    assert.equal(hoyEnMadrid(nocheVerano), '2026-07-11');
  });

  it('diasEntreFechas cuenta días de calendario puros sin afectarle los cambios de hora', () => {
    // Caso normal
    assert.equal(diasEntreFechas('2026-10-01', '2026-10-03'), 2);

    // Cambio de hora otoño (25 oct 2026 tiene 25 horas): 24 al 27 de octubre son exactamente 3 días
    assert.equal(diasEntreFechas('2026-10-24', '2026-10-27'), 3);

    // Cambio de hora primavera (28 mar 2027 tiene 23 horas): 27 al 30 de marzo son exactamente 3 días
    assert.equal(diasEntreFechas('2027-03-27', '2027-03-30'), 3);

    // Mismo día = 0 días
    assert.equal(diasEntreFechas('2026-10-01', '2026-10-01'), 0);

    // Fechas invertidas = valor negativo
    assert.equal(diasEntreFechas('2026-10-05', '2026-10-01'), -4);
  });

  it('sumarDias y sumarMeses calculan fechas de calendario correctamente', () => {
    assert.equal(sumarDias('2026-09-23', 2), '2026-09-25');
    assert.equal(sumarDias('2026-12-30', 5), '2027-01-04');
    assert.equal(sumarMeses('2026-09-23', 6), '2027-03-23');
  });
});

describe('utils/reservas — validación de rangos', () => {
  const ahoraFijo = new Date('2026-09-23T10:00:00.000Z'); // hoy = 2026-09-23 en Madrid

  it('un rango válido con la antelación y duración adecuadas pasa la validación', () => {
    const res = validarRangoReserva({
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-08',
      ahora: ahoraFijo
    });
    assert.equal(res.valido, true);
    assert.equal(res.dias, 7);
  });

  it('rechaza fecha de fin anterior o igual a la fecha de inicio', () => {
    const res1 = validarRangoReserva({
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-01',
      ahora: ahoraFijo
    });
    assert.equal(res1.valido, false);
    assert.match(res1.error, /mínimo 1 día/);

    const res2 = validarRangoReserva({
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-02',
      ahora: ahoraFijo
    });
    assert.equal(res2.valido, false);
    assert.match(res2.error, /mínimo 1 día/);
  });

  it('rechaza duración superior a la máxima (180 días)', () => {
    const res = validarRangoReserva({
      fechaInicio: '2026-10-01',
      fechaFin: '2027-05-01', // ~212 días
      ahora: ahoraFijo
    });
    assert.equal(res.valido, false);
    assert.match(res.error, /máxima de alquiler es de 180 días/);
  });

  it('rechaza antelación insuficiente (mínimo 2 días)', () => {
    // hoy es 2026-09-23, antelación mínima 2 días -> primer día posible 2026-09-25
    const res = validarRangoReserva({
      fechaInicio: '2026-09-24',
      fechaFin: '2026-09-26',
      ahora: ahoraFijo
    });
    assert.equal(res.valido, false);
    assert.match(res.error, /al menos 2 días de antelación/);
  });

  it('rechaza antelación superior a 6 meses', () => {
    // hoy es 2026-09-23, 6 meses -> 2027-03-23
    const res = validarRangoReserva({
      fechaInicio: '2027-04-01',
      fechaFin: '2027-04-05',
      ahora: ahoraFijo
    });
    assert.equal(res.valido, false);
    assert.match(res.error, /más de 6 meses de antelación/);
  });

  it('rechaza cadenas con formato de fecha mal formado', () => {
    const res = validarRangoReserva({
      fechaInicio: '01/10/2026',
      fechaFin: '2026-10-05',
      ahora: ahoraFijo
    });
    assert.equal(res.valido, false);
    assert.match(res.error, /YYYY-MM-DD/);
  });
});

describe('utils/reservas — cálculo de presupuestos', () => {
  it('calcula correctamente el precio para 1 día sin descuento', () => {
    const resultado = calcularPrecioReserva({
      precioAlquilerDia: 25.5,
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-02'
    });

    assert.equal(resultado.dias, 1);
    assert.equal(resultado.precio_dia, 25.5);
    assert.equal(resultado.subtotal, 25.5);
    assert.equal(resultado.descuento_porcentaje, 0);
    assert.equal(resultado.descuento, 0);
    assert.equal(resultado.importe_alquiler, 25.5);
    assert.equal(resultado.importe_total, 25.5);
    assert.equal(resultado.lineas.length, 1);
    assert.equal(resultado.lineas[0].concepto, 'alquiler');
  });

  it('aplica tramo de 7 días (10% de descuento)', () => {
    const resultado = calcularPrecioReserva({
      precioAlquilerDia: 100,
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-08' // 7 días
    });

    assert.equal(resultado.dias, 7);
    assert.equal(resultado.subtotal, 700);
    assert.equal(resultado.descuento_porcentaje, 10);
    assert.equal(resultado.descuento, 70);
    assert.equal(resultado.importe_alquiler, 630);
    assert.equal(resultado.importe_total, 630);
  });

  it('aplica tramo de 30 días (20% de descuento)', () => {
    const resultado = calcularPrecioReserva({
      precioAlquilerDia: 50,
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-31' // 30 días
    });

    assert.equal(resultado.dias, 30);
    assert.equal(resultado.subtotal, 1500);
    assert.equal(resultado.descuento_porcentaje, 20);
    assert.equal(resultado.descuento, 300);
    assert.equal(resultado.importe_alquiler, 1200);
    assert.equal(resultado.importe_total, 1200);
  });

  it('incluye costes de envío y recogida a domicilio cuando se especifican en la configuración', () => {
    const configConEnvio = {
      ...CONFIG_RESERVAS,
      costeEnvioDomicilioCentimos: 2000, // 20.00 €
      costeRecogidaDomicilioCentimos: 2500 // 25.00 €
    };

    const resultado = calcularPrecioReserva({
      precioAlquilerDia: 50,
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-03', // 2 días = 100 €
      modoEntrega: 'domicilio',
      modoDevolucion: 'domicilio',
      config: configConEnvio
    });

    assert.equal(resultado.dias, 2);
    assert.equal(resultado.importe_alquiler, 100);
    assert.equal(resultado.importe_envio, 45); // 20 + 25
    assert.equal(resultado.importe_total, 145);
    assert.equal(resultado.lineas.length, 3);
    assert.equal(resultado.lineas[1].concepto, 'entrega');
    assert.equal(resultado.lineas[1].importe_total, 20);
    assert.equal(resultado.lineas[2].concepto, 'recogida');
    assert.equal(resultado.lineas[2].importe_total, 25);
  });

  it('lanza error si el precio no es válido o es <= 0', () => {
    assert.throws(
      () =>
        calcularPrecioReserva({
          precioAlquilerDia: null,
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-02'
        }),
      /precio de alquiler diario válido/
    );

    assert.throws(
      () =>
        calcularPrecioReserva({
          precioAlquilerDia: 0,
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-02'
        }),
      /precio de alquiler diario válido/
    );
  });
});
