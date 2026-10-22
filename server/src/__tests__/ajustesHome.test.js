// server/src/__tests__/ajustesHome.test.js
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-ajustes-home';

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');

describe('Ajustes de Portada (Home)', () => {
  const tokenAdmin = jwt.sign(
    { sub: 'a1', email: 'admin@nave5barcelona.com', rol: 'admin' },
    process.env.JWT_SECRET
  );
  const tokenCliente = jwt.sign(
    { sub: 'c1', email: 'cliente@test.com', rol: 'cliente' },
    process.env.JWT_SECRET
  );

  let fake;
  const instalar = (opciones = {}) => {
    fake = crearFakeSupabase(opciones);
    mock.method(supabase, 'from', fake.from);
  };

  beforeEach(() => {
    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('GET /api/ajustes/home (público)', () => {
    test('es público y devuelve los arrays de hero_imagenes y productos_destacados', async () => {
      instalar({
        ajustes_home: [
          {
            id: 1,
            hero_imagenes: ['https://img.test/hero1.webp', 'https://img.test/hero2.webp'],
            productos_destacados: ['uuid-mueble-1', 'uuid-mueble-2'],
            imagenes_seccion_inspiracion: [
              'https://img.test/insp1.webp',
              'https://img.test/insp2.webp'
            ],
            imagen_seccion_sostenibilidad: 'https://img.test/sost.webp',
            updated_at: '2026-10-22T10:00:00.000Z'
          }
        ]
      });

      const res = await request(app).get('/api/ajustes/home');
      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.equal(res.body.id, 1);
      assert.deepEqual(res.body.hero_imagenes, [
        'https://img.test/hero1.webp',
        'https://img.test/hero2.webp'
      ]);
      assert.deepEqual(res.body.productos_destacados, ['uuid-mueble-1', 'uuid-mueble-2']);
      assert.deepEqual(res.body.imagenes_seccion_inspiracion, [
        'https://img.test/insp1.webp',
        'https://img.test/insp2.webp'
      ]);
      assert.equal(res.body.imagen_seccion_sostenibilidad, 'https://img.test/sost.webp');
    });

    test('si no hay fila guardada aún en la tabla, devuelve id=1 con arrays vacíos sin fallar', async () => {
      instalar({ ajustes_home: [] });

      const res = await request(app).get('/api/ajustes/home');
      assert.equal(res.status, 200);
      assert.equal(res.body.id, 1);
      assert.deepEqual(res.body.hero_imagenes, []);
      assert.deepEqual(res.body.productos_destacados, []);
    });

    test('si la base de datos falla, responde 500', async () => {
      instalar({
        fallos: {
          'ajustes_home.select': new Error('Fallo de conexión')
        }
      });

      const res = await request(app).get('/api/ajustes/home');
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error al obtener los ajustes de portada.');
    });
  });

  describe('PUT /api/admin/ajustes/home (protegido con verificarAdmin)', () => {
    test('sin token responde 401', async () => {
      instalar();
      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .send({ hero_imagenes: ['https://img.test/hero.webp'] });
      assert.equal(res.status, 401);
    });

    test('un cliente no administrador responde 403', async () => {
      instalar();
      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenCliente}`)
        .send({ hero_imagenes: ['https://img.test/hero.webp'] });
      assert.equal(res.status, 403);
    });

    test('un administrador puede actualizar los arrays correctamente cuando la fila ya existe', async () => {
      instalar({
        ajustes_home: [
          {
            id: 1,
            hero_imagenes: ['https://img.test/vieja.webp'],
            productos_destacados: ['id-viejo'],
            imagenes_seccion_inspiracion: [],
            imagen_seccion_sostenibilidad: null
          }
        ]
      });

      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          hero_imagenes: ['https://img.test/hero-nuevo.webp'],
          productos_destacados: ['uuid-mueble-1', 'uuid-mueble-2']
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.hero_imagenes, ['https://img.test/hero-nuevo.webp']);
      assert.deepEqual(res.body.data.productos_destacados, ['uuid-mueble-1', 'uuid-mueble-2']);
    });

    test('un administrador inserta la fila por defecto si no existía previamente', async () => {
      instalar({ ajustes_home: [] });

      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          hero_imagenes: ['https://img.test/hero-insert.webp'],
          productos_destacados: ['uuid-mueble-insert']
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.hero_imagenes, ['https://img.test/hero-insert.webp']);
      assert.deepEqual(res.body.data.productos_destacados, ['uuid-mueble-insert']);
    });

    test('rechaza con 400 si hero_imagenes no es un array o contiene URLs vacías', async () => {
      instalar();
      const res1 = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ hero_imagenes: 'no-es-array' });
      assert.equal(res1.status, 400);

      const res2 = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ hero_imagenes: ['   '] });
      assert.equal(res2.status, 400);
    });

    test('rechaza con 400 si productos_destacados no es un array o contiene IDs vacíos', async () => {
      instalar();
      const res1 = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ productos_destacados: 12345 });
      assert.equal(res1.status, 400);

      const res2 = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ productos_destacados: [''] });
      assert.equal(res2.status, 400);
    });

    test('rechaza con 400 si imagenes_seccion_inspiracion tiene más de 3 fotos o URLs vacías', async () => {
      instalar();
      const res1 = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          imagenes_seccion_inspiracion: [
            'https://img.test/1.jpg',
            'https://img.test/2.jpg',
            'https://img.test/3.jpg',
            'https://img.test/4.jpg'
          ]
        });
      assert.equal(res1.status, 400);

      const res2 = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ imagenes_seccion_inspiracion: [''] });
      assert.equal(res2.status, 400);
    });

    test('acepta y actualiza imagenes_seccion_inspiracion e imagen_seccion_sostenibilidad', async () => {
      instalar({
        ajustes_home: [
          {
            id: 1,
            hero_imagenes: [],
            productos_destacados: [],
            imagenes_seccion_inspiracion: [],
            imagen_seccion_sostenibilidad: null
          }
        ]
      });

      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          imagenes_seccion_inspiracion: [
            'https://img.test/insp1.webp',
            'https://img.test/insp2.webp'
          ],
          imagen_seccion_sostenibilidad: 'https://img.test/sost.webp'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.imagenes_seccion_inspiracion, [
        'https://img.test/insp1.webp',
        'https://img.test/insp2.webp'
      ]);
      assert.equal(res.body.data.imagen_seccion_sostenibilidad, 'https://img.test/sost.webp');
    });

    test('si la base de datos falla al leer o escribir, responde 500', async () => {
      instalar({
        fallos: {
          'ajustes_home.select': new Error('Fallo de lectura')
        }
      });

      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ hero_imagenes: [] });

      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error al actualizar los ajustes de portada.');
    });

    test('si registrarActividad lanza error, la respuesta sigue siendo 200 y se captura el error', async () => {
      instalar();
      const audit = require('../utils/audit');
      mock.method(audit, 'registrarActividad', async () => {
        throw new Error('Fallo simulado en auditoría');
      });

      const res = await request(app)
        .put('/api/admin/ajustes/home')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ hero_imagenes: [] });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe('POST /api/admin/ajustes/home/imagen (protegido con verificarAdmin)', () => {
    test('sin token responde 401', async () => {
      const res = await request(app).post('/api/admin/ajustes/home/imagen');
      assert.equal(res.status, 401);
    });

    test('un cliente no administrador responde 403', async () => {
      const res = await request(app)
        .post('/api/admin/ajustes/home/imagen')
        .set('Authorization', `Bearer ${tokenCliente}`);
      assert.equal(res.status, 403);
    });

    test('sin archivo responde 400', async () => {
      const res = await request(app)
        .post('/api/admin/ajustes/home/imagen')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'No se ha seleccionado ninguna imagen.');
    });

    test('un administrador sube una imagen y devuelve su URL en la carpeta home', async () => {
      const uploadUtils = require('../utils/upload');
      let folderUsado = null;
      mock.method(uploadUtils, 'uploadToSupabase', async (file, folder) => {
        folderUsado = folder;
        return 'https://supabase.co/storage/v1/object/public/imagenes/home/foto.webp';
      });

      const res = await request(app)
        .post('/api/admin/ajustes/home/imagen')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .attach('imagen', Buffer.from('fake-image-bytes'), 'hero.jpg');

      assert.equal(res.status, 200);
      assert.equal(folderUsado, 'home');
      assert.equal(
        res.body.url,
        'https://supabase.co/storage/v1/object/public/imagenes/home/foto.webp'
      );
    });

    test('si uploadToSupabase lanza error, responde 500', async () => {
      const uploadUtils = require('../utils/upload');
      mock.method(uploadUtils, 'uploadToSupabase', async () => {
        throw new Error('Storage error');
      });

      const res = await request(app)
        .post('/api/admin/ajustes/home/imagen')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .attach('imagen', Buffer.from('fake-image-bytes'), 'hero.jpg');

      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error al subir la imagen de portada.');
    });
  });
});
