const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

let fake;

beforeEach(() => {
  fake = crearFakeSupabase({ muebles: [{ id: 'm-1', nombre: 'Mesa' }] });
  mock.method(supabase, 'from', fake.from);
});

afterEach(() => mock.restoreAll());

describe('GET /api/health — Endpoint público de salud', () => {
  test('devuelve 200 y status "ok" cuando Supabase y Stripe responden correctamente', async () => {
    mock.method(stripeUtil, 'getStripe', () => ({
      balance: {
        retrieve: async () => ({ object: 'balance', available: [] })
      }
    }));

    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.deepEqual(res.body.checks, {
      supabase: 'ok',
      stripe: 'ok'
    });
    assert.ok(res.body.timestamp);
    assert.ok(!isNaN(Date.parse(res.body.timestamp)));

    // Verificar que NO se exponen secretos, versiones ni URLs
    assert.equal('version' in res.body, false);
    assert.equal('url' in res.body, false);
    assert.equal('secret' in res.body, false);
    const bodyStr = JSON.stringify(res.body);
    assert.equal(bodyStr.includes('supabase.co'), false);
    assert.equal(bodyStr.includes('sk_test'), false);
  });

  test('devuelve 200 y status "degraded" cuando Supabase falla pero Stripe responde', async () => {
    mock.method(stripeUtil, 'getStripe', () => ({
      balance: {
        retrieve: async () => ({ object: 'balance' })
      }
    }));
    fake.fallos['muebles.select'] = new Error('Database connection timeout');

    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'degraded');
    assert.deepEqual(res.body.checks, {
      supabase: 'fail',
      stripe: 'ok'
    });
    assert.ok(res.body.timestamp);
  });

  test('devuelve 200 y status "degraded" cuando Supabase responde pero Stripe falla', async () => {
    mock.method(stripeUtil, 'getStripe', () => ({
      balance: {
        retrieve: async () => {
          throw new Error('Stripe API error');
        }
      }
    }));

    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'degraded');
    assert.deepEqual(res.body.checks, {
      supabase: 'ok',
      stripe: 'fail'
    });
    assert.ok(res.body.timestamp);
  });

  test('devuelve 503 y status "down" cuando tanto Supabase como Stripe fallan', async () => {
    mock.method(stripeUtil, 'getStripe', () => ({
      balance: {
        retrieve: async () => {
          throw new Error('Stripe service unavailable');
        }
      }
    }));
    fake.fallos['muebles.select'] = new Error('Database unreachable');

    const res = await request(app).get('/api/health');

    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'down');
    assert.deepEqual(res.body.checks, {
      supabase: 'fail',
      stripe: 'fail'
    });
    assert.ok(res.body.timestamp);
  });

  test('trata un timeout superior a 2s como fallo sin bloquear la respuesta', async () => {
    // Stripe tarda más de 2000ms
    mock.method(stripeUtil, 'getStripe', () => ({
      balance: {
        retrieve: () => new Promise((resolve) => setTimeout(resolve, 2500))
      }
    }));

    const inicio = Date.now();
    const res = await request(app).get('/api/health');
    const duracion = Date.now() - inicio;

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'degraded');
    assert.equal(res.body.checks.stripe, 'fail');
    assert.equal(res.body.checks.supabase, 'ok');
    assert.ok(duracion >= 1900 && duracion < 2600, `Duró ${duracion}ms, timeout esperado ~2000ms`);
  });
});
