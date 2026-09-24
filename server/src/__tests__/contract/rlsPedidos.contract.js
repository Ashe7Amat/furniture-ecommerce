// Test de CONTRATO contra la base de datos REAL: con la clave pública (`anon`), la API REST de
// Supabase no deja leer ni `pedidos` ni `clientes`, y el servidor, con `service_role`, sí. Es la
// comprobación de H9 (migración 20260924195451_fix_pedidos_admin_policy, ver
// docs/mejoras-tecnicas.md). Antes de aplicarla, este test fallaba: con la clave anon se leían los
// 3 pedidos que había.
//
// Ojo con qué se espera: con RLS activo y sin ninguna política que lo permita, PostgREST NO
// responde 401 ni 403, sino 200 con una lista vacía, porque RLS filtra filas, no rechaza la
// petición. Por eso se comprueba que no hay error y que llegan 0 filas.
//
// NO forma parte de "npm test": necesita red y SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY reales en server/.env. Se lanza a mano con
//   npm run test:supabase-rls
// Sin ellas, se omite. Es de SOLO LECTURA y solo pide la columna `id`: aunque RLS fallara, no
// saldría ningún dato personal.
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const claveAnon = process.env.SUPABASE_ANON_KEY || '';
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hayCredenciales =
  url.startsWith('https://') &&
  !url.includes('test.supabase.co') &&
  claveAnon.length > 20 &&
  claveServicio.length > 20;

describe(
  'RLS en la base de datos real: la clave anon no lee pedidos ni clientes',
  { skip: !hayCredenciales && 'sin credenciales reales en server/.env' },
  () => {
    let anon;
    let servicio;

    before(() => {
      const opciones = { auth: { persistSession: false } };
      anon = createClient(url, claveAnon, opciones);
      servicio = createClient(url, claveServicio, opciones);
    });

    for (const tabla of ['pedidos', 'clientes']) {
      test(`con la clave anon, "${tabla}" responde sin error y con 0 filas`, async () => {
        const { data, error } = await anon.from(tabla).select('id');
        assert.equal(error, null, 'RLS filtra filas: no tiene que devolver un error');
        assert.equal(data.length, 0);
      });
    }

    test('con service_role (lo que usa el servidor), "pedidos" sí devuelve sus filas', async () => {
      const { data, error } = await servicio.from('pedidos').select('id');
      assert.equal(error, null);
      assert.ok(data.length > 0, 'la tabla de pedidos no debería estar vacía');
    });
  }
);
