const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BRAND } = require('./brand.config');

test('la marca del servidor tiene los datos que usan los correos, el sitemap y las referencias', () => {
  assert.equal(BRAND.nombre, 'Nave 5 Barcelona');
  assert.match(BRAND.prefijoSku, /^[A-Z]{2,5}$/);
  assert.match(BRAND.web, /^https:\/\/[^/]+$/);
  assert.ok(BRAND.web.endsWith(BRAND.dominio));
  assert.match(BRAND.idInterno, /^[a-z0-9-]+$/);
  for (const color of Object.values(BRAND.email.colores)) assert.match(color, /^#[0-9A-F]{6}$/i);
});

test('la marca no se puede cambiar en marcha (está congelada)', () => {
  assert.ok(Object.isFrozen(BRAND));
  assert.ok(Object.isFrozen(BRAND.contacto));
  assert.ok(Object.isFrozen(BRAND.email.colores));
});
