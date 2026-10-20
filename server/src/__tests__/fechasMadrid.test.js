// Tests de utils/fechasMadrid.js: el "hoy" de las reservas se calcula en hora de Madrid, nunca en
// UTC, y las cuentas entre fechas no cambian con los cambios de hora (docs/reservas-diseno.md, 3.6).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  hoyEnMadrid,
  esFechaValida,
  esHoraValida,
  sumarDias,
  diasEntre,
  sumarMeses,
  fechaLegible,
  instanteEnMadrid
} = require('../utils/fechasMadrid');

describe('hoyEnMadrid — la franja de medianoche y los cambios de hora', () => {
  const casos = [
    // Horario de verano (UTC+2): a las 22:00 UTC ya es el día siguiente en Madrid.
    ['2026-07-14T21:59:59Z', '2026-07-14'],
    ['2026-07-14T22:00:00Z', '2026-07-15'],
    // Horario de invierno (UTC+1): hasta las 23:00 UTC sigue siendo el mismo día.
    ['2026-12-01T22:59:59Z', '2026-12-01'],
    ['2026-12-01T23:00:00Z', '2026-12-02'],
    // Cambio de hora de octubre (25 oct 2026, a las 01:00 UTC se pasa de UTC+2 a UTC+1).
    ['2026-10-24T21:59:59Z', '2026-10-24'],
    ['2026-10-24T22:00:00Z', '2026-10-25'],
    ['2026-10-25T22:59:59Z', '2026-10-25'],
    ['2026-10-25T23:00:00Z', '2026-10-26'],
    // Cambio de hora de marzo (28 mar 2027, a las 01:00 UTC se pasa de UTC+1 a UTC+2).
    ['2027-03-27T22:59:59Z', '2027-03-27'],
    ['2027-03-27T23:00:00Z', '2027-03-28'],
    ['2027-03-28T21:59:59Z', '2027-03-28'],
    ['2027-03-28T22:00:00Z', '2027-03-29'],
    // Fin de año.
    ['2026-12-31T23:00:00Z', '2027-01-01']
  ];
  for (const [instante, esperado] of casos) {
    test(`${instante} es ${esperado} en Madrid`, () => {
      assert.equal(hoyEnMadrid(new Date(instante)), esperado);
    });
  }

  test('sin argumento usa el reloj y devuelve una fecha válida', () => {
    assert.ok(esFechaValida(hoyEnMadrid()));
  });
});

describe('esFechaValida', () => {
  test('acepta días que existen', () => {
    for (const f of ['2026-10-13', '2028-02-29', '2026-12-31', '2027-01-01']) {
      assert.equal(esFechaValida(f), true, f);
    }
  });
  test('acepta de 2000-01-01 a 2100-12-31 y rechaza los años de fuera', () => {
    for (const f of ['2000-01-01', '2100-12-31']) assert.equal(esFechaValida(f), true, f);
    // '0050-01-01' y '9999-12-31' son días que existen, pero con ellos las cuentas dan fechas rotas.
    for (const f of ['1999-12-31', '2101-01-01', '0050-01-01', '0000-01-01', '9999-12-31']) {
      assert.equal(esFechaValida(f), false, f);
    }
  });
  test('rechaza días que no existen, otros formatos y lo que no es texto', () => {
    for (const f of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-10-1',
      '13/10/2026',
      '2026-10-13T00:00:00Z',
      '',
      null,
      undefined,
      20261013
    ]) {
      assert.equal(esFechaValida(f), false, String(f));
    }
  });
});

describe('esHoraValida', () => {
  test('HH:MM de 00:00 a 23:59', () => {
    for (const h of ['00:00', '09:30', '10:00', '23:59']) assert.equal(esHoraValida(h), true, h);
    for (const h of ['24:00', '9:30', '10:60', '10:00:00', '10h', '', null, 1000, ['10:00']]) {
      assert.equal(esHoraValida(h), false, String(h));
    }
  });
});

describe('sumarDias y diasEntre — días de calendario, sin horas', () => {
  test('un alquiler del 24 al 27 de octubre de 2026 son 3 días aunque el 25 tenga 25 horas', () => {
    assert.equal(diasEntre('2026-10-24', '2026-10-27'), 3);
    assert.equal(sumarDias('2026-10-24', 3), '2026-10-27');
  });
  test('el cambio de hora de marzo (día de 23 horas) tampoco cambia la cuenta', () => {
    assert.equal(diasEntre('2027-03-27', '2027-03-29'), 2);
    assert.equal(sumarDias('2027-03-27', 2), '2027-03-29');
  });
  test('cruza meses, años y el 29 de febrero', () => {
    assert.equal(sumarDias('2026-12-30', 3), '2027-01-02');
    assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
    assert.equal(diasEntre('2026-01-01', '2027-01-01'), 365);
    assert.equal(diasEntre('2028-01-01', '2029-01-01'), 366);
  });
  test('admite días negativos', () => {
    assert.equal(sumarDias('2026-10-01', -1), '2026-09-30');
    assert.equal(diasEntre('2026-10-03', '2026-10-01'), -2);
    assert.equal(diasEntre('2026-10-03', '2026-10-03'), 0);
  });
});

describe('sumarMeses', () => {
  test('mismo día del mes de llegada', () => {
    assert.equal(sumarMeses('2026-09-23', 6), '2027-03-23');
    assert.equal(sumarMeses('2026-10-13', 6), '2027-04-13');
  });
  test('si el día no existe en el mes de llegada, se queda en el último día de ese mes', () => {
    assert.equal(sumarMeses('2026-08-31', 6), '2027-02-28');
    assert.equal(sumarMeses('2027-08-31', 6), '2028-02-29');
    assert.equal(sumarMeses('2026-03-31', 1), '2026-04-30');
  });
  test('cruza el año hacia delante y hacia atrás, y 0 meses no cambia nada', () => {
    assert.equal(sumarMeses('2026-11-15', 2), '2027-01-15');
    assert.equal(sumarMeses('2026-01-15', -2), '2025-11-15');
    assert.equal(sumarMeses('2026-10-13', 0), '2026-10-13');
  });
});

test('fechaLegible pone la fecha como se lee en España', () => {
  assert.equal(fechaLegible('2026-10-05'), '05/10/2026');
});

describe('instanteEnMadrid — una hora de Madrid como instante', () => {
  test('las 12:00 de Madrid son las 10:00 UTC en verano y las 11:00 UTC en invierno', () => {
    assert.equal(instanteEnMadrid('2026-07-14', '12:00').toISOString(), '2026-07-14T10:00:00.000Z');
    assert.equal(instanteEnMadrid('2026-12-01', '12:00').toISOString(), '2026-12-01T11:00:00.000Z');
  });

  test('los días del cambio de hora', () => {
    // 25 oct 2026: a las 03:00 de Madrid vuelve a ser las 02:00 (UTC+2 → UTC+1).
    assert.equal(instanteEnMadrid('2026-10-25', '12:00').toISOString(), '2026-10-25T11:00:00.000Z');
    assert.equal(instanteEnMadrid('2026-10-24', '12:00').toISOString(), '2026-10-24T10:00:00.000Z');
    // 28 mar 2027: a las 02:00 de Madrid pasan a ser las 03:00 (UTC+1 → UTC+2).
    assert.equal(instanteEnMadrid('2027-03-28', '12:00').toISOString(), '2027-03-28T10:00:00.000Z');
    assert.equal(instanteEnMadrid('2027-03-27', '12:00').toISOString(), '2027-03-27T11:00:00.000Z');
  });

  test('cerca de medianoche sigue siendo ese día en Madrid', () => {
    assert.equal(instanteEnMadrid('2026-07-14', '00:30').toISOString(), '2026-07-13T22:30:00.000Z');
    assert.equal(hoyEnMadrid(instanteEnMadrid('2026-12-31', '23:59')), '2026-12-31');
  });

  test('una hora que no existe en Madrid (la que se salta en marzo) da null', () => {
    assert.equal(instanteEnMadrid('2027-03-28', '02:30'), null);
  });
});
