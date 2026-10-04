// Importar el catálogo desde un CSV (POST /api/admin/muebles/import): la previsualización no guarda
// nada, la aplicación crea las filas válidas con su referencia automática y salta las demás, y el
// archivo en sí se rechaza si no sirve (sin cabeceras obligatorias, más de 500 filas...).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { MAX_FILAS_IMPORTACION } = require('../controllers/catalogoCsvController');

const tokenAdmin = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);
const tokenCliente = jwt.sign(
  { email: 'cliente@test.com', nombre: 'Cliente', rol: 'cliente' },
  process.env.JWT_SECRET
);

const URL_IMPORT = '/api/admin/muebles/import';
const FOTO = `${process.env.SUPABASE_URL}/storage/v1/object/public/imagenes/muebles/silla-1.jpg`;
const FOTO_2 = `${process.env.SUPABASE_URL}/storage/v1/object/public/imagenes/muebles/silla-2.jpg`;

// Como en la base real: generales sin padre y específicas con código colgando de ellas.
const CATEGORIAS = [
  { id: 17, nombre: 'Mobiliario', codigo: 'MOB', categoria_padre_id: null },
  { id: 20, nombre: 'Sillas y asientos', codigo: 'SIL', categoria_padre_id: 17 },
  { id: 21, nombre: 'Mesas y mobiliario', codigo: 'MES', categoria_padre_id: 17 }
];
const EXISTENTE = { id: 'm0', nombre: 'Silla vieja', referencia: 'NAV-SIL-004', categoria_id: 20 };

const CABECERA = 'nombre;categoria;descripcion;precio_venta;precio_alquiler_dia;estado;imagenes';
const TRES_VALIDAS = [
  CABECERA,
  `Silla Tolix;Sillas y asientos;Metal;120,5;8;disponible;${FOTO} ${FOTO_2}`,
  'Silla Thonet;sillas y asientos;;;;vendido;',
  'Mesa de roble;Mesas y mobiliario;"Roble; restaurada";450;;;'
].join('\r\n');

let fake;
beforeEach(() => {
  fake = crearFakeSupabase({ categorias: CATEGORIAS, muebles: [EXISTENTE] });
  mock.method(supabase, 'from', fake.from);
  mock.method(console, 'warn', () => {});
});
afterEach(() => mock.restoreAll());

const importar = (csv, modo = 'preview', token = tokenAdmin) => {
  let peticion = request(app).post(URL_IMPORT).field('modo', modo);
  if (token) peticion = peticion.set('Authorization', `Bearer ${token}`);
  if (csv !== null) {
    peticion = peticion.attach('archivo', Buffer.from(csv, 'utf8'), {
      filename: 'catalogo.csv',
      contentType: 'text/csv'
    });
  }
  return peticion;
};
const altas = () => fake.escrituras.filter((e) => e.tabla === 'muebles' && e.accion === 'insert');

describe('acceso', () => {
  test('sin sesión, 401; con sesión de cliente, 403; y no se lee el archivo', async () => {
    assert.equal((await importar(TRES_VALIDAS, 'apply', null)).status, 401);
    assert.equal((await importar(TRES_VALIDAS, 'apply', tokenCliente)).status, 403);
    assert.equal(altas().length, 0);
  });
});

describe('previsualizar (modo preview)', () => {
  test('un CSV con 3 filas válidas: 3 de 3, sin errores, y no guarda nada', async () => {
    const res = await importar(TRES_VALIDAS);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.validas, 3);
    assert.deepEqual(res.body.errores, []);
    assert.equal(fake.escrituras.length, 0);
  });

  test('cada fila trae su línea, su nombre y la categoría con el nombre que tiene en la base', async () => {
    const res = await importar(TRES_VALIDAS);
    assert.deepEqual(res.body.filas[1], {
      linea: 3,
      nombre: 'Silla Thonet',
      categoria: 'Sillas y asientos',
      valida: true,
      motivo: null
    });
  });

  test('una categoría que no existe es un error de esa fila, con su línea', async () => {
    const res = await importar([CABECERA, 'Taburete;Taburetes;;;;;'].join('\n'));
    assert.equal(res.body.validas, 0);
    assert.deepEqual(res.body.errores, [
      { linea: 2, motivo: 'La categoría "Taburetes" no existe.' }
    ]);
  });

  test('una categoría general no se puede elegir (como en "Añadir Mueble")', async () => {
    const res = await importar([CABECERA, 'Silla;Mobiliario;;;;;'].join('\n'));
    assert.match(res.body.errores[0].motivo, /"Mobiliario" es una categoría general/);
  });

  test('un estado que no es disponible, vendido ni alquilado es un error', async () => {
    const res = await importar([CABECERA, 'Silla;Sillas y asientos;;;;reservado;'].join('\n'));
    assert.equal(
      res.body.errores[0].motivo,
      'El estado "reservado" no es válido (disponible, vendido, alquilado).'
    );
  });

  test('el estado vacío es "disponible", y da igual en mayúsculas', async () => {
    const res = await importar(
      [CABECERA, 'A;Sillas y asientos;;;;;', 'B;Sillas y asientos;;;;VENDIDO;'].join('\n'),
      'apply'
    );
    assert.deepEqual(
      altas().map((a) => a.fila.estado),
      ['disponible', 'vendido']
    );
    assert.equal(res.body.creadas, 2);
  });

  for (const [precio, motivo] of [
    ['1.234,50', /El precio de venta no es un número válido \("1\.234,50"\)/],
    ['-5', /El precio de venta no es un número válido/],
    ['12 €', /El precio de venta no es un número válido/]
  ]) {
    test(`un precio "${precio}" es un error`, async () => {
      const res = await importar([CABECERA, `Silla;Sillas y asientos;;${precio};;;`].join('\n'));
      assert.match(res.body.errores[0].motivo, motivo);
    });
  }

  test('sin nombre, y con todos los fallos de la fila juntos en un solo motivo', async () => {
    const res = await importar([CABECERA, ';;;caro;;;'].join('\n'));
    assert.equal(
      res.body.errores[0].motivo,
      'Falta el nombre. Falta la categoría. El precio de venta no es un número válido ("caro").'
    );
  });

  test('una foto que no es del almacenamiento de la tienda es un error', async () => {
    const res = await importar(
      [CABECERA, 'Silla;Sillas y asientos;;;;;https://otra-web.test/foto.jpg'].join('\n')
    );
    assert.match(res.body.errores[0].motivo, /no es del almacenamiento de la tienda/);
  });

  test('una fila con referencia se rechaza: sería un duplicado de una pieza ya dada de alta', async () => {
    const res = await importar(
      ['referencia;nombre;categoria', 'NAV-SIL-004;Silla vieja;Sillas y asientos'].join('\n')
    );
    assert.match(res.body.errores[0].motivo, /Ya tiene referencia \(NAV-SIL-004\)/);
  });

  test('las columnas del CSV exportado se aceptan sin leerlas, y las desconocidas se avisan', async () => {
    const res = await importar(
      [
        'id;nombre;categoria;categoria_id;created_at;color',
        'x;Silla;Sillas y asientos;99;hoy;rojo'
      ].join('\n')
    );
    assert.equal(res.body.validas, 1);
    assert.deepEqual(res.body.columnasIgnoradas, ['color']);
  });

  test('un CSV con comas (Excel en inglés, Google Sheets) también se lee', async () => {
    const res = await importar('nombre,categoria,precio_venta\nSilla,Sillas y asientos,"12,5"\n');
    assert.equal(res.body.validas, 1);
  });
});

describe('el archivo entero no sirve: 400 y no se guarda nada', () => {
  test('sin las cabeceras obligatorias', async () => {
    const res = await importar('titulo;precio\nSilla;12\n', 'apply');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Faltan las cabeceras obligatorias: nombre, categoria/);
    assert.equal(altas().length, 0);
  });

  test(`con más de ${MAX_FILAS_IMPORTACION} filas`, async () => {
    const filas = Array.from(
      { length: MAX_FILAS_IMPORTACION + 1 },
      (_, i) => `Silla ${i};Sillas y asientos`
    );
    const res = await importar(['nombre;categoria', ...filas].join('\n'), 'apply');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /tiene 501 filas y el máximo es 500/);
    assert.equal(altas().length, 0);
  });

  test(`con ${MAX_FILAS_IMPORTACION} filas justas, sí`, async () => {
    const filas = Array.from(
      { length: MAX_FILAS_IMPORTACION },
      (_, i) => `Silla ${i};Sillas y asientos`
    );
    const res = await importar(['nombre;categoria', ...filas].join('\n'));
    assert.equal(res.status, 200);
    assert.equal(res.body.validas, MAX_FILAS_IMPORTACION);
  });

  test('vacío', async () => {
    const res = await importar('');
    assert.equal(res.status, 400);
  });

  test('con una columna repetida', async () => {
    const res = await importar('nombre;categoria;nombre\nA;Sillas y asientos;B\n');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /La columna "nombre" está repetida/);
  });

  test('sin archivo', async () => {
    const res = await importar(null);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Falta el archivo CSV/);
  });

  test('con un modo que no es preview ni apply', async () => {
    const res = await importar(TRES_VALIDAS, 'borrar');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /"preview" o "apply"/);
  });

  test('de más de 2 MB: 413', async () => {
    const enorme = `nombre;categoria\n${'x'.repeat(2 * 1024 * 1024)};Sillas y asientos\n`;
    const res = await importar(enorme, 'apply');
    assert.equal(res.status, 413);
    assert.match(res.body.error, /máximo 2 MB/);
  });

  test('con el archivo en otro campo: 400 con un mensaje claro', async () => {
    const res = await request(app)
      .post(URL_IMPORT)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .field('modo', 'preview')
      .attach('otro', Buffer.from(TRES_VALIDAS), 'catalogo.csv');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /un único CSV en el campo "archivo"/);
  });
});

describe('aplicar (modo apply)', () => {
  test('crea las 3 filas, en orden, con referencia automática y los datos convertidos', async () => {
    const res = await importar(TRES_VALIDAS, 'apply');
    assert.equal(res.status, 200);
    assert.equal(res.body.creadas, 3);
    assert.equal(res.body.saltadas, 0);
    assert.deepEqual(
      res.body.piezas.map((p) => [p.linea, p.referencia]),
      [
        [2, 'NAV-SIL-005'],
        [3, 'NAV-SIL-006'],
        [4, 'NAV-MES-001']
      ]
    );
    const [tolix, , mesa] = altas().map((a) => a.fila);
    assert.deepEqual(
      {
        nombre: tolix.nombre,
        categoria: tolix.categoria,
        categoria_id: tolix.categoria_id,
        descripcion: tolix.descripcion,
        precio_venta: tolix.precio_venta,
        precio_alquiler_dia: tolix.precio_alquiler_dia,
        estado: tolix.estado,
        imagenes: tolix.imagenes
      },
      {
        nombre: 'Silla Tolix',
        categoria: 'Sillas y asientos',
        categoria_id: 20,
        descripcion: 'Metal',
        precio_venta: 120.5,
        precio_alquiler_dia: 8,
        estado: 'disponible',
        imagenes: [FOTO, FOTO_2]
      }
    );
    assert.equal(mesa.descripcion, 'Roble; restaurada');
    assert.equal(mesa.precio_alquiler_dia, null);
  });

  test('con filas válidas e inválidas mezcladas, crea las válidas y salta las otras', async () => {
    const csv = [
      CABECERA,
      'Silla Tolix;Sillas y asientos;;;;;',
      'Taburete;Taburetes;;;;;',
      'Mesa;Mesas y mobiliario;;;;roto;',
      'Silla Thonet;Sillas y asientos;;;;;'
    ].join('\n');
    const res = await importar(csv, 'apply');
    assert.equal(res.body.creadas, 2);
    assert.equal(res.body.saltadas, 2);
    assert.deepEqual(
      res.body.errores.map((e) => e.linea),
      [3, 4]
    );
    assert.deepEqual(
      altas().map((a) => a.fila.nombre),
      ['Silla Tolix', 'Silla Thonet']
    );
  });

  test('si una fila falla al guardarse, se apunta como error y se siguen creando las demás', async () => {
    let intentos = 0;
    fake.fallos['muebles.insert'] = () =>
      ++intentos === 1 ? { code: '23503', message: 'otra cosa' } : null;
    mock.method(console, 'error', () => {});
    const res = await importar(TRES_VALIDAS, 'apply');
    assert.equal(res.status, 200);
    assert.equal(res.body.creadas, 2);
    assert.equal(res.body.saltadas, 1);
    assert.deepEqual(res.body.errores, [
      { linea: 2, motivo: 'No se pudo guardar en la base de datos.' }
    ]);
  });

  test('si no se pueden leer las categorías, 500 con mensaje genérico y nada guardado', async () => {
    fake.fallos['categorias.select'] = { message: 'caído' };
    mock.method(console, 'error', () => {});
    const res = await importar(TRES_VALIDAS, 'apply');
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al importar el catálogo.');
    assert.equal(altas().length, 0);
  });
});
