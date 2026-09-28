// Test de CONTRATO de las consultas de utils/refreshTokens.js, con el mismo método que
// queryContract.test.js: el código real contra el cliente REAL de supabase-js y un fetch falso
// que registra la petición HTTP exacta que saldría hacia PostgREST. El doble en memoria prueba la
// lógica; esto prueba que la librería manda lo que esa lógica da por hecho. Sobre todo, que
// reclamar un token es UNA sola petición condicional (PATCH con revoked_at=is.null), la única
// puerta frente a dos peticiones simultáneas, y no un "leer y luego escribir".
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const refreshTokens = require('../utils/refreshTokens');

const FILA = {
  id: 'rt-1',
  user_id: 'cli-1',
  family_id: 'fam-1',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  revoked_at: null,
  replaced_by: null
};

let peticiones;
const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const cabeceras =
    init.headers instanceof Headers ? init.headers : new Headers(init.headers || {});
  const peticion = {
    metodo: (init.method || 'GET').toUpperCase(),
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams),
    prefer: cabeceras.get('Prefer'),
    cuerpo: init.body ? JSON.parse(init.body) : null
  };
  peticiones.push(peticion);
  if (peticion.ruta !== '/rest/v1/refresh_tokens') return json(404, { message: 'no prevista' });
  if (peticion.metodo === 'GET') return json(200, [FILA]);
  // `.insert().select('id').single()` pide un objeto (Accept: application/vnd.pgrst.object+json)
  if (peticion.metodo === 'POST') return json(201, { id: 'rt-2' });
  if (peticion.metodo === 'PATCH') return json(200, [{ id: 'rt-1' }]);
  if (peticion.metodo === 'DELETE') return json(200, []);
  return json(404, { message: 'no prevista' });
};

const de = (metodo) => peticiones.filter((p) => p.metodo === metodo);

beforeEach(() => {
  peticiones = [];
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
});
afterEach(() => mock.restoreAll());

describe('refresh tokens — las peticiones que salen hacia PostgREST', () => {
  test('rotar: busca por el HMAC, inserta el sucesor y reclama el viejo con un solo PATCH condicional', async () => {
    const resultado = await refreshTokens.rotar('token-presentado', { ip: '203.0.113.9' });

    assert.equal(resultado.ok, true);
    const [lectura] = de('GET');
    assert.equal(lectura.params.token_hash, `eq.${refreshTokens.hashear('token-presentado')}`);

    const [insercion] = de('POST');
    assert.equal(insercion.cuerpo.family_id, 'fam-1', 'el sucesor hereda la familia');
    assert.equal(insercion.cuerpo.user_id, 'cli-1');
    assert.equal(insercion.cuerpo.ip, '203.0.113.9');
    assert.equal(insercion.params.select, 'id');
    assert.ok(!('token' in insercion.cuerpo), 'nunca viaja el token en claro');

    const reclamos = de('PATCH');
    assert.equal(reclamos.length, 1, 'una sola petición: comprobar y revocar a la vez');
    assert.equal(reclamos[0].params.id, 'eq.rt-1');
    assert.equal(
      reclamos[0].params.revoked_at,
      'is.null',
      'la condición viaja en la propia petición'
    );
    assert.equal(reclamos[0].params.select, 'id');
    assert.match(reclamos[0].prefer, /return=representation/);
    assert.deepEqual(Object.keys(reclamos[0].cuerpo).sort(), ['replaced_by', 'revoked_at']);
    assert.equal(reclamos[0].cuerpo.replaced_by, 'rt-2');
  });

  test('revocar una familia y todas las sesiones de un usuario: PATCH condicional sobre las activas', async () => {
    await refreshTokens.revocarFamilia('fam-1');
    await refreshTokens.revocarTodasDelUsuario('cli-1');

    const [familia, usuario] = de('PATCH');
    assert.equal(familia.params.family_id, 'eq.fam-1');
    assert.equal(familia.params.revoked_at, 'is.null');
    assert.equal(usuario.params.user_id, 'eq.cli-1');
    assert.equal(usuario.params.revoked_at, 'is.null');
  });

  test('limpiarExpirados: un DELETE con expires_at=lt.<fecha de hace 30 días>', async () => {
    await refreshTokens.limpiarExpirados();

    const [borrado] = de('DELETE');
    const limite = new Date(borrado.params.expires_at.replace(/^lt\./, ''));
    const dias = (Date.now() - limite.getTime()) / 86400000;
    assert.ok(dias > 29.99 && dias < 30.01, `unos 30 días (${dias})`);
  });
});
