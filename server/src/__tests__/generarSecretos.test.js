const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { generarSecretos, imprimirSecretos } = require('../../scripts/generarSecretos');

describe('generarSecretos script', () => {
  test('genera secretos criptográficos con la longitud y formato esperados', () => {
    const s1 = generarSecretos();
    const s2 = generarSecretos();

    // Longitud en hex: 48 bytes -> 96 hex chars, 32 bytes -> 64 hex chars
    assert.match(s1.JWT_SECRET, /^[0-9a-f]{96}$/);
    assert.match(s1.REFRESH_TOKEN_HASH_SECRET, /^[0-9a-f]{64}$/);
    assert.match(s1.EMAIL_TOKEN_HASH_SECRET, /^[0-9a-f]{64}$/);

    // Asegurar entropía: ejecuciones sucesivas generan claves distintas
    assert.notEqual(s1.JWT_SECRET, s2.JWT_SECRET);
    assert.notEqual(s1.REFRESH_TOKEN_HASH_SECRET, s2.REFRESH_TOKEN_HASH_SECRET);
    assert.notEqual(s1.EMAIL_TOKEN_HASH_SECRET, s2.EMAIL_TOKEN_HASH_SECRET);
  });

  test('imprimirSecretos devuelve el texto listo para variables de entorno', () => {
    const output = imprimirSecretos();
    assert.match(output, /JWT_SECRET=[0-9a-f]{96}/);
    assert.match(output, /REFRESH_TOKEN_HASH_SECRET=[0-9a-f]{64}/);
    assert.match(output, /EMAIL_TOKEN_HASH_SECRET=[0-9a-f]{64}/);
  });
});
