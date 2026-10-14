// Test de CONTRATO para las consultas de reservas con el cliente REAL de @supabase/supabase-js.
// Verifica cómo la librería serializa .overlaps('rango_ocupado', '[desde,hasta)') hacia PostgREST
// y cómo PostgREST expone el código de error 23P01 (conflicto de exclusión) ante supabase-js.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { createClient } = require('@supabase/supabase-js');

const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

describe('contrato de supabase-js para reservas (.overlaps y 23P01)', () => {
  it('.overlaps serializa como ov.[desde,hasta) en la URL enviada a PostgREST', async () => {
    let peticionRegistrada = null;

    const fetchFalso = async (url, init = {}) => {
      const u = new URL(url);
      peticionRegistrada = {
        metodo: (init.method || 'GET').toUpperCase(),
        pathname: u.pathname,
        params: Object.fromEntries(u.searchParams)
      };
      return json(200, []);
    };

    const clienteReal = createClient('https://test.supabase.co', 'service-role-key', {
      global: { fetch: fetchFalso },
      auth: { persistSession: false }
    });

    const { data, error } = await clienteReal
      .from('reservas')
      .select('id, rango_ocupado')
      .eq('mueble_id', 'mueble-123')
      .overlaps('rango_ocupado', '[2026-10-01,2026-10-15)');

    assert.equal(error, null);
    assert.deepEqual(data, []);
    assert.equal(peticionRegistrada.pathname, '/rest/v1/reservas');
    assert.equal(peticionRegistrada.params.mueble_id, 'eq.mueble-123');
    // PostgREST utiliza el prefijo "ov." para el operador de solape de rangos (&&)
    assert.equal(peticionRegistrada.params.rango_ocupado, 'ov.[2026-10-01,2026-10-15)');
  });

  it('un error HTTP 409 con código 23P01 de PostgREST se expone en error.code === "23P01"', async () => {
    const fetchFalso = async () =>
      json(409, {
        code: '23P01',
        details: 'Key (mueble_id, rango_ocupado)=(mueble-123, [2026-10-01, 2026-10-10)) conflicts with existing key.',
        hint: null,
        message: 'conflicting key value violates exclusion constraint "reservas_sin_solape"'
      });

    const clienteReal = createClient('https://test.supabase.co', 'service-role-key', {
      global: { fetch: fetchFalso },
      auth: { persistSession: false }
    });

    const { data, error } = await clienteReal.from('reservas').insert({
      mueble_id: 'mueble-123',
      tipo: 'alquiler',
      estado: 'confirmada',
      fecha_inicio: '2026-10-01',
      fecha_fin: '2026-10-10'
    });

    assert.equal(data, null);
    assert.ok(error);
    assert.equal(error.code, '23P01');
    assert.match(error.message, /reservas_sin_solape/);
  });
});
