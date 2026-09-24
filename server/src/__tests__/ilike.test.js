// escaparIlike (utils/ilike.js) y la fidelidad del doble en memoria con los comodines de ILIKE.
// Lo segundo importa tanto como lo primero: el doble solo entendía '%', así que los tests no
// podían ver H17 (un '_' en el email hacía de comodín en la base de datos real).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { escaparIlike } = require('../utils/ilike');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

describe('escaparIlike', () => {
  test("antepone '\\' a los comodines '_', '%' y '*', y al propio '\\'", () => {
    assert.equal(escaparIlike('juan_perez@x.com'), 'juan\\_perez@x.com');
    assert.equal(escaparIlike('a%b@x.com'), 'a\\%b@x.com');
    assert.equal(escaparIlike('a*b'), 'a\\*b');
    assert.equal(escaparIlike('a\\b@x.com'), 'a\\\\b@x.com');
  });

  test('un texto sin caracteres especiales sale igual', () => {
    assert.equal(escaparIlike('Ana.Garcia+tienda@example.com'), 'Ana.Garcia+tienda@example.com');
  });

  test('escapa todas las apariciones, no solo la primera', () => {
    assert.equal(escaparIlike('__%%'), '\\_\\_\\%\\%');
  });
});

describe('el doble en memoria trata ILIKE como el PostgREST real', () => {
  // Los mismos casos que se comprobaron contra el PostgREST real el 24 sep 2026 (ver utils/ilike.js
  // y contract/supabaseIlike.contract.js): el doble tiene que dar lo mismo.
  const consultar = async (patron) => {
    const fake = crearFakeSupabase({ categorias: [{ id: 1, nombre: 'Baúles y maletas' }] });
    const { data } = await fake.from('categorias').select('id').ilike('nombre', patron);
    return data.length;
  };

  test("'_' sin escapar es un comodín de un carácter; escapado es literal", async () => {
    assert.equal(await consultar('Ba_les y maletas'), 1);
    assert.equal(await consultar('Ba\\_les y maletas'), 0);
  });

  test("'%' y '*' sin escapar son comodines de cualquier secuencia; escapados son literales", async () => {
    assert.equal(await consultar('Ba%'), 1);
    assert.equal(await consultar('Ba*'), 1);
    assert.equal(await consultar('Ba\\%'), 0);
    assert.equal(await consultar('Ba\\*'), 0);
  });

  test('no distingue mayúsculas, y escaparIlike de un texto normal lo deja coincidir consigo mismo', async () => {
    assert.equal(await consultar('baúles Y MALETAS'), 1);
    assert.equal(await consultar(escaparIlike('Baúles y maletas')), 1);
  });
});
