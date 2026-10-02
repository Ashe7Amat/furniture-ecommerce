// Fase C (C1): MOSTRAR_PRECIOS. Sin "true", las lecturas públicas de muebles devuelven los precios
// a null y no se puede iniciar un pago; el panel sigue viendo los precios reales; la base de datos
// no se toca. testEnv.js la pone a "true" para el resto de tests: aquí se cambia en cada caso y se
// restaura al acabar.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { preciosVisibles, paraElPublico } = require('../utils/precios');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const ID = '11111111-2222-4333-8444-555555555555';
const MUEBLES = [
  {
    id: ID,
    nombre: 'Aparador de roble',
    categoria: 'Mesas',
    descripcion: 'Restaurado',
    precio_venta: 450,
    precio_alquiler_dia: 20,
    imagenes: [],
    estado: 'disponible',
    referencia: 'NAV-MES-001',
    created_at: '2026-09-01T10:00:00Z'
  },
  {
    id: 'm2',
    nombre: 'Silla Tolix',
    categoria: 'Sillas',
    descripcion: 'Metal',
    precio_venta: null,
    precio_alquiler_dia: 8,
    imagenes: [],
    estado: 'disponible',
    referencia: 'NAV-SIL-001',
    created_at: '2026-09-02T10:00:00Z'
  }
];

const valorOriginal = process.env.MOSTRAR_PRECIOS;
let fake;
const conValor = (valor) => {
  if (valor === undefined) delete process.env.MOSTRAR_PRECIOS;
  else process.env.MOSTRAR_PRECIOS = valor;
};
beforeEach(() => {
  fake = crearFakeSupabase({ muebles: MUEBLES });
  mock.method(supabase, 'from', fake.from);
});
afterEach(() => {
  mock.restoreAll();
  process.env.MOSTRAR_PRECIOS = valorOriginal;
});

const lecturasPublicas = [
  ['GET /api/muebles', () => request(app).get('/api/muebles')],
  ['GET /api/muebles?limit=1', () => request(app).get('/api/muebles?limit=1')],
  ['GET /api/muebles/buscar', () => request(app).get('/api/muebles/buscar?q=a')],
  [`GET /api/muebles/:id`, () => request(app).get(`/api/muebles/${ID}`)]
];
const comoLista = (body) => (Array.isArray(body) ? body : [body]);

describe('MOSTRAR_PRECIOS: qué cuenta como "enseñar precios"', () => {
  for (const [valor, esperado] of [
    ['true', true],
    [undefined, false],
    ['', false],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    [' true', false]
  ]) {
    test(`${JSON.stringify(valor)} -> ${esperado ? 'con' : 'sin'} precios`, () => {
      conValor(valor);
      assert.equal(preciosVisibles(), esperado);
    });
  }

  test('paraElPublico no cambia el objeto de entrada, y respeta listas y objetos sueltos', () => {
    conValor('false');
    const original = { ...MUEBLES[0] };
    const resultado = paraElPublico(original);
    assert.equal(resultado.precio_venta, null);
    assert.equal(original.precio_venta, 450);
    assert.deepEqual(
      paraElPublico(MUEBLES).map((m) => m.precio_alquiler_dia),
      [null, null]
    );
  });
});

describe('lecturas públicas sin MOSTRAR_PRECIOS=true (C1)', () => {
  for (const valor of [undefined, 'false']) {
    for (const [nombre, peticion] of lecturasPublicas) {
      test(`${nombre} con MOSTRAR_PRECIOS=${valor}: los dos precios a null, el resto igual`, async () => {
        conValor(valor);
        const res = await peticion();
        assert.equal(res.status, 200);
        const muebles = comoLista(res.body);
        assert.ok(muebles.length > 0);
        for (const m of muebles) {
          assert.equal(m.precio_venta, null);
          assert.equal(m.precio_alquiler_dia, null);
          assert.ok(m.nombre && m.referencia, 'el resto de campos sigue llegando');
        }
      });
    }
  }

  test('la base de datos no se toca: los precios siguen ahí', async () => {
    conValor('false');
    await request(app).get('/api/muebles');
    assert.equal(fake.escrituras.length, 0);
    assert.equal(fake.tablas.muebles[0].precio_venta, 450);
  });
});

describe('lecturas públicas con MOSTRAR_PRECIOS=true (C1)', () => {
  for (const [nombre, peticion] of lecturasPublicas) {
    test(`${nombre}: precios reales`, async () => {
      conValor('true');
      const res = await peticion();
      const muebles = comoLista(res.body);
      assert.ok(muebles.length > 0);
      for (const m of muebles) {
        const real = MUEBLES.find((o) => o.id === m.id);
        assert.equal(m.precio_venta, real.precio_venta);
        assert.equal(m.precio_alquiler_dia, real.precio_alquiler_dia);
      }
    });
  }
});

describe('el panel (GET /api/admin/muebles) ve siempre los precios reales (C1)', () => {
  for (const valor of [undefined, 'false', 'true']) {
    test(`con MOSTRAR_PRECIOS=${valor}`, async () => {
      conValor(valor);
      const res = await request(app)
        .get('/api/admin/muebles')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      assert.equal(res.status, 200);
      const aparador = res.body.find((m) => m.id === ID);
      assert.equal(aparador.precio_venta, 450);
      assert.equal(aparador.precio_alquiler_dia, 20);
    });
  }
});

describe('POST /api/muebles/crear-sesion-pago con los precios ocultos (C1)', () => {
  const carrito = {
    items: [{ productId: ID, nombre: 'Aparador de roble', modalidad: 'compra', cantidad: 1 }],
    clienteInfo: {
      nombre: 'Ana',
      email: 'ana@test.com',
      telefono: '600000000',
      direccion: 'Calle 1'
    }
  };

  test('403 con un mensaje que manda a contacto, sin leer la base de datos ni llamar a Stripe', async () => {
    conValor('false');
    const getStripe = mock.method(stripeUtil, 'getStripe', () => {
      throw new Error('no debería llamarse');
    });
    const res = await request(app).post('/api/muebles/crear-sesion-pago').send(carrito);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /compra online no está disponible/);
    assert.match(res.body.error, /contacto/);
    assert.equal(getStripe.mock.callCount(), 0);
    assert.equal(fake.escrituras.length, 0);
  });

  test('sin la variable puesta, igual: el valor por defecto es "ocultos"', async () => {
    conValor(undefined);
    const res = await request(app).post('/api/muebles/crear-sesion-pago').send(carrito);
    assert.equal(res.status, 403);
  });

  test('con MOSTRAR_PRECIOS=true sigue el camino de siempre (sin Stripe configurado, 503)', async () => {
    conValor('true');
    mock.method(stripeUtil, 'getStripe', () => null);
    const res = await request(app).post('/api/muebles/crear-sesion-pago').send(carrito);
    assert.equal(res.status, 503);
  });
});
