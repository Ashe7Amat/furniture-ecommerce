// Tests de utils/stripe.js, getStripe: el cliente de Stripe se crea solo si hay clave, la primera
// vez que se pide, y después se reutiliza. Crear el cliente no hace ninguna petición a Stripe.
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const claveOriginal = process.env.STRIPE_SECRET_KEY;
afterEach(() => {
  if (claveOriginal === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = claveOriginal;
  delete require.cache[require.resolve('../utils/stripe')];
});
const cargar = () => {
  delete require.cache[require.resolve('../utils/stripe')];
  return require('../utils/stripe');
};

describe('getStripe', () => {
  test('sin STRIPE_SECRET_KEY devuelve null (los pagos responden 503, "no configurados")', () => {
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(cargar().getStripe(), null);
  });

  test('con clave crea el cliente la primera vez y después devuelve siempre el mismo', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_clave_de_prueba';
    const { getStripe } = cargar();

    const primero = getStripe();
    assert.ok(primero);
    assert.equal(typeof primero.checkout.sessions.create, 'function');
    assert.equal(getStripe(), primero);
  });
});
