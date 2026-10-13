// Tests de utils/precioReserva.js: el precio de un alquiler por fechas, calculado siempre en el
// servidor y en céntimos (docs/reservas-diseno.md, sección 5), y las reglas que tiene que cumplir
// una reserva para poder presupuestarse.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  calcularPrecioReserva,
  diasFacturados,
  limitesDeInicio,
  duracionesConPrecioMasBajo
} = require('../utils/precioReserva');
const { REGLAS_ALQUILER } = require('../utils/reglasAlquiler');
const { ErrorValidacion } = require('../utils/errores');
const { sumarDias } = require('../utils/fechasMadrid');

const HOY = '2026-10-13';

// Reglas de prueba con descuentos y envío de verdad, para que los números signifiquen algo. Las
// reales (REGLAS_ALQUILER) tienen hoy los porcentajes y el envío a 0, a falta del cliente.
const reglas = (cambios = {}) => ({
  ...REGLAS_ALQUILER,
  tramosDescuento: [
    { desdeDias: 7, porcentaje: 10 },
    { desdeDias: 30, porcentaje: 25 }
  ],
  tarifasTrayectoCentimos: { domicilio: 4500, tienda: 0 },
  ...cambios
});

const presupuesto = (cambios = {}) =>
  calcularPrecioReserva({
    precioDia: 25,
    fechaInicio: '2026-10-20',
    horaEntrega: '10:00',
    fechaFin: '2026-10-23',
    horaRecogida: '10:00',
    entrega: 'domicilio',
    recogida: 'tienda',
    hoy: HOY,
    reglas: reglas(),
    ...cambios
  });

const rechaza = (cambios, mensaje) =>
  assert.throws(
    () => presupuesto(cambios),
    (err) => err instanceof ErrorValidacion && err.message === mensaje
  );

describe('calcularPrecioReserva — importes', () => {
  test('sin descuento: días × precio, más el envío, todo en céntimos', () => {
    const p = presupuesto();
    assert.equal(p.dias, 3);
    assert.equal(p.precio_dia_centimos, 2500);
    assert.equal(p.subtotal_alquiler_centimos, 7500);
    assert.equal(p.tramo, null);
    assert.equal(p.descuento_centimos, 0);
    assert.deepEqual(p.entrega, { modo: 'domicilio', importe_centimos: 4500 });
    assert.deepEqual(p.recogida, { modo: 'tienda', importe_centimos: 0 });
    assert.equal(p.importe_total_centimos, 12000);
  });

  test('guarda las fechas, las horas y la versión de las reglas', () => {
    const p = presupuesto();
    assert.equal(p.fecha_inicio, '2026-10-20');
    assert.equal(p.hora_entrega, '10:00');
    assert.equal(p.fecha_fin, '2026-10-23');
    assert.equal(p.hora_recogida, '10:00');
    assert.equal(p.version_reglas, REGLAS_ALQUILER.version);
  });

  const tramos = [
    // [días, tramo esperado, subtotal, descuento]
    [6, null, 15000, 0],
    [7, { desde_dias: 7, porcentaje: 10 }, 17500, 1750],
    [29, { desde_dias: 7, porcentaje: 10 }, 72500, 7250],
    [30, { desde_dias: 30, porcentaje: 25 }, 75000, 18750],
    [180, { desde_dias: 30, porcentaje: 25 }, 450000, 112500]
  ];
  for (const [n, tramo, subtotal, descuento] of tramos) {
    test(`${n} días: se aplica el mayor tramo alcanzado a todo el alquiler`, () => {
      const p = presupuesto({ fechaInicio: '2026-10-20', fechaFin: sumarDias('2026-10-20', n) });
      assert.equal(p.dias, n);
      assert.deepEqual(p.tramo, tramo);
      assert.equal(p.subtotal_alquiler_centimos, subtotal);
      assert.equal(p.descuento_centimos, descuento);
      assert.equal(p.importe_total_centimos, subtotal - descuento + 4500);
    });
  }

  test('el orden de los tramos en la configuración no importa', () => {
    const p = presupuesto({
      fechaFin: '2026-11-30',
      reglas: reglas({
        tramosDescuento: [
          { desdeDias: 30, porcentaje: 25 },
          { desdeDias: 7, porcentaje: 10 }
        ]
      })
    });
    assert.deepEqual(p.tramo, { desde_dias: 30, porcentaje: 25 });
  });

  test('el descuento se redondea al céntimo y el total cuadra con las líneas', () => {
    // 7 días × 19,99 € = 139,93 €; el 10 % son 13,993 € → 13,99 €.
    const p = presupuesto({ precioDia: '19.99', fechaFin: '2026-10-27' });
    assert.equal(p.precio_dia_centimos, 1999);
    assert.equal(p.subtotal_alquiler_centimos, 13993);
    assert.equal(p.descuento_centimos, 1399);
    const sumaLineas = p.lineas.reduce((s, l) => s + l.importe_centimos, 0);
    assert.equal(p.importe_total_centimos, sumaLineas);
    for (const l of p.lineas) assert.ok(Number.isInteger(l.importe_centimos), l.concepto);
  });

  test('el precio por día admite el texto que devuelve Postgres para un numeric', () => {
    assert.equal(presupuesto({ precioDia: '25.50' }).precio_dia_centimos, 2550);
  });

  test('con las reglas reales de hoy no hay descuento ni coste de envío', () => {
    const p = presupuesto({ fechaFin: '2026-11-30', reglas: REGLAS_ALQUILER });
    assert.equal(p.descuento_centimos, 0);
    assert.equal(p.importe_total_centimos, p.subtotal_alquiler_centimos);
  });
});

describe('calcularPrecioReserva — días en bloques de 24 h desde la hora de entrega', () => {
  const dias = (fechaInicio, horaEntrega, fechaFin, horaRecogida) =>
    presupuesto({ fechaInicio, horaEntrega, fechaFin, horaRecogida }).dias;

  test('del lunes 19 por la mañana al miércoles 21 a la misma hora son 2 días', () => {
    assert.equal(dias('2026-10-19', '10:00', '2026-10-21', '10:00'), 2);
  });

  test('si la recogida es más tarde que la hora de entrega, empieza otro día', () => {
    assert.equal(dias('2026-10-19', '10:00', '2026-10-21', '10:01'), 3);
    assert.equal(dias('2026-10-19', '10:00', '2026-10-21', '18:00'), 3);
  });

  test('si la recogida es antes de la hora de entrega, no', () => {
    assert.equal(dias('2026-10-19', '10:00', '2026-10-21', '09:59'), 2);
  });

  test('de una tarde a la mañana siguiente es 1 día', () => {
    assert.equal(dias('2026-10-19', '18:00', '2026-10-20', '10:00'), 1);
    assert.equal(dias('2026-10-19', '18:00', '2026-10-20', '18:00'), 1);
    assert.equal(dias('2026-10-19', '18:00', '2026-10-20', '18:30'), 2);
  });

  test('no hay alquileres de menos de un día: la recogida el mismo día no vale a ninguna hora', () => {
    rechaza(
      {
        fechaInicio: '2026-10-19',
        horaEntrega: '09:00',
        fechaFin: '2026-10-19',
        horaRecogida: '20:00'
      },
      'La recogida tiene que ser después del día de entrega.'
    );
  });

  test('los cambios de hora no cambian los días facturados', () => {
    // Del 24 al 27 de octubre de 2026 hay 73 horas reales (el 25 tiene 25), y del 27 al 29 de
    // marzo de 2027, 47 (el 28 tiene 23): cuenta la hora del reloj.
    assert.equal(diasFacturados('2026-10-24', '10:00', '2026-10-27', '10:00'), 3);
    assert.equal(diasFacturados('2027-03-27', '10:00', '2027-03-29', '10:00'), 2);
  });

  test('el precio sale de esos días', () => {
    const p = presupuesto({ horaEntrega: '10:00', horaRecogida: '12:00' });
    assert.equal(p.dias, 4);
    assert.equal(p.subtotal_alquiler_centimos, 10000);
  });

  test('la duración máxima cuenta el día de más', () => {
    assert.equal(presupuesto({ fechaFin: '2027-04-18', horaRecogida: '10:00' }).dias, 180);
    rechaza(
      { fechaFin: '2027-04-18', horaRecogida: '10:30' },
      'El alquiler máximo es de 180 días.'
    );
  });
});

describe('calcularPrecioReserva — IVA por concepto (pendiente del asesor)', () => {
  test('sin tipo configurado, el tipo y la cuota van en null', () => {
    for (const l of presupuesto().lineas) {
      assert.equal(l.tipo_iva, null, l.concepto);
      assert.equal(l.cuota_iva_centimos, null, l.concepto);
    }
    assert.deepEqual(
      presupuesto().lineas.map((l) => l.concepto),
      ['alquiler', 'entrega', 'recogida']
    );
  });

  test('con un tipo configurado, la cuota sale del total con IVA incluido', () => {
    const p = presupuesto({ reglas: reglas({ ivaPorConcepto: { alquiler: 21 } }) });
    const [alquiler, entrega] = p.lineas;
    // 75 € con un 21 % incluido: base 61,98 €, cuota 13,02 €.
    assert.equal(alquiler.tipo_iva, 21);
    assert.equal(alquiler.cuota_iva_centimos, 1302);
    assert.equal(entrega.tipo_iva, null);
    assert.equal(p.importe_total_centimos, 12000);
  });

  test('un tipo del 0 % es un tipo, no un vacío', () => {
    const [, entrega] = presupuesto({ reglas: reglas({ ivaPorConcepto: { entrega: 0 } }) }).lineas;
    assert.equal(entrega.tipo_iva, 0);
    assert.equal(entrega.cuota_iva_centimos, 0);
  });
});

describe('calcularPrecioReserva — reglas que se rechazan', () => {
  test('una pieza sin precio de alquiler no se puede alquilar', () => {
    for (const precioDia of [null, undefined, 0, -5, '', 'abc']) {
      rechaza({ precioDia }, 'Esta pieza no se puede alquilar.');
    }
  });

  test('horas que faltan o mal escritas', () => {
    for (const cambios of [
      { horaEntrega: undefined },
      { horaRecogida: '' },
      { horaEntrega: '9:00' },
      { horaRecogida: '24:00' },
      { horaEntrega: '10:60' },
      { horaRecogida: ['10:00'] }
    ]) {
      rechaza(cambios, 'Elige la hora de entrega y la de recogida.');
    }
  });

  test('fechas que faltan o no existen', () => {
    for (const cambios of [
      { fechaInicio: undefined },
      { fechaFin: '' },
      { fechaInicio: '2026-02-30' },
      { fechaFin: '23/10/2026' }
    ]) {
      rechaza(cambios, 'Elige las fechas de entrega y de recogida.');
    }
  });

  test('la recogida el mismo día o antes de la entrega', () => {
    rechaza({ fechaFin: '2026-10-20' }, 'La recogida tiene que ser después del día de entrega.');
    rechaza({ fechaFin: '2026-10-19' }, 'La recogida tiene que ser después del día de entrega.');
  });

  test('antelación mínima: con 2 días, hoy 13 la entrega más temprana es el 15', () => {
    rechaza(
      { fechaInicio: '2026-10-14', fechaFin: '2026-10-16' },
      'La entrega más temprana posible es el 15/10/2026.'
    );
    assert.equal(presupuesto({ fechaInicio: '2026-10-15', fechaFin: '2026-10-16' }).dias, 1);
  });

  test('antelación máxima: con 6 meses, hoy 13 de octubre la última entrega es el 13 de abril', () => {
    rechaza(
      { fechaInicio: '2027-04-14', fechaFin: '2027-04-16' },
      'Por ahora solo se puede reservar con entrega hasta el 13/04/2027.'
    );
    assert.equal(presupuesto({ fechaInicio: '2027-04-13', fechaFin: '2027-04-14' }).dias, 1);
  });

  test('duración mínima y máxima, con el texto en singular o en plural', () => {
    rechaza(
      { fechaFin: '2026-10-21', reglas: reglas({ duracionMinDias: 2 }) },
      'El alquiler mínimo es de 2 días.'
    );
    rechaza(
      { fechaFin: '2026-10-22', reglas: reglas({ duracionMaxDias: 1 }) },
      'El alquiler máximo es de 1 día.'
    );
    rechaza({ fechaFin: '2027-04-19' }, 'El alquiler máximo es de 180 días.');
    assert.equal(presupuesto({ fechaFin: '2027-04-18' }).dias, 180);
  });

  test('entrega y recogida tienen que ser a domicilio o en la tienda', () => {
    rechaza({ entrega: 'dron' }, 'Elige si la entrega es a domicilio o en la tienda.');
    rechaza({ entrega: undefined }, 'Elige si la entrega es a domicilio o en la tienda.');
    rechaza({ recogida: 'toString' }, 'Elige si la recogida es a domicilio o en la tienda.');
    // ?recogida=tienda&recogida=tienda llega a Express como un array.
    rechaza({ recogida: ['tienda'] }, 'Elige si la recogida es a domicilio o en la tienda.');
  });
});

describe('limitesDeInicio', () => {
  test('con las reglas reales: hoy + 2 días y hoy + 6 meses', () => {
    assert.deepEqual(limitesDeInicio('2026-10-13'), {
      primerInicio: '2026-10-15',
      ultimoInicio: '2027-04-13'
    });
  });
  test('alrededor del cambio de hora de octubre', () => {
    assert.deepEqual(limitesDeInicio('2026-10-24'), {
      primerInicio: '2026-10-26',
      ultimoInicio: '2027-04-24'
    });
  });
});

describe('duracionesConPrecioMasBajo — avisar si un día más sale más barato', () => {
  test('con un 20 % desde 7 días, 7 días cuestan menos que 6', () => {
    const r = reglas({ tramosDescuento: [{ desdeDias: 7, porcentaje: 20 }] });
    assert.deepEqual(duracionesConPrecioMasBajo(r), [7]);
  });
  test('con un 10 % desde 7 y un 25 % desde 30, solo baja en el segundo salto', () => {
    // 6 días = 600 € y 7 días = 630 € (sube); 29 días = 2.610 € y 30 días = 2.250 € (baja).
    assert.deepEqual(duracionesConPrecioMasBajo(reglas()), [30]);
  });
  test('con las reglas reales de hoy no baja en ningún punto', () => {
    // Si el cliente fija tramos que hacen bajar el precio, este test se actualiza con esas
    // duraciones, una vez el cliente sepa que pasa.
    assert.deepEqual(duracionesConPrecioMasBajo(), []);
  });
});
