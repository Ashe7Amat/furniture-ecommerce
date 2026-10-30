// Tests de GET /sitemap.xml (SEO del catálogo, 28 oct 2026): páginas fijas, una por categoría
// con piezas y una por ficha, sin precios, y con un sitemap mínimo si la base de datos falla.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');
const { BRAND } = require('../config/brand.config');

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { generarSitemap } = require('../controllers/sitemapController');

const WEB = BRAND.web;
const urls = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

afterEach(() => mock.restoreAll());

describe('GET /sitemap.xml', () => {
  let fake;
  let columnasPedidas;
  beforeEach(() => {
    fake = crearFakeSupabase({
      muebles: [
        {
          id: 'm1',
          nombre: 'Silla',
          categoria: 'Sillas y asientos',
          precio_venta: 90,
          created_at: '2026-10-01'
        },
        {
          id: 'm2',
          nombre: 'Mesa',
          categoria: 'Mesas y mobiliario',
          precio_venta: 950,
          created_at: '2026-10-02'
        },
        {
          id: 'm3',
          nombre: 'Otra silla',
          categoria: 'Sillas y asientos',
          created_at: '2026-10-03'
        },
        { id: 'm4', nombre: 'Sin categoría', categoria: null, created_at: '2026-10-04' }
      ]
    });
    columnasPedidas = [];
    mock.method(supabase, 'from', (tabla) => {
      const consulta = fake.from(tabla);
      const select = consulta.select.bind(consulta);
      consulta.select = (columnas, ...resto) => {
        columnasPedidas.push(columnas);
        return select(columnas, ...resto);
      };
      return consulta;
    });
  });

  test('es XML, cacheable por la CDN, con las páginas fijas, las categorías y todas las fichas', async () => {
    const res = await request(app).get('/sitemap.xml');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml/);
    assert.match(res.headers['cache-control'], /^public, max-age=3600/);
    assert.ok(res.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.deepEqual(urls(res.text), [
      `${WEB}/`,
      `${WEB}/catalogo`,
      `${WEB}/sobre-nosotros`,
      `${WEB}/sostenibilidad`,
      `${WEB}/contacto`,
      `${WEB}/legal`,
      `${WEB}/privacidad`,
      `${WEB}/terminos`,
      `${WEB}/catalogo?categoria=Mesas%20y%20mobiliario`,
      `${WEB}/catalogo?categoria=Sillas%20y%20asientos`,
      `${WEB}/mueble/m4`,
      `${WEB}/mueble/m3`,
      `${WEB}/mueble/m2`,
      `${WEB}/mueble/m1`
    ]);
  });

  test('solo pide id y categoría: los precios no pueden salir en el sitemap', async () => {
    const res = await request(app).get('/sitemap.xml');

    assert.deepEqual(columnasPedidas, ['id, categoria']);
    assert.doesNotMatch(res.text, /950|precio/);
  });

  test('si la base de datos falla, sirve las páginas fijas con una caché corta', async () => {
    fake = crearFakeSupabase({ muebles: [], fallos: { 'muebles.select': { message: 'caído' } } });
    mock.restoreAll();
    mock.method(supabase, 'from', fake.from);
    mock.method(console, 'error', () => {});

    const res = await request(app).get('/sitemap.xml');

    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'public, max-age=300');
    assert.equal(urls(res.text).length, 8);
  });
});

describe('generarSitemap', () => {
  test('escapa los caracteres especiales de XML', () => {
    const xml = generarSitemap([{ id: 'a&b', categoria: 'Mesas & <sillas>' }]);

    assert.ok(xml.includes(`<loc>${WEB}/catalogo?categoria=Mesas%20%26%20%3Csillas%3E</loc>`));
    assert.ok(xml.includes(`<loc>${WEB}/mueble/a%26b</loc>`));
    assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  test('sin muebles, solo las páginas fijas', () => {
    assert.equal(urls(generarSitemap([])).length, 8);
  });
});
