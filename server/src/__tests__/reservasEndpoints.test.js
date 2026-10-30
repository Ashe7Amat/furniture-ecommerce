// Tests de los endpoints de solo lectura de las reservas por fechas (controllers/reservasController.js,
// docs/reservas-diseno.md 7.1 y 7.2), con el doble de Supabase. Las fechas van relativas a hoy en
// Madrid, porque los endpoints usan el reloj de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const supabase = require('../data/supabase');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');
const { MENSAJE_ALQUILER_CERRADO } = require('../controllers/reservasController');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);

let fake;
const instalar = (opciones = {}) => {
  fake = crearFakeSupabase({
    muebles: [
      { id: 'm1', nombre: 'Silla', estado: 'disponible', precio_alquiler_dia: 25 },
      { id: 'm2', nombre: 'Mesa', estado: 'vendido', precio_alquiler_dia: 40 },
      { id: 'm3', nombre: 'Banco', estado: 'disponible', precio_alquiler_dia: null }
    ],
    ...opciones
  });
  mock.method(supabase, 'from', fake.from);
};

afterEach(() => {
  mock.restoreAll();
  process.env.MOSTRAR_PRECIOS = 'true';
});

describe('GET /api/muebles/:id/disponibilidad', () => {
  beforeEach(() =>
    instalar({
      reservas: [
        // Ocupa del día 10 al 15 (fin 13 + 2 de margen).
        {
          id: 'r1',
          mueble_id: 'm1',
          tipo: 'alquiler',
          estado: 'confirmada',
          fecha_inicio: dia(10),
          fecha_fin: dia(13),
          fin_ocupacion: dia(13),
          dias_margen: 2,
          cliente_id: 'c1',
          datos_contacto: { nombre: 'Ana', email: 'ana@ejemplo.com' }
        },
        // Ya pasado: no sale.
        {
          id: 'r2',
          mueble_id: 'm1',
          tipo: 'alquiler',
          estado: 'devuelta',
          fecha_inicio: dia(-20),
          fecha_fin: dia(-10),
          fin_ocupacion: dia(-10),
          dias_margen: 2
        },
        // Cancelada: no ocupa.
        {
          id: 'r3',
          mueble_id: 'm1',
          tipo: 'alquiler',
          estado: 'cancelada',
          fecha_inicio: dia(30),
          fecha_fin: dia(33),
          fin_ocupacion: dia(33),
          dias_margen: 2
        },
        // De otra pieza: no sale.
        {
          id: 'r4',
          mueble_id: 'm3',
          tipo: 'bloqueo',
          estado: 'confirmada',
          fecha_inicio: dia(5),
          fecha_fin: dia(8),
          fin_ocupacion: dia(8),
          dias_margen: 0
        }
      ]
    })
  );

  test('devuelve lo ocupado de esa pieza, con margen, sin datos del cliente y sin caché', async () => {
    const res = await request(app).get('/api/muebles/m1/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.hoy, hoy);
    assert.equal(res.body.desde, hoy);
    assert.deepEqual(res.body.ocupado, [{ desde: dia(10), hasta: dia(15), tipo: 'reservado' }]);
    assert.equal(res.body.alquilable, true);
    assert.equal(res.body.comprable, false);
    assert.equal(res.body.comprable_desde, dia(15));
    assert.equal(res.body.precio_dia_centimos, 2500);
    assert.doesNotMatch(JSON.stringify(res.body), /Ana|ana@ejemplo|c1|r1/);
  });

  test('solo lee: no escribe nada en ninguna tabla', async () => {
    await request(app).get('/api/muebles/m1/disponibilidad');
    assert.deepEqual(fake.escrituras, []);
  });

  test('con ?desde y ?hasta, el calendario enseña solo esa ventana', async () => {
    const res = await request(app).get(
      `/api/muebles/m1/disponibilidad?desde=${dia(20)}&hasta=${dia(40)}`
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.ocupado, []);
    assert.equal(res.body.comprable, false, 'la compra sigue mirando todo lo futuro');
  });

  test('un bloqueo futuro también impide comprar, y no hace falta precio para verlo', async () => {
    const res = await request(app).get('/api/muebles/m3/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.comprable, false);
    assert.equal(res.body.comprable_desde, dia(8));
    assert.equal(res.body.alquilable, false, 'sin precio de alquiler');
    assert.deepEqual(res.body.ocupado, [{ desde: dia(5), hasta: dia(8), tipo: 'bloqueado' }]);
  });

  test('una pieza sin nada de hoy en adelante se puede comprar', async () => {
    const res = await request(app).get('/api/muebles/m2/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.comprable, false, 'm2 está marcada como vendida');
    fake.tablas.muebles.find((m) => m.id === 'm2').estado = 'disponible';
    const otra = await request(app).get('/api/muebles/m2/disponibilidad');
    assert.equal(otra.body.comprable, true);
    assert.deepEqual(otra.body.ocupado, []);
  });

  test('con los precios ocultos no enseña el precio por día', async () => {
    process.env.MOSTRAR_PRECIOS = 'false';
    const res = await request(app).get('/api/muebles/m1/disponibilidad');
    assert.equal(res.status, 200);
    assert.equal(res.body.precio_dia_centimos, null);
  });

  test('una pieza que no existe: 404', async () => {
    const res = await request(app).get('/api/muebles/no-existe/disponibilidad');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Mueble no encontrado.');
  });

  test('fechas mal escritas: 400 con el motivo', async () => {
    const res = await request(app).get('/api/muebles/m1/disponibilidad?hasta=31/12/2026');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Las fechas tienen que ir en formato AAAA-MM-DD.');
  });

  test('un error de la base de datos: 500 sin detalles', async () => {
    fake.fallos['reservas.select'] = { message: 'relation "public.reservas" does not exist' };
    mock.method(console, 'error', () => {});
    const res = await request(app).get('/api/muebles/m1/disponibilidad');
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error interno al consultar la disponibilidad.');
  });
});

describe('GET /api/muebles/:id/presupuesto', () => {
  beforeEach(() => instalar());

  const url = (id, consulta) => `/api/muebles/${id}/presupuesto?${new URLSearchParams(consulta)}`;
  const valida = {
    fecha_inicio: dia(10),
    hora_entrega: '10:00',
    fecha_fin: dia(13),
    hora_recogida: '10:00',
    entrega: 'domicilio',
    recogida: 'tienda'
  };

  test('devuelve el presupuesto en céntimos, sin caché', async () => {
    const res = await request(app).get(url('m1', valida));
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.mueble_id, 'm1');
    assert.equal(res.body.dias, 3);
    // 75 € de alquiler más la fianza del 30 % (22,50 €), que va en el total y en su línea.
    assert.equal(res.body.importe_total_centimos, 9750);
    assert.deepEqual(res.body.fianza, { porcentaje: 30, importe_centimos: 2250 });
    assert.deepEqual(
      res.body.lineas.map((l) => l.concepto),
      ['alquiler', 'entrega', 'recogida', 'fianza']
    );
  });

  test('una regla incumplida: 400 con el motivo', async () => {
    const res = await request(app).get(url('m1', { ...valida, fecha_inicio: hoy }));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /^La entrega más temprana posible es el \d{2}\/\d{2}\/\d{4}\.$/);
  });

  test('sin fechas: 400', async () => {
    const res = await request(app).get('/api/muebles/m1/presupuesto');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Elige las fechas de entrega y de recogida.');
  });

  test('una pieza vendida o sin precio de alquiler no se puede alquilar', async () => {
    for (const id of ['m2', 'm3']) {
      const res = await request(app).get(url(id, valida));
      assert.equal(res.status, 400, id);
      assert.equal(res.body.error, 'Esta pieza no se puede alquilar.', id);
    }
  });

  test('una pieza que no existe: 404', async () => {
    const res = await request(app).get(url('no-existe', valida));
    assert.equal(res.status, 404);
  });

  test('con los precios ocultos no da presupuestos: 403', async () => {
    process.env.MOSTRAR_PRECIOS = 'false';
    const res = await request(app).get(url('m1', valida));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, MENSAJE_ALQUILER_CERRADO);
  });

  test('un error de la base de datos al leer la pieza: 404, como la ficha', async () => {
    fake.fallos['muebles.select'] = {
      code: '22P02',
      message: 'invalid input syntax for type uuid'
    };
    const res = await request(app).get(url('m1', valida));
    assert.equal(res.status, 404);
  });

  test('un error inesperado: 500 sin detalles', async () => {
    mock.method(supabase, 'from', () => {
      throw new Error('caída');
    });
    mock.method(console, 'error', () => {});
    const res = await request(app).get(url('m1', valida));
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error interno al calcular el presupuesto.');
  });
});
