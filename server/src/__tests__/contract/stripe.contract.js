// Test de CONTRATO contra la API REAL de Stripe en modo test. Comprueba que los límites en los
// que se basa utils/metadataStripe.js (500 caracteres por valor, 50 claves, 40 por nombre de
// clave) son los que Stripe aplica de verdad, y que la metadata que genera crear-sesion-pago se
// acepta y se recupera idéntica, en lugar de fiarse solo de la documentación.
//
// NO forma parte de "npm test": necesita red y una clave, y crea sesiones de Checkout de prueba
// en tu cuenta de Stripe (se caducan al terminar; no cobran nada). Se lanza a mano con
//   npm run test:stripe
// tras poner una clave de PRUEBA en server/.env (STRIPE_SECRET_KEY=sk_test_...). Sin ella se omite.
// Con una clave real (sk_live_...) se niega a ejecutarse, antes de hacer ninguna llamada.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const Stripe = require('stripe');
const { construirMetadataPago, leerItemsDeMetadata, MAX_CLAVES, MAX_VALOR, MAX_NOMBRE_CLAVE } = require('../../utils/metadataStripe');

const clave = process.env.STRIPE_SECRET_KEY || '';
const esDePrueba = clave.startsWith('sk_test_') || clave.startsWith('rk_test_');
const esReal = clave.startsWith('sk_live_') || clave.startsWith('rk_live_');

if (esReal) {
  throw new Error('STRIPE_SECRET_KEY es una clave REAL: este test solo puede ejecutarse con una clave de prueba (sk_test_...).');
}

const uuid = (n) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-${String(n).padStart(12, '0')}`;
const carrito = (piezas) => Array.from({ length: piezas }, (_, i) => ({ productId: uuid(i), modalidad: i % 2 ? 'alquiler' : 'compra' }));
const comprador = { nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456', direccion: 'Calle Mayor 15, 08001 Barcelona', notas: 'n'.repeat(500) };

describe('Stripe (modo test): límites de la metadata', { skip: esDePrueba ? false : 'No hay una STRIPE_SECRET_KEY de prueba (sk_test_...) en server/.env' }, () => {
  let stripe;
  const creadas = [];

  const crearSesion = async (metadata) => {
    const sesion = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'eur', product_data: { name: 'Prueba de contrato Nave 5 (no cobrar)' }, unit_amount: 100 }, quantity: 1 }],
      success_url: 'https://example.com/exito?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://example.com/cancelado',
      metadata
    });
    creadas.push(sesion.id);
    return sesion;
  };

  const rechazadaPorStripe = (error) => error && error.type === 'StripeInvalidRequestError';

  before(() => { stripe = new Stripe(clave); });

  // Deja las sesiones de prueba caducadas para que no queden abiertas en la cuenta
  after(async () => {
    for (const id of creadas) {
      try { await stripe.checkout.sessions.expire(id); } catch { /* ya caducada */ }
    }
  });

  test('un valor de 500 caracteres se acepta y uno de 501 se rechaza (MAX_VALOR)', async () => {
    assert.equal(MAX_VALOR, 500);
    await crearSesion({ valor: 'x'.repeat(500) });
    await assert.rejects(crearSesion({ valor: 'x'.repeat(501) }), (error) => rechazadaPorStripe(error) && /500/.test(error.message));
  });

  test('50 claves se aceptan y 51 se rechazan (MAX_CLAVES)', async () => {
    assert.equal(MAX_CLAVES, 50);
    const claves = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 'v']));
    await crearSesion(claves(50));
    await assert.rejects(crearSesion(claves(51)), rechazadaPorStripe);
  });

  test('un nombre de clave de 40 caracteres se acepta y uno de 41 se rechaza (MAX_NOMBRE_CLAVE)', async () => {
    assert.equal(MAX_NOMBRE_CLAVE, 40);
    await crearSesion({ ['k'.repeat(40)]: 'v' });
    await assert.rejects(crearSesion({ ['k'.repeat(41)]: 'v' }), rechazadaPorStripe);
  });

  test('el formato ANTIGUO (todo el carrito en un solo valor) falla con 7 piezas: el fallo original', async () => {
    const items = carrito(7).map(({ productId, modalidad }) => ({ productId, modalidad }));
    const unSoloValor = JSON.stringify(items);
    assert.ok(unSoloValor.length > MAX_VALOR, 'el caso de prueba debe superar el límite');

    await assert.rejects(crearSesion({ items: unSoloValor }), (error) => rechazadaPorStripe(error) && /500/.test(error.message));
  });

  test('7 piezas con el formato NUEVO se aceptan y se recuperan idénticas', async () => {
    const items = carrito(7);
    const enviada = construirMetadataPago({ items, clienteInfo: comprador });

    const sesion = await crearSesion(enviada);
    const recuperada = await stripe.checkout.sessions.retrieve(sesion.id);

    assert.deepEqual(leerItemsDeMetadata(recuperada.metadata), items);
  });

  test('100 piezas y notas de 500 caracteres se aceptan, y Stripe devuelve la metadata exactamente como se envió', async () => {
    const items = carrito(100);
    const enviada = construirMetadataPago({ items, clienteInfo: comprador });

    const sesion = await crearSesion(enviada);
    const recuperada = await stripe.checkout.sessions.retrieve(sesion.id);

    assert.deepEqual(recuperada.metadata, enviada, 'Stripe no debe alterar, recortar ni perder ninguna clave');
    assert.deepEqual(leerItemsDeMetadata(recuperada.metadata), items);
  });

  test('un dato del comprador vacío no rompe la creación (se guarda vacío o se omite)', async () => {
    const enviada = construirMetadataPago({ items: carrito(1), clienteInfo: { ...comprador, notas: '' } });

    const sesion = await crearSesion(enviada);
    const recuperada = await stripe.checkout.sessions.retrieve(sesion.id);

    assert.ok(recuperada.metadata.clienteNotas === '' || recuperada.metadata.clienteNotas === undefined);
    assert.deepEqual(leerItemsDeMetadata(recuperada.metadata), carrito(1));
  });
});

// Sin clave de prueba, node:test necesita al menos un test para dar un resultado legible
if (!esDePrueba) {
  test('sin STRIPE_SECRET_KEY de prueba el contrato con Stripe no se ha comprobado', { skip: 'ver la cabecera de este archivo' }, () => {});
}
