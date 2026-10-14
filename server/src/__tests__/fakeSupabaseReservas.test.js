const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

describe('fakeSupabase — emulación de reservas, solapes y códigos de error', () => {
  it('calcula rango_ocupado automáticamente en el trigger BEFORE INSERT', async () => {
    const fake = crearFakeSupabase({ reservas: [] });
    const { data, error } = await fake
      .from('reservas')
      .insert({
        mueble_id: 'm1',
        tipo: 'alquiler',
        estado: 'confirmada',
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-05',
        fin_ocupacion: '2026-10-05',
        dias_margen: 2
      })
      .select()
      .single();

    assert.equal(error, null);
    assert.ok(data);
    // fin_ocupacion (2026-10-05) + 2 días margen = 2026-10-07
    assert.equal(data.rango_ocupado, '[2026-10-01,2026-10-07)');
  });

  it('devuelve código 23P01 si dos reservas activas de la misma pieza se solapan (incluyendo margen)', async () => {
    const fake = crearFakeSupabase({
      reservas: [
        {
          id: 'res-existente',
          mueble_id: 'm1',
          tipo: 'alquiler',
          estado: 'confirmada',
          fecha_inicio: '2026-10-01',
          fecha_fin: '2026-10-05',
          fin_ocupacion: '2026-10-05',
          dias_margen: 2,
          rango_ocupado: '[2026-10-01,2026-10-07)'
        }
      ]
    });

    // Intento de reserva que entra en el margen (comienza el 2026-10-06)
    const { data, error } = await fake.from('reservas').insert({
      mueble_id: 'm1',
      tipo: 'alquiler',
      estado: 'confirmada',
      fecha_inicio: '2026-10-06',
      fecha_fin: '2026-10-10',
      fin_ocupacion: '2026-10-10',
      dias_margen: 2,
      rango_ocupado: '[2026-10-06,2026-10-12)'
    });

    assert.equal(data, null);
    assert.ok(error);
    assert.equal(error.code, '23P01');
    assert.match(error.message, /reservas_sin_solape/);
  });

  it('permite reservas que empiezan exactamente donde termina el margen', async () => {
    const fake = crearFakeSupabase({
      reservas: [
        {
          id: 'res-1',
          mueble_id: 'm1',
          tipo: 'alquiler',
          estado: 'confirmada',
          fecha_inicio: '2026-10-01',
          fecha_fin: '2026-10-05',
          fin_ocupacion: '2026-10-05',
          dias_margen: 2,
          rango_ocupado: '[2026-10-01,2026-10-07)'
        }
      ]
    });

    // Rango [2026-10-07, 2026-10-12) es contiguo pero no solapa con [2026-10-01, 2026-10-07)
    const { data, error } = await fake.from('reservas').insert({
      mueble_id: 'm1',
      tipo: 'alquiler',
      estado: 'confirmada',
      fecha_inicio: '2026-10-07',
      fecha_fin: '2026-10-10',
      fin_ocupacion: '2026-10-10',
      dias_margen: 2,
      rango_ocupado: '[2026-10-07,2026-10-12)'
    });

    assert.equal(error, null);
    assert.ok(data);
  });

  it('devuelve código 23505 si un mismo cliente intenta insertar una segunda reserva pendiente', async () => {
    const fake = crearFakeSupabase({
      reservas: [
        {
          id: 'res-pendiente-1',
          cliente_id: 'cli-1',
          mueble_id: 'm1',
          tipo: 'alquiler',
          estado: 'pendiente'
        }
      ]
    });

    const { data, error } = await fake.from('reservas').insert({
      cliente_id: 'cli-1',
      mueble_id: 'm2',
      tipo: 'alquiler',
      estado: 'pendiente'
    });

    assert.equal(data, null);
    assert.ok(error);
    assert.equal(error.code, '23505');
    assert.match(error.message, /idx_reservas_un_pendiente_por_cliente/);
  });

  it('soporta el filtro .overlaps() con rangos daterange', async () => {
    const fake = crearFakeSupabase({
      reservas: [
        { id: 'r1', mueble_id: 'm1', rango_ocupado: '[2026-10-01,2026-10-07)' },
        { id: 'r2', mueble_id: 'm1', rango_ocupado: '[2026-10-15,2026-10-20)' },
        { id: 'r3', mueble_id: 'm1', rango_ocupado: '[2026-11-01,2026-11-05)' }
      ]
    });

    // Consultar ventana [2026-10-05, 2026-10-18) -> debe capturar r1 y r2, no r3
    const { data, error } = await fake
      .from('reservas')
      .select('id')
      .overlaps('rango_ocupado', '[2026-10-05,2026-10-18)');

    assert.equal(error, null);
    assert.deepEqual(
      data.map((r) => r.id),
      ['r1', 'r2']
    );
  });
});
