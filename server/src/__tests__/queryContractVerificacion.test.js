// Test de CONTRATO de las consultas de utils/verificacionEmail.js (H18), con el mismo método que
// queryContractRefresh.test.js: el código real contra el cliente REAL de supabase-js y un fetch
// falso que registra la petición HTTP exacta que saldría hacia PostgREST. Sobre todo, que gastar un
// enlace es UNA sola petición condicional (PATCH con usado_en=is.null), la única puerta frente a dos
// confirmaciones a la vez, y que asociar los pedidos de invitado filtra por el email ESCAPADO dentro
// del jsonb y solo los que no tienen cuenta.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../data/supabase');
const verificacionEmail = require('../utils/verificacionEmail');

const FILA = {
  id: 've-1',
  cliente_id: 'cli-1',
  email: 'ana@example.com',
  motivo: 'registro',
  expira_en: new Date(Date.now() + 3600000).toISOString(),
  usado_en: null
};

let peticiones;
const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const peticion = {
    metodo: (init.method || 'GET').toUpperCase(),
    ruta: u.pathname,
    params: Object.fromEntries(u.searchParams),
    cuerpo: init.body ? JSON.parse(init.body) : null
  };
  peticiones.push(peticion);
  if (peticion.ruta === '/rest/v1/pedidos') return json(200, [{ id: 'p1' }]);
  if (peticion.ruta !== '/rest/v1/verificaciones_email')
    return json(404, { message: 'no prevista' });
  if (peticion.metodo === 'GET') return json(200, FILA);
  if (peticion.metodo === 'POST') return json(201);
  if (peticion.metodo === 'PATCH') return json(200, [{ id: 've-1' }]);
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

describe('verificación del email — las peticiones que salen hacia PostgREST', () => {
  test('crear: borra los enlaces sin usar de la cuenta y guarda solo el HMAC', async () => {
    const token = await verificacionEmail.crear({
      clienteId: 'cli-1',
      email: 'ana@example.com',
      motivo: 'registro'
    });

    const [borrado] = de('DELETE');
    assert.equal(borrado.params.cliente_id, 'eq.cli-1');
    assert.equal(borrado.params.usado_en, 'is.null', 'los ya usados se conservan');

    const [insercion] = de('POST');
    assert.equal(insercion.cuerpo.token_hash, verificacionEmail.hashear(token));
    assert.ok(!JSON.stringify(insercion.cuerpo).includes(token), 'nunca viaja el token en claro');
    assert.equal(insercion.cuerpo.motivo, 'registro');
  });

  test('consumir: busca por el HMAC sin usar y gasta con un solo PATCH condicional', async () => {
    const fila = await verificacionEmail.consumir('token-presentado');

    assert.equal(fila.id, 've-1');
    const [lectura] = de('GET');
    assert.equal(lectura.params.token_hash, `eq.${verificacionEmail.hashear('token-presentado')}`);
    assert.equal(lectura.params.usado_en, 'is.null');

    const gastos = de('PATCH');
    assert.equal(gastos.length, 1, 'comprobar y gastar a la vez');
    assert.equal(gastos[0].params.id, 'eq.ve-1');
    assert.equal(gastos[0].params.usado_en, 'is.null', 'la condición viaja en la propia petición');
    assert.ok(gastos[0].cuerpo.usado_en);
  });

  test('asociar pedidos de invitado: solo sin cuenta, por el email escapado dentro del jsonb', async () => {
    const asociados = await verificacionEmail.asociarPedidosDeInvitado(
      'cli-1',
      'juan_perez@example.com'
    );

    assert.equal(asociados, 1);
    const [patch] = de('PATCH');
    assert.equal(patch.ruta, '/rest/v1/pedidos');
    assert.deepEqual(patch.cuerpo, { cliente_id: 'cli-1' });
    assert.equal(patch.params.cliente_id, 'is.null');
    assert.equal(patch.params['cliente_info->>email'], 'ilike.juan\\_perez@example.com');
  });
});
