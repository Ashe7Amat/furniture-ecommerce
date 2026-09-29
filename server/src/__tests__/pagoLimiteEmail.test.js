// H29: límite por email de POST /api/muebles/crear-sesion-pago (10 cada 15 minutos por email del
// comprador). El límite por IP (20) tiene su propio archivo, pagoLimiteIp.test.js. Aquí se simula
// Vercel (VERCEL=1 activa `trust proxy`) para que cada test llegue desde una IP distinta
// (X-Forwarded-For) y el límite por IP no se mezcle con el del email.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.VERCEL = '1';
process.env.RESEND_API_KEY = '';
process.env.CLIENT_URL = 'https://tienda.example.com';

const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

const PIEZA = '00000001-aaaa-4bbb-8ccc-000000000001';

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

const pedirPago = (ip, cuerpo) =>
  request(app).post('/api/muebles/crear-sesion-pago').set('X-Forwarded-For', ip).send(cuerpo);
const conEmail = (email) => ({
  items: [{ productId: PIEZA, modalidad: 'compra' }],
  clienteInfo: email === undefined ? { nombre: 'Sin email' } : { email }
});

describe('H29 — límite por email de crear-sesion-pago', () => {
  test('10 intentos con el mismo email pasan (aunque cambien las mayúsculas y los espacios); el 11 da 429', async () => {
    const variantes = ['ana@ejemplo.com', 'ANA@ejemplo.com', ' ana@EJEMPLO.com '];
    for (let i = 1; i <= 10; i++) {
      const res = await pedirPago('203.0.113.1', conEmail(variantes[i % variantes.length]));
      assert.equal(res.status, 200, `el intento ${i} todavía pasa`);
    }

    const res = await pedirPago('203.0.113.1', conEmail('Ana@Ejemplo.com'));

    assert.equal(res.status, 429);
    assert.deepEqual(res.body, {
      error:
        'Demasiados intentos de pago seguidos. Espera unos minutos antes de volver a intentarlo.'
    });
    assert.equal(crearSesionDeStripe.mock.callCount(), 10, 'la 11 no llega a Stripe');
  });

  test('es por email, no por IP: el mismo email bloqueado lo está también desde otra IP', async () => {
    const res = await pedirPago('203.0.113.2', conEmail('ana@ejemplo.com'));

    assert.equal(res.status, 429);
  });

  test('desde la IP del bloqueo, otro email sigue pudiendo pagar', async () => {
    assert.equal((await pedirPago('203.0.113.1', conEmail('bea@ejemplo.com'))).status, 200);
  });

  test('sin email en el cuerpo no se aplica el límite por email (solo el de IP)', async () => {
    for (let i = 1; i <= 12; i++) {
      assert.equal(
        (await pedirPago('203.0.113.3', conEmail(undefined))).status,
        200,
        `intento ${i}`
      );
    }
  });

  test('las peticiones que no pasan la validación no gastan el límite del email', async () => {
    for (let i = 1; i <= 10; i++) {
      const mal = await pedirPago('203.0.113.4', {
        items: [],
        clienteInfo: { email: 'carla@ejemplo.com' }
      });
      assert.equal(mal.status, 400);
    }

    // Si esas 10 hubieran contado, esta sería la 11 y daría 429.
    assert.equal((await pedirPago('203.0.113.4', conEmail('carla@ejemplo.com'))).status, 200);
  });
});
