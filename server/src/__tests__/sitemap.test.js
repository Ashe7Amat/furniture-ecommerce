const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const app = require('../index');
const supabase = require('../data/supabase');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

let fake;

beforeEach(() => {
  fake = crearFakeSupabase({
    categorias: [
      { id: 'cat-1', nombre: 'Sillas' },
      { id: 'cat-2', nombre: 'Mesas Vintage' }
    ],
    muebles: [
      {
        id: 'm-1',
        nombre: 'Silla Thonet',
        estado: 'disponible',
        updated_at: '2026-10-20T10:00:00Z'
      },
      {
        id: 'm-2',
        nombre: 'Aparador Nórdico',
        estado: 'disponible',
        created_at: '2026-10-18T10:00:00Z'
      },
      {
        id: 'm-vendido',
        nombre: 'Mesa Vendida',
        estado: 'vendido'
      }
    ]
  });
  mock.method(supabase, 'from', fake.from);
});

afterEach(() => mock.restoreAll());

describe('GET /sitemap.xml', () => {
  test('devuelve XML válido con Content-Type application/xml; charset=utf-8', async () => {
    const res = await request(app).get('/sitemap.xml');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml;\s*charset=utf-8/i);
    assert.ok(res.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(res.text.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  });

  test('incluye Home con prioridad 1.0 y Catálogo con 0.9', async () => {
    const res = await request(app).get('/sitemap.xml');

    assert.ok(res.text.includes('<loc>https://www.nave5barcelona.com/</loc>'));
    assert.ok(res.text.includes('<priority>1.0</priority>'));
    assert.ok(res.text.includes('<loc>https://www.nave5barcelona.com/catalogo</loc>'));
    assert.ok(res.text.includes('<priority>0.9</priority>'));
  });

  test('incluye categorías activas con prioridad 0.8', async () => {
    const res = await request(app).get('/sitemap.xml');

    assert.ok(res.text.includes('<loc>https://www.nave5barcelona.com/catalogo?categoria=Sillas</loc>'));
    assert.ok(res.text.includes('<loc>https://www.nave5barcelona.com/catalogo?categoria=Mesas%20Vintage</loc>'));
    assert.ok(res.text.includes('<priority>0.8</priority>'));
  });

  test('incluye solo piezas disponibles con prioridad 0.7 y fecha lastmod', async () => {
    const res = await request(app).get('/sitemap.xml');

    assert.ok(res.text.includes('<loc>https://www.nave5barcelona.com/mueble/m-1</loc>'));
    assert.ok(res.text.includes('<lastmod>2026-10-20</lastmod>'));
    assert.ok(res.text.includes('<loc>https://www.nave5barcelona.com/mueble/m-2</loc>'));
    assert.ok(res.text.includes('<priority>0.7</priority>'));

    // No debe incluir la pieza vendida
    assert.equal(res.text.includes('/mueble/m-vendido'), false);
  });
});
