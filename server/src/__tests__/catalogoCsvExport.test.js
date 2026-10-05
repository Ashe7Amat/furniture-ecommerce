// Exportar el catálogo a CSV (GET /api/admin/muebles/export) y la utilidad utils/csv.js: el BOM, el
// separador, las comillas, la protección contra fórmulas de Excel y la lectura de vuelta.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { celdaCsv, construirCsv, parsearCsv, BOM } = require('../utils/csv');
const { fechaDeHoy } = require('../controllers/catalogoCsvController');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const tokenCliente = jwt.sign(
  { email: 'cliente@test.com', nombre: 'Cliente', rol: 'cliente' },
  process.env.JWT_SECRET
);

const CABECERA =
  'id;referencia;nombre;categoria;categoria_id;descripcion;precio_venta;precio_alquiler_dia;estado;imagenes;created_at';

const MUEBLES = [
  {
    id: 'm1',
    referencia: 'NAV-SIL-001',
    nombre: 'Silla Tolix',
    categoria: 'Sillas y asientos',
    categoria_id: 20,
    descripcion: 'Metal; pintura "original"\nalgo gastada',
    precio_venta: 120.5,
    precio_alquiler_dia: 8,
    estado: 'disponible',
    imagenes: ['https://x.test/a.jpg', 'https://x.test/b.jpg'],
    created_at: '2026-10-01T10:00:00Z',
    nota_interna: 'no sale'
  },
  {
    id: 'm2',
    referencia: null,
    nombre: '=HYPERLINK("http://malo")',
    categoria: 'Mesas y mobiliario',
    categoria_id: 21,
    descripcion: null,
    precio_venta: null,
    precio_alquiler_dia: null,
    estado: 'vendido',
    imagenes: [],
    created_at: '2026-09-01T10:00:00Z'
  }
];

let fake;
afterEach(() => mock.restoreAll());

describe('utils/csv', () => {
  test('celdaCsv: vacío para null, comillas solo cuando hace falta', () => {
    assert.equal(celdaCsv(null), '');
    assert.equal(celdaCsv(undefined), '');
    assert.equal(celdaCsv('Silla'), 'Silla');
    assert.equal(celdaCsv(12), '12');
    assert.equal(celdaCsv('a;b'), '"a;b"');
    assert.equal(celdaCsv('dice "hola"'), '"dice ""hola"""');
    assert.equal(celdaCsv('dos\nlíneas'), '"dos\nlíneas"');
  });

  test('celdaCsv: un texto que Excel tomaría por fórmula lleva un apóstrofo delante', () => {
    for (const peligroso of ['=1+1', '+34 600', '-2', '@SUMA', '\tx']) {
      assert.equal(celdaCsv(peligroso), `'${peligroso}`);
    }
    assert.equal(celdaCsv(-2), '-2', 'un número negativo no es texto: no se toca');
  });

  test('construirCsv: BOM, cabecera y CRLF', () => {
    const csv = construirCsv(['a', 'b'], [{ a: 1, b: 'x' }]);
    assert.equal(csv, `${BOM}a;b\r\n1;x\r\n`);
  });

  test('parsearCsv lee de vuelta lo que escribe construirCsv (comillas, saltos y fórmulas)', () => {
    const filas = [
      { a: 'a;b', b: 'dice "hola"' },
      { a: 'dos\nlíneas', b: '=1+1' }
    ];
    const leido = parsearCsv(construirCsv(['a', 'b'], filas));
    assert.deepEqual(
      leido.map((f) => f.celdas),
      [
        ['a', 'b'],
        ['a;b', 'dice "hola"'],
        ['dos\nlíneas', '=1+1']
      ]
    );
    assert.deepEqual(
      leido.map((f) => f.linea),
      [1, 2, 3],
      'cada fila sabe en qué línea del archivo empieza'
    );
  });

  test('parsearCsv: separador coma si la cabecera no tiene punto y coma, y salta líneas vacías', () => {
    const leido = parsearCsv('nombre,categoria\n\nSilla,"Sillas, varias"\n');
    assert.deepEqual(
      leido.map((f) => f.celdas),
      [
        ['nombre', 'categoria'],
        ['Silla', 'Sillas, varias']
      ]
    );
    assert.equal(leido[1].linea, 3);
  });

  test('parsearCsv: una última línea sin salto de línea también cuenta', () => {
    assert.deepEqual(
      parsearCsv('a;b\r\n1;2').map((f) => f.celdas),
      [
        ['a', 'b'],
        ['1', '2']
      ]
    );
  });

  test('fechaDeHoy: AAAA-MM-DD en hora de Madrid', () => {
    // 23:30 UTC del 31 de diciembre ya es 1 de enero en Madrid.
    assert.equal(fechaDeHoy(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  });
});

describe('GET /api/admin/muebles/export', () => {
  const URL_EXPORT = '/api/admin/muebles/export';
  beforeEach(() => {
    fake = crearFakeSupabase({ muebles: MUEBLES });
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
      /^attachment; filename="catalogo-nave5-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('empieza por el BOM y lleva las cabeceras en orden', async () => {
    const res = await pedirCsv();
    assert.ok(res.body.startsWith(BOM), 'BOM UTF-8 delante, para Excel');
    assert.equal(res.body.slice(1).split('\r\n')[0], CABECERA);
  });

  test('una fila de ejemplo: precios reales con coma decimal, fotos separadas por espacio', async () => {
    const res = await pedirCsv();
    const [cabecera, ...filas] = parsearCsv(res.body).map((f) => f.celdas);
    const porColumna = (fila) => Object.fromEntries(cabecera.map((c, i) => [c, fila[i]]));
    const silla = porColumna(filas.find((f) => f[0] === 'm1'));
    assert.deepEqual(silla, {
      id: 'm1',
      referencia: 'NAV-SIL-001',
      nombre: 'Silla Tolix',
      categoria: 'Sillas y asientos',
      categoria_id: '20',
      descripcion: 'Metal; pintura "original"\nalgo gastada',
      precio_venta: '120,5',
      precio_alquiler_dia: '8',
      estado: 'disponible',
      imagenes: 'https://x.test/a.jpg https://x.test/b.jpg',
      created_at: '2026-10-01T10:00:00Z'
    });
    const otra = porColumna(filas.find((f) => f[0] === 'm2'));
    assert.equal(otra.referencia, '');
    assert.equal(otra.precio_venta, '');
    assert.equal(otra.nombre, '=HYPERLINK("http://malo")', 'se lee igual que se guardó');
    assert.match(res.body, /'=HYPERLINK/, 'pero en el archivo va con el apóstrofo delante');
    assert.doesNotMatch(res.body, /nota_interna|no sale/, 'solo las columnas pedidas');
  });

  test('con los precios ocultos al público, el CSV del panel sigue llevando los reales', async () => {
    const valor = process.env.MOSTRAR_PRECIOS;
    process.env.MOSTRAR_PRECIOS = 'false';
    try {
      const res = await pedirCsv();
      assert.match(res.body, /;120,5;8;/);
    } finally {
      process.env.MOSTRAR_PRECIOS = valor;
    }
  });

  test('un error de Supabase da 500 con mensaje genérico', async () => {
    fake.fallos['muebles.select'] = { message: 'caído' };
    mock.method(console, 'error', () => {});
    const res = await request(app).get(URL_EXPORT).set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al exportar el catálogo.');
  });
});
