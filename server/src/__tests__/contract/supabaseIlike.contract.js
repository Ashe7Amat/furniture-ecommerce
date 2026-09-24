// Test de CONTRATO contra el PostgREST REAL de Supabase: comprueba que escaparIlike
// (utils/ilike.js) hace literales los comodines de ILIKE de verdad, y no solo en el doble en
// memoria. Es la comprobación que cierra H17 (ver docs/mejoras-tecnicas.md).
//
// NO forma parte de "npm test": necesita red y las credenciales de server/.env. Se lanza a mano con
//   npm run test:supabase-ilike
// Sin SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY reales en server/.env, se omite.
// Es de SOLO LECTURA y solo consulta la tabla `categorias`, que es pública: no lee ni imprime datos
// personales. Los patrones se construyen con los nombres que haya en ese momento, así que no
// depende de ninguna categoría concreta.
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { escaparIlike } = require('../../utils/ilike');

const url = process.env.SUPABASE_URL || '';
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hayCredenciales =
  url.startsWith('https://') && !url.includes('test.supabase.co') && clave.length > 20;

describe(
  'ILIKE en el PostgREST real: comodines y su escape',
  { skip: !hayCredenciales && 'sin credenciales reales en server/.env' },
  () => {
    let db;
    let nombres;
    let base; // un nombre de categoría de al menos 3 caracteres, sin caracteres especiales

    before(async () => {
      db = createClient(url, clave, { auth: { persistSession: false } });
      const { data, error } = await db.from('categorias').select('nombre');
      assert.ifError(error);
      nombres = data.map((c) => c.nombre);
      base = nombres.find((n) => n.length >= 3 && !/[\\%_*]/.test(n));
      assert.ok(base, 'hace falta al menos una categoría con un nombre sin caracteres especiales');
    });

    const contar = async (patron) => {
      const { data, error } = await db.from('categorias').select('nombre').ilike('nombre', patron);
      assert.ifError(error);
      return data.length;
    };
    // Cuántos nombres son iguales, sin distinguir mayúsculas, a un texto tomado literalmente.
    const igualesA = (texto) =>
      nombres.filter((n) => n.toLowerCase() === texto.toLowerCase()).length;
    const empiezanPor = (prefijo) =>
      nombres.filter((n) => n.toLowerCase().startsWith(prefijo.toLowerCase())).length;

    test("'_' sin escapar es comodín; escapado se compara literal", async () => {
      const conGuion = `${base[0]}_${base.slice(2)}`; // la segunda letra cambiada por '_'
      assert.ok(
        (await contar(conGuion)) >= 1,
        `"${conGuion}" debería coincidir al menos con "${base}"`
      );
      assert.equal(await contar(escaparIlike(conGuion)), igualesA(conGuion));
    });

    test("'%' y '*' sin escapar son comodines; escapados se comparan literal", async () => {
      const prefijo = base.slice(0, 2);
      assert.equal(await contar(`${prefijo}%`), empiezanPor(prefijo));
      assert.equal(await contar(`${prefijo}*`), empiezanPor(prefijo));
      assert.equal(await contar(escaparIlike(`${prefijo}%`)), igualesA(`${prefijo}%`));
      assert.equal(await contar(escaparIlike(`${prefijo}*`)), igualesA(`${prefijo}*`));
    });

    test('un nombre escapado sigue encontrándose a sí mismo, también en otras mayúsculas', async () => {
      assert.equal(await contar(escaparIlike(base)), igualesA(base));
      assert.equal(await contar(escaparIlike(base.toUpperCase())), igualesA(base));
    });
  }
);
