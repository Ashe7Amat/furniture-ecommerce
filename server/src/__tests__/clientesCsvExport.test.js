// Exportar las cuentas de clientes a CSV (GET /api/admin/clientes/export): solo para administradores,
// con el mismo formato que el del catálogo y sin la contraseña (el hash) en ningún caso.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { parsearCsv, BOM } = require('../utils/csv');

const URL_EXPORT = '/api/admin/clientes/export';
const HASH = '$2b$10$abcdefghijklmnopqrstuvHASHDEPRUEBAQUENOSALENUNCA1234';

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const tokenCliente = jwt.sign(
  { email: 'cliente@test.com', nombre: 'Cliente', rol: 'cliente' },
  process.env.JWT_SECRET
);

// Las filas como están en la tabla, con la contraseña cifrada incluida.
const CLIENTES = [
  {
    id: 'c1',
    email: 'ana@test.com',
    nombre: 'Ana López',
    rol: 'cliente',
    creado_en: '2026-09-01T10:00:00Z',
    password: HASH
  },
  {
    id: 'c2',
    email: 'admin@test.com',
    nombre: 'Admin',
    rol: 'admin',
    creado_en: '2026-10-01T10:00:00Z',
    password: HASH
  },
  {
    id: 'c3',
    email: 'raro@test.com',
    nombre: '=HYPERLINK("http://malo")',
    rol: 'cliente',
    creado_en: '2026-09-15T10:00:00Z',
    password: HASH
  }
];

let fake;
afterEach(() => mock.restoreAll());
beforeEach(() => {
  fake = crearFakeSupabase({ clientes: CLIENTES });
  mock.method(supabase, 'from', fake.from);
});

// El cuerpo como texto tal cual (supertest no lee text/csv por su cuenta).
const pedirCsv = () =>
  request(app)
    .get(URL_EXPORT)
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .buffer(true)
    .parse((respuesta, fin) => {
      let texto = '';
      respuesta.setEncoding('utf8');
      respuesta.on('data', (trozo) => (texto += trozo));
      respuesta.on('end', () => fin(null, texto));
    });

describe('GET /api/admin/clientes/export', () => {
  test('sin sesión, 401; con sesión de cliente, 403', async () => {
    assert.equal((await request(app).get(URL_EXPORT)).status, 401);
    assert.equal(
      (await request(app).get(URL_EXPORT).set('Authorization', `Bearer ${tokenCliente}`)).status,
      403
    );
  });

  test('es un CSV para descargar, con fecha en el nombre y sin caché', async () => {
    const res = await request(app).get(URL_EXPORT).set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.match(
      res.headers['content-disposition'],
      /^attachment; filename="clientes-nave5-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('empieza por el BOM y lleva las cabeceras en orden, separadas por punto y coma', async () => {
    const res = await pedirCsv();
    assert.ok(res.body.startsWith(BOM), 'BOM UTF-8 delante, para Excel');
    assert.equal(res.body.slice(1).split('\r\n')[0], 'id;email;nombre;rol;creado_en');
  });

  test('no lleva la contraseña: ni la columna ni el hash', async () => {
    const res = await pedirCsv();
    assert.doesNotMatch(res.body, /password/i);
    assert.ok(!res.body.includes(HASH), 'el hash no aparece en ninguna celda');
    assert.ok(!res.body.includes('$2b$'), 'ni ningún trozo de un hash de bcrypt');
  });

  test('una fila por cliente, de la cuenta más nueva a la más antigua', async () => {
    const res = await pedirCsv();
    const [cabecera, ...filas] = parsearCsv(res.body).map((f) => f.celdas);
    assert.deepEqual(
      filas.map((f) => f[0]),
      ['c2', 'c3', 'c1']
    );
    const ana = Object.fromEntries(cabecera.map((c, i) => [c, filas[2][i]]));
    assert.deepEqual(ana, {
      id: 'c1',
      email: 'ana@test.com',
      nombre: 'Ana López',
      rol: 'cliente',
      creado_en: '2026-09-01T10:00:00Z'
    });
  });

  test('un nombre que Excel tomaría por fórmula va con el apóstrofo delante', async () => {
    const res = await pedirCsv();
    assert.ok(res.body.includes(`;"'=HYPERLINK(""http://malo"")";`), 'en el archivo, protegido');
    const fila = parsearCsv(res.body).find((f) => f.celdas[0] === 'c3');
    assert.equal(fila.celdas[2], '=HYPERLINK("http://malo")', 'y se lee igual que se guardó');
  });

  test('sin clientes, solo la cabecera', async () => {
    fake = crearFakeSupabase({ clientes: [] });
    mock.method(supabase, 'from', fake.from);
    const res = await pedirCsv();
    assert.equal(res.body, `${BOM}id;email;nombre;rol;creado_en\r\n`);
  });

  test('si Supabase responde sin filas (data a null), también sale solo la cabecera', async () => {
    const consulta = { select: () => consulta, order: async () => ({ data: null, error: null }) };
    mock.method(supabase, 'from', () => consulta);
    const res = await pedirCsv();
    assert.equal(res.status, 200);
    assert.equal(res.body, `${BOM}id;email;nombre;rol;creado_en\r\n`);
  });

  test('un error de Supabase da 500 con mensaje genérico', async () => {
    fake.fallos['clientes.select'] = { message: 'caído' };
    mock.method(console, 'error', () => {});
    const res = await request(app).get(URL_EXPORT).set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al exportar los clientes.');
  });
});
