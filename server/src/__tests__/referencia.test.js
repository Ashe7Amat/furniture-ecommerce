// A4: referencias automáticas de muebles (NAV-COD-NNN). Dos partes:
// - utils/referencia.js por separado: el código de la categoría y el siguiente número;
// - POST /api/muebles: crearMueble guarda la referencia y reintenta si otro administrador se ha
//   quedado el mismo número a la vez (23505 en el índice único de muebles.referencia).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const {
  generarReferencia,
  obtenerCodigoCategoria,
  calcularSiguienteReferencia,
  MAX_REINTENTOS
} = require('../utils/referencia');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const conAuth = (req) => req.set('Authorization', `Bearer ${tokenAdmin}`);

const CATEGORIAS = [
  { id: 20, nombre: 'Sillas', codigo: 'SIL' },
  { id: 21, nombre: 'Mesas', codigo: 'MES' },
  { id: 30, nombre: 'Categoría nueva', codigo: null }
];

// El mensaje que da Postgres al chocar con el índice único de muebles.referencia.
const COLISION_REFERENCIA = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "muebles_referencia_key"'
};

const conReferencias = (...referencias) =>
  referencias.map((referencia, i) => ({ id: `m-${i}`, nombre: `Pieza ${i}`, referencia }));

let fake;
afterEach(() => mock.restoreAll());

describe('obtenerCodigoCategoria', () => {
  beforeEach(() => {
    fake = crearFakeSupabase({ categorias: CATEGORIAS });
    mock.method(supabase, 'from', fake.from);
  });

  test('devuelve el código de la categoría', async () => {
    assert.equal(await obtenerCodigoCategoria(20), 'SIL');
  });

  test('si la categoría no existe, lanza un error que no es SIN_CODIGO', async () => {
    await assert.rejects(obtenerCodigoCategoria(999), (err) => {
      assert.match(err.message, /Categoría 999 no encontrada/);
      assert.notEqual(err.code, 'SIN_CODIGO');
      return true;
    });
  });

  test('si la categoría no tiene código, lanza un error con code SIN_CODIGO', async () => {
    await assert.rejects(obtenerCodigoCategoria(30), (err) => {
      assert.equal(err.code, 'SIN_CODIGO');
      assert.match(err.message, /no tiene código/);
      return true;
    });
  });

  test('si falla la base de datos, lanza el error con su mensaje', async () => {
    fake.fallos['categorias.select'] = { message: 'conexión perdida' };
    await assert.rejects(
      obtenerCodigoCategoria(20),
      /Error al leer la categoría 20: conexión perdida/
    );
  });
});

describe('calcularSiguienteReferencia', () => {
  const conMuebles = (muebles) => {
    fake = crearFakeSupabase({ muebles });
    mock.method(supabase, 'from', fake.from);
  };

  test('sin ninguna referencia del código, empieza en 001', async () => {
    conMuebles([]);
    assert.equal(await calcularSiguienteReferencia('SIL'), 'NAV-SIL-001');
  });

  test('suma uno a la última (001 -> 002)', async () => {
    conMuebles(conReferencias('NAV-SIL-001'));
    assert.equal(await calcularSiguienteReferencia('SIL'), 'NAV-SIL-002');
  });

  test('no reutiliza huecos: con 001 y 003, la siguiente es 004', async () => {
    conMuebles(conReferencias('NAV-SIL-003', 'NAV-SIL-001'));
    assert.equal(await calcularSiguienteReferencia('SIL'), 'NAV-SIL-004');
  });

  test('pasa de 099 a 100 (el orden de texto coincide con el numérico)', async () => {
    conMuebles(conReferencias('NAV-SIL-099', 'NAV-SIL-010', 'NAV-SIL-098'));
    assert.equal(await calcularSiguienteReferencia('SIL'), 'NAV-SIL-100');
  });

  test('solo cuenta las referencias de su código, y no se lía con las piezas sin referencia', async () => {
    conMuebles([
      ...conReferencias('NAV-MES-042', 'NAV-SIL-002'),
      { id: 'sin-ref', nombre: 'Pieza antigua', referencia: null }
    ]);
    assert.equal(await calcularSiguienteReferencia('SIL'), 'NAV-SIL-003');
    assert.equal(await calcularSiguienteReferencia('MES'), 'NAV-MES-043');
    assert.equal(await calcularSiguienteReferencia('PIE'), 'NAV-PIE-001');
  });

  test('si falla la base de datos, lanza el error con su mensaje', async () => {
    conMuebles([]);
    fake.fallos['muebles.select'] = { message: 'tiempo agotado' };
    await assert.rejects(
      calcularSiguienteReferencia('SIL'),
      /Error al calcular referencia para SIL: tiempo agotado/
    );
  });
});

describe('generarReferencia', () => {
  test('combina el código de la categoría con el siguiente número', async () => {
    fake = crearFakeSupabase({ categorias: CATEGORIAS, muebles: conReferencias('NAV-MES-007') });
    mock.method(supabase, 'from', fake.from);
    assert.equal(await generarReferencia(21), 'NAV-MES-008');
    assert.equal(await generarReferencia(20), 'NAV-SIL-001');
  });

  test('si la categoría no tiene código, deja pasar el error SIN_CODIGO', async () => {
    fake = crearFakeSupabase({ categorias: CATEGORIAS });
    mock.method(supabase, 'from', fake.from);
    await assert.rejects(generarReferencia(30), (err) => err.code === 'SIN_CODIGO');
  });
});

describe('POST /api/muebles — referencia automática', () => {
  // Los avisos de crearMueble (colisión, categoría sin código) y el error del 500 son esperados.
  beforeEach(() => {
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
  });

  const preparar = (muebles = []) => {
    fake = crearFakeSupabase({ categorias: CATEGORIAS, muebles });
    mock.method(supabase, 'from', fake.from);
  };
  const crear = (categoriaId) =>
    conAuth(request(app).post('/api/muebles'))
      .field('nombre', 'Silla Nórdica')
      .field('categoria', 'Sillas')
      .field('categoria_id', String(categoriaId));
  const insertados = () =>
    fake.escrituras.filter((e) => e.tabla === 'muebles' && e.accion === 'insert');

  // Hace fallar los `veces` primeros inserts en muebles con `error` (y deja pasar los demás).
  // `alFallar` simula lo que ha hecho el otro administrador en ese momento.
  const fallarInserts = (veces, error, alFallar = () => {}) => {
    const intentos = { total: 0 };
    fake.fallos['muebles.insert'] = () => {
      intentos.total++;
      if (intentos.total > veces) return null;
      alFallar();
      return error;
    };
    return intentos;
  };

  test('MAX_REINTENTOS es 3', () => {
    assert.equal(MAX_REINTENTOS, 3);
  });

  test('con una categoría con código, guarda la siguiente referencia', async () => {
    preparar(conReferencias('NAV-SIL-001'));
    const res = await crear(20);
    assert.equal(res.status, 201);
    assert.equal(insertados().length, 1);
    assert.equal(insertados()[0].fila.referencia, 'NAV-SIL-002');
  });

  test('con una categoría sin código, crea el mueble sin referencia', async () => {
    preparar();
    const res = await crear(30);
    assert.equal(res.status, 201);
    assert.equal(insertados()[0].fila.referencia, null);
  });

  test('si la categoría no existe, no crea el mueble (solo SIN_CODIGO se deja pasar)', async () => {
    preparar();
    const res = await crear(999);
    assert.equal(res.status, 500);
    assert.equal(insertados().length, 0);
  });

  test('si otro administrador se queda el mismo número (23505 en la referencia), recalcula y lo vuelve a intentar', async () => {
    preparar(conReferencias('NAV-SIL-001'));
    // Mientras este calculaba NAV-SIL-002, el otro la ha guardado.
    const intentos = fallarInserts(1, COLISION_REFERENCIA, () =>
      fake.tablas.muebles.push({ id: 'del-otro', nombre: 'Otra silla', referencia: 'NAV-SIL-002' })
    );
    const res = await crear(20);
    assert.equal(res.status, 201);
    assert.equal(intentos.total, 2);
    assert.equal(insertados()[0].fila.referencia, 'NAV-SIL-003');
  });

  test('con la colisión repetida, se rinde tras MAX_REINTENTOS intentos', async () => {
    preparar();
    const intentos = fallarInserts(Infinity, COLISION_REFERENCIA);
    const res = await crear(20);
    assert.equal(res.status, 500);
    assert.equal(intentos.total, MAX_REINTENTOS);
    assert.equal(insertados().length, 0);
  });

  test('un 23505 de otro índice único no se reintenta', async () => {
    preparar();
    const intentos = fallarInserts(Infinity, {
      code: '23505',
      message: 'duplicate key value violates unique constraint "muebles_pkey"'
    });
    const res = await crear(20);
    assert.equal(res.status, 500);
    assert.equal(intentos.total, 1);
  });

  test('cualquier otro error de la base de datos no se reintenta', async () => {
    preparar();
    const intentos = fallarInserts(Infinity, { code: '23503', message: 'referencia rota' });
    const res = await crear(20);
    assert.equal(res.status, 500);
    assert.equal(intentos.total, 1);
  });

  test('sin código, una colisión tampoco se reintenta (hay un solo intento)', async () => {
    preparar();
    const intentos = fallarInserts(Infinity, COLISION_REFERENCIA);
    const res = await crear(30);
    assert.equal(res.status, 500);
    assert.equal(intentos.total, 1);
  });
});
