const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/reservas');

let fake;
afterEach(() => mock.restoreAll());

describe('GET /api/muebles/:id/disponibilidad', () => {
  const hoy = hoyEnMadrid();
  const inicioFuturo = sumarDias(hoy, 10);
  const finFuturo = sumarDias(hoy, 15);

  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'mueble-1',
          nombre: 'Silla Vintage',
          estado: 'disponible',
          precio_alquiler_dia: 15.0
        },
        {
          id: 'mueble-sin-alquiler',
          nombre: 'Mesa Rústica',
          estado: 'disponible',
          precio_alquiler_dia: null
        },
        {
          id: 'mueble-vendido',
          nombre: 'Aparador Mid-Century',
          estado: 'vendido',
          precio_alquiler_dia: 30.0
        }
      ],
      reservas: [
        {
          id: 'res-1',
          mueble_id: 'mueble-1',
          tipo: 'alquiler',
          estado: 'confirmada',
          fecha_inicio: inicioFuturo,
          fecha_fin: finFuturo,
          fin_ocupacion: finFuturo,
          dias_margen: 2,
          rango_ocupado: `[${inicioFuturo},${sumarDias(finFuturo, 2)})`
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  it('devuelve 404 si el mueble no existe', async () => {
    const res = await request(app).get('/api/muebles/inexistente/disponibilidad');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Mueble no encontrado.');
  });

  it('devuelve la disponibilidad y reglas de un mueble con Cache-Control: no-store', async () => {
    const res = await request(app).get('/api/muebles/mueble-1/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.mueble_id, 'mueble-1');
    assert.equal(res.body.alquilable, true);
    // Regla de negocio: con reservas activas o futuras, la compra inmediata está bloqueada
    assert.equal(res.body.comprable, false);
    assert.equal(res.body.motivo_no_comprable, 'reservas_activas');
    assert.equal(res.body.comprable_desde, sumarDias(finFuturo, 2));
    assert.equal(res.body.precio_dia, 15);
    assert.equal(res.body.reglas.duracion_min_dias, 1);
    assert.equal(res.body.reglas.dias_margen, 2);
    assert.equal(res.body.ocupado.length, 1);
    assert.equal(res.body.ocupado[0].desde, inicioFuturo);
    assert.equal(res.body.ocupado[0].hasta, sumarDias(finFuturo, 2));
    assert.equal(res.body.ocupado[0].tipo, 'reservado');
  });

  it('un mueble sin reservas es comprable y alquilable inmediatamente', async () => {
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'mueble-libre',
          nombre: 'Mesa Tulip',
          estado: 'disponible',
          precio_alquiler_dia: 25
        }
      ],
      reservas: []
    });
    mock.method(supabase, 'from', fake.from);

    const res = await request(app).get('/api/muebles/mueble-libre/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.alquilable, true);
    assert.equal(res.body.comprable, true);
    assert.equal(res.body.motivo_no_comprable, null);
    assert.equal(res.body.comprable_desde, null);
    assert.equal(res.body.ocupado.length, 0);
  });

  it('marca una pieza como no comprable si tiene una ocupación activa desde hoy', async () => {
    const inicioHoy = hoy;
    const finSemana = sumarDias(hoy, 5);

    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'mueble-en-uso',
          nombre: 'Lámpara Fase',
          estado: 'disponible',
          precio_alquiler_dia: 10
        }
      ],
      reservas: [
        {
          id: 'res-hoy',
          mueble_id: 'mueble-en-uso',
          tipo: 'alquiler',
          estado: 'en_curso',
          fecha_inicio: inicioHoy,
          fecha_fin: finSemana,
          fin_ocupacion: finSemana,
          dias_margen: 2,
          rango_ocupado: `[${inicioHoy},${sumarDias(finSemana, 2)})`
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);

    const res = await request(app).get('/api/muebles/mueble-en-uso/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.comprable, false);
    assert.equal(res.body.motivo_no_comprable, 'reservas_activas');
    assert.equal(res.body.comprable_desde, sumarDias(finSemana, 2));
  });

  it('una pieza vendida devuelve comprable: false y alquilable: false', async () => {
    const res = await request(app).get('/api/muebles/mueble-vendido/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.alquilable, false);
    assert.equal(res.body.comprable, false);
    assert.equal(res.body.motivo_no_comprable, 'vendido');
    assert.equal(res.body.comprable_desde, null);
    assert.ok(res.body.ocupado.some((o) => o.tipo === 'vendido'));
  });

  it('una pieza sin precio_alquiler_dia devuelve alquilable: false', async () => {
    const res = await request(app).get('/api/muebles/mueble-sin-alquiler/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.alquilable, false);
    assert.equal(res.body.precio_dia, null);
  });

  it('ignora reservas provisionales que ya han expirado', async () => {
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'mueble-caducado',
          nombre: 'Espejo Sol',
          estado: 'disponible',
          precio_alquiler_dia: 12
        }
      ],
      reservas: [
        {
          id: 'res-caducada',
          mueble_id: 'mueble-caducado',
          tipo: 'alquiler',
          estado: 'pendiente',
          fecha_inicio: sumarDias(hoy, 3),
          fecha_fin: sumarDias(hoy, 6),
          fin_ocupacion: sumarDias(hoy, 6),
          dias_margen: 2,
          expira_en: haceUnaHora,
          rango_ocupado: `[${sumarDias(hoy, 3)},${sumarDias(hoy, 8)})`
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);

    const res = await request(app).get('/api/muebles/mueble-caducado/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.ocupado.length, 0);
  });

  it('valida que hasta no sea anterior a desde y que el rango no supere 12 meses', async () => {
    const res1 = await request(app).get(
      `/api/muebles/mueble-1/disponibilidad?desde=${sumarDias(hoy, 10)}&hasta=${sumarDias(hoy, 5)}`
    );
    assert.equal(res1.status, 400);
    assert.match(res1.body.error, /no puede ser anterior/);

    const res2 = await request(app).get(
      `/api/muebles/mueble-1/disponibilidad?desde=${hoy}&hasta=${sumarDias(hoy, 400)}`
    );
    assert.equal(res2.status, 400);
    assert.match(res2.body.error, /no puede superar los 12 meses/);
  });
});

describe('GET /api/muebles/:id/presupuesto', () => {
  const hoy = hoyEnMadrid();
  const inicioValido = sumarDias(hoy, 5);
  const finValido = sumarDias(hoy, 12); // 7 días

  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'mueble-1',
          nombre: 'Silla Thonet',
          estado: 'disponible',
          precio_alquiler_dia: 20.0
        },
        {
          id: 'mueble-sin-alquiler',
          nombre: 'Escultura',
          estado: 'disponible',
          precio_alquiler_dia: null
        }
      ]
    });
    mock.method(supabase, 'from', fake.from);
  });

  it('devuelve 404 si el mueble no existe', async () => {
    const res = await request(app).get(
      `/api/muebles/inexistente/presupuesto?fecha_inicio=${inicioValido}&fecha_fin=${finValido}`
    );
    assert.equal(res.status, 404);
  });

  it('devuelve 400 si el mueble no tiene precio de alquiler', async () => {
    const res = await request(app).get(
      `/api/muebles/mueble-sin-alquiler/presupuesto?fecha_inicio=${inicioValido}&fecha_fin=${finValido}`
    );
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no está disponible para alquiler/);
  });

  it('devuelve 400 si faltan fechas o el rango no cumple las reglas', async () => {
    const resFaltaFecha = await request(app).get(
      `/api/muebles/mueble-1/presupuesto?fecha_inicio=${inicioValido}`
    );
    assert.equal(resFaltaFecha.status, 400);

    // Antelación insuficiente (mañana, cuando el mínimo son 2 días)
    const manana = sumarDias(hoy, 1);
    const resAntelacion = await request(app).get(
      `/api/muebles/mueble-1/presupuesto?fecha_inicio=${manana}&fecha_fin=${sumarDias(manana, 3)}`
    );
    assert.equal(resAntelacion.status, 400);
    assert.match(resAntelacion.body.error, /al menos 2 días de antelación/);
  });

  it('calcula y devuelve el presupuesto desglosado con Cache-Control: no-store', async () => {
    const res = await request(app).get(
      `/api/muebles/mueble-1/presupuesto?fecha_inicio=${inicioValido}&fecha_fin=${finValido}`
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.mueble_id, 'mueble-1');
    assert.equal(res.body.dias, 7);
    assert.equal(res.body.subtotal, 140); // 7 * 20
    assert.equal(res.body.descuento_porcentaje, 10); // tramo 7 días: 10%
    assert.equal(res.body.descuento, 14);
    assert.equal(res.body.importe_alquiler, 126);
    assert.equal(res.body.importe_total, 126);
    assert.equal(res.body.iva_incluido, true);
    assert.ok(Array.isArray(res.body.lineas));
  });
});
