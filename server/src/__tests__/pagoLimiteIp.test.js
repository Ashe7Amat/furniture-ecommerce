// H29: límite por IP de POST /api/muebles/crear-sesion-pago (20 cada 15 minutos). El límite por
// email va en pagoLimiteEmail.test.js: cada archivo corre en su propio proceso, con los contadores
// a cero, y así un límite no se come al otro.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = '';
process.env.CLIENT_URL = 'https://tienda.example.com';

const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PIEZA = '00000001-aaaa-4bbb-8ccc-000000000001';
const MENSAJE = {
  error: 'Demasiados intentos de pago seguidos. Espera unos minutos antes de volver a intentarlo.'
};

let crearSesionDeStripe;
beforeEach(() => {
  const fake = crearFakeSupabase({
    muebles: [
      { id: PIEZA, nombre: 'Silla', precio_venta: 100, estado: 'disponible', disponible: true }
    ]
  });
  mock.method(supabase, 'from', fake.from);
  crearSesionDeStripe = mock.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test' }));
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { create: crearSesionDeStripe } }
  }));
  mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

const pedirPago = (cuerpo) => request(app).post('/api/muebles/crear-sesion-pago').send(cuerpo);
const carrito = [{ productId: PIEZA, modalidad: 'compra' }];

describe('H29 — límite por IP de crear-sesion-pago', () => {
  test('20 intentos desde la misma IP pasan; el 21 da 429 y ya no crea ninguna sesión en Stripe', async () => {
    // Emails distintos en cada uno, para que no salte antes el límite por email (10).
    for (let i = 1; i <= 20; i++) {
      const res = await pedirPago({
        items: carrito,
        clienteInfo: { email: `comprador${i}@ejemplo.com` }
      });
      assert.equal(res.status, 200, `el intento ${i} todavía pasa`);
    }
    assert.equal(crearSesionDeStripe.mock.callCount(), 20);

    const res = await pedirPago({ items: carrito, clienteInfo: { email: 'otro@ejemplo.com' } });

    assert.equal(res.status, 429);
    assert.deepEqual(res.body, MENSAJE);
    assert.equal(crearSesionDeStripe.mock.callCount(), 20, 'la 21 no llega a Stripe');
  });

  test('una vez en el límite, tampoco pasa una petición mal formada (el límite va antes de validar)', async () => {
    const res = await pedirPago({ items: 'no-es-una-lista' });

    assert.equal(res.status, 429);
  });
});
