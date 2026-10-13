// Tests de utils/disponibilidad.js: qué enseña el calendario de una pieza y si se puede comprar
// (docs/reservas-diseno.md, 7.1 y 6.7). Funciones puras, con "hoy" y el instante fijos.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  leerRango,
  ocupaElCalendario,
  ventanaDeConsulta,
  calcularDisponibilidad
} = require('../utils/disponibilidad');
const { ErrorValidacion } = require('../utils/errores');

const HOY = '2026-10-13';
const AHORA = new Date('2026-10-13T10:00:00Z');

const mueble = (cambios = {}) => ({
  id: 'm1',
  estado: 'disponible',
  precio_alquiler_dia: 25,
  ...cambios
});

const disponibilidad = (filas, cambios = {}) =>
  calcularDisponibilidad({
    mueble: mueble(),
    filas,
    hoy: HOY,
    ahora: AHORA,
    desde: HOY,
    hasta: '2027-10-13',
    mostrarPrecio: true,
    ...cambios
  });

const alquiler = (rango, cambios = {}) => ({
  tipo: 'alquiler',
  estado: 'confirmada',
  rango_ocupado: rango,
  expira_en: null,
  ...cambios
});

describe('leerRango — el texto canónico de un daterange de Postgres', () => {
  test('con fin, sin fin y vacío', () => {
    assert.deepEqual(leerRango('[2030-06-10,2030-06-15)'), {
      desde: '2030-06-10',
      hasta: '2030-06-15'
    });
    assert.deepEqual(leerRango('[2030-06-19,)'), { desde: '2030-06-19', hasta: null });
    assert.equal(leerRango('empty'), null);
    assert.equal(leerRango(null), null);
  });
});

describe('ocupaElCalendario — el mismo criterio que la restricción de la base de datos', () => {
  test('ocupan pendiente, confirmada, en curso y devuelta; no ocupan cancelada ni expirada', () => {
    for (const estado of ['confirmada', 'en_curso', 'devuelta']) {
      assert.equal(ocupaElCalendario({ estado }, AHORA), true, estado);
    }
    for (const estado of ['cancelada', 'expirada']) {
      assert.equal(ocupaElCalendario({ estado }, AHORA), false, estado);
    }
  });
  test('una provisional cuenta mientras no caduca, y deja de contar en cuanto caduca', () => {
    const viva = { estado: 'pendiente', expira_en: '2026-10-13T10:30:00Z' };
    const caducada = { estado: 'pendiente', expira_en: '2026-10-13T09:59:59Z' };
    assert.equal(ocupaElCalendario(viva, AHORA), true);
    assert.equal(ocupaElCalendario(caducada, AHORA), false);
  });
});

describe('ventanaDeConsulta — ?desde y ?hasta', () => {
  test('por defecto: de hoy a la última entrega posible más la duración máxima', () => {
    // 13 abr 2027 (hoy + 6 meses) + 180 días = 10 oct 2027.
    assert.deepEqual(ventanaDeConsulta({ hoy: HOY }), { desde: HOY, hasta: '2027-10-10' });
  });
  test('un desde anterior a hoy se lleva a hoy', () => {
    assert.deepEqual(ventanaDeConsulta({ desde: '2026-01-01', hasta: '2026-11-01', hoy: HOY }), {
      desde: HOY,
      hasta: '2026-11-01'
    });
  });
  test('respeta un desde y un hasta válidos', () => {
    assert.deepEqual(ventanaDeConsulta({ desde: '2026-11-01', hasta: '2026-12-01', hoy: HOY }), {
      desde: '2026-11-01',
      hasta: '2026-12-01'
    });
  });
  const rechaza = (consulta, mensaje) =>
    assert.throws(
      () => ventanaDeConsulta({ ...consulta, hoy: HOY }),
      (err) => err instanceof ErrorValidacion && err.message === mensaje
    );
  test('fechas mal escritas, o repetidas en la URL (llegan como array)', () => {
    rechaza({ desde: '13/10/2026' }, 'Las fechas tienen que ir en formato AAAA-MM-DD.');
    rechaza({ hasta: '2026-02-30' }, 'Las fechas tienen que ir en formato AAAA-MM-DD.');
    rechaza({ desde: ['2026-11-01'] }, 'Las fechas tienen que ir en formato AAAA-MM-DD.');
  });
  test('el final antes del principio', () => {
    rechaza(
      { desde: '2026-11-01', hasta: '2026-11-01' },
      'La fecha final tiene que ser posterior a la inicial.'
    );
    rechaza({ hasta: '2026-10-01' }, 'La fecha final tiene que ser posterior a la inicial.');
  });
  test('como mucho 366 días de una vez', () => {
    assert.ok(ventanaDeConsulta({ hasta: '2027-10-14', hoy: HOY }));
    rechaza({ hasta: '2027-10-15' }, 'Se pueden consultar como mucho 12 meses de una vez.');
  });
});

describe('calcularDisponibilidad', () => {
  test('sin reservas: alquilable, comprable y el calendario vacío', () => {
    const d = disponibilidad([]);
    assert.equal(d.mueble_id, 'm1');
    assert.equal(d.zona_horaria, 'Europe/Madrid');
    assert.equal(d.hoy, HOY);
    assert.equal(d.alquilable, true);
    assert.equal(d.comprable, true);
    assert.equal(d.motivo_no_comprable, null);
    assert.equal(d.comprable_desde, null);
    assert.equal(d.precio_dia_centimos, 2500);
    assert.equal(d.primer_inicio_posible, '2026-10-15');
    assert.equal(d.ultimo_inicio_posible, '2027-04-13');
    assert.deepEqual(d.ocupado, []);
  });

  test('las reglas salen tal cual, sin nombres internos', () => {
    assert.deepEqual(disponibilidad([]).reglas, {
      version: 1,
      conteo_dias: 'noches',
      duracion_min_dias: 1,
      duracion_max_dias: 180,
      antelacion_min_dias: 2,
      antelacion_max_meses: 6,
      dias_margen: 2,
      tramos_descuento: [
        { desde_dias: 7, porcentaje: 0 },
        { desde_dias: 30, porcentaje: 0 }
      ]
    });
  });

  test('con reservas futuras: no comprable, y comprable desde el final de la última', () => {
    const d = disponibilidad([
      alquiler('[2026-11-02,2026-11-07)'),
      { tipo: 'bloqueo', estado: 'confirmada', rango_ocupado: '[2026-12-01,2026-12-05)' },
      alquiler('[2026-10-20,2026-10-25)')
    ]);
    assert.equal(d.alquilable, true);
    assert.equal(d.comprable, false);
    assert.equal(d.motivo_no_comprable, 'reservas_activas');
    assert.equal(d.comprable_desde, '2026-12-05');
    assert.deepEqual(d.ocupado, [
      { desde: '2026-10-20', hasta: '2026-10-25', tipo: 'reservado' },
      { desde: '2026-11-02', hasta: '2026-11-07', tipo: 'reservado' },
      { desde: '2026-12-01', hasta: '2026-12-05', tipo: 'bloqueado' }
    ]);
  });

  test('el calendario solo enseña la ventana pedida, pero la compra mira todo lo futuro', () => {
    const d = disponibilidad([alquiler('[2027-03-01,2027-03-05)')], {
      desde: '2026-10-13',
      hasta: '2026-12-01'
    });
    assert.deepEqual(d.ocupado, []);
    assert.equal(d.comprable, false);
    assert.equal(d.comprable_desde, '2027-03-05');
  });

  test('una devuelta cuyo margen ya pasó no impide comprar', () => {
    const d = disponibilidad([alquiler('[2026-10-01,2026-10-13)', { estado: 'devuelta' })]);
    assert.equal(d.comprable, true);
    assert.deepEqual(d.ocupado, []);
  });

  test('una devuelta cuyo margen llega a hoy sí lo impide hasta que acaba', () => {
    const d = disponibilidad([alquiler('[2026-10-01,2026-10-14)', { estado: 'devuelta' })]);
    assert.equal(d.comprable, false);
    assert.equal(d.comprable_desde, '2026-10-14');
  });

  test('una provisional caducada no cuenta; una viva cuenta como reservado, sin más detalle', () => {
    const caducada = alquiler('[2026-11-02,2026-11-07)', {
      estado: 'pendiente',
      expira_en: '2026-10-13T09:00:00Z'
    });
    assert.equal(disponibilidad([caducada]).comprable, true);

    const viva = { ...caducada, expira_en: '2026-10-13T10:30:00Z' };
    assert.deepEqual(disponibilidad([viva]).ocupado, [
      { desde: '2026-11-02', hasta: '2026-11-07', tipo: 'reservado' }
    ]);
  });

  test('canceladas, expiradas y rangos vacíos no ocupan', () => {
    const d = disponibilidad([
      alquiler('[2026-11-02,2026-11-07)', { estado: 'cancelada' }),
      alquiler('[2026-11-02,2026-11-07)', { estado: 'expirada' }),
      alquiler('empty', { estado: 'devuelta' })
    ]);
    assert.equal(d.comprable, true);
    assert.deepEqual(d.ocupado, []);
  });

  test('con una fila de venta: vendida, ni alquilable ni comprable, sin fecha de compra', () => {
    const d = disponibilidad([
      { tipo: 'venta', estado: 'confirmada', rango_ocupado: '[2026-12-01,)' }
    ]);
    assert.equal(d.alquilable, false);
    assert.equal(d.comprable, false);
    assert.equal(d.motivo_no_comprable, 'vendida');
    assert.equal(d.comprable_desde, null);
    assert.deepEqual(d.ocupado, [{ desde: '2026-12-01', hasta: null, tipo: 'vendido' }]);
  });

  test('una pieza marcada como vendida en el panel cuenta como vendida aunque no tenga fila', () => {
    const d = disponibilidad([], { mueble: mueble({ estado: 'vendido' }) });
    assert.equal(d.alquilable, false);
    assert.equal(d.comprable, false);
    assert.equal(d.motivo_no_comprable, 'vendida');
  });

  test('una pieza marcada a mano como alquilada (el alquiler sin fechas de antes) no se puede comprar', () => {
    const d = disponibilidad([], { mueble: mueble({ estado: 'alquilado' }) });
    assert.equal(d.comprable, false);
    assert.equal(d.motivo_no_comprable, 'no_disponible');
    assert.equal(d.comprable_desde, null);
  });

  test('sin precio de alquiler no es alquilable', () => {
    for (const precio of [null, 0, '0.00']) {
      const d = disponibilidad([], { mueble: mueble({ precio_alquiler_dia: precio }) });
      assert.equal(d.alquilable, false, String(precio));
      assert.equal(d.precio_dia_centimos, null, String(precio));
    }
  });

  test('con los precios ocultos no sale el precio, pero sí si se puede alquilar', () => {
    const d = disponibilidad([], { mostrarPrecio: false });
    assert.equal(d.precio_dia_centimos, null);
    assert.equal(d.alquilable, true);
  });
});
