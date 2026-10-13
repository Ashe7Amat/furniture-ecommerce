// Tests de utils/fechasMadrid.js: el "hoy" de las reservas se calcula en hora de Madrid, nunca en
// UTC, y las cuentas entre fechas no cambian con los cambios de hora (docs/reservas-diseno.md, 3.6).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  hoyEnMadrid,
  esFechaValida,
  sumarDias,
  diasEntre,
  sumarMeses,
  fechaLegible
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
