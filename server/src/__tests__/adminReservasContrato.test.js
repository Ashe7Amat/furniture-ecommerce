// Test de CONTRATO del panel de reservas (docs/reservas-diseno.md, 8.1 y 8.3; bloque R-d) con el
// cliente REAL de supabase-js y un fetch falso que responde como PostgREST (mismo patrón que
// queryContractCompraReservas.test.js). Fija lo que el doble en memoria da por supuesto:
//   - cómo sale el filtro de cada vista de la lista (gte/lte, not.is.null, el or de las próximas...)
//     y que las piezas se leen con una segunda consulta, no con un embed;
//   - que cada acción solo escribe si la fila sigue como se leyó (updated_at=eq.<lo leído>, con su
//     "+00:00" codificado) y qué cuerpo manda;
//   - el cuerpo exacto de cada alta, después de la limpieza de caducadas (4.6);
//   - que el 409 de PostgREST con {code: '23P01'} se convierte en el 409 que dice con qué choca, sin
//     el detalle de Postgres.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const { createClient } = require('@supabase/supabase-js');
const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { COLUMNAS_LISTA } = require('../utils/adminReservas');
const { hoyEnMadrid, sumarDias, fechaLegible, instanteEnMadrid } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const SOFA = '00000000-0000-4000-8000-000000000001';
const RESERVA = '00000000-0000-4000-8000-000000000101';
const OTRA = '00000000-0000-4000-8000-000000000102';
const PEDIDO_OTRA = 'c0ffee00-0000-4000-8000-000000000002';
// Como lo devuelve PostgREST: microsegundos y la zona con "+".
const LEIDO = '2026-10-13T21:30:00.123456+00:00';
const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const ESTADOS_QUE_OCUPAN = 'in.(pendiente,confirmada,en_curso,devuelta)';
const ERROR_EXCLUSION = {
  code: '23P01',
  details: `Key (mueble_id, rango_ocupado)=(${SOFA}, [2030-01-01,2030-01-05)) conflicts with existing key (mueble_id, rango_ocupado)=(${SOFA}, [2030-01-03,2030-01-08)).`,
  hint: null,
  message: 'conflicting key value violates exclusion constraint "reservas_sin_solape"'
};

const json = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  });

// Una fila tal como la devuelve PostgREST (horas con segundos, numeric como número, el rango en texto).
const fila = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SOFA,
  pedido_id: null,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: hoy,
  hora_entrega: '10:00:00',
  fecha_fin: dia(3),
  hora_recogida: '18:00:00',
  fin_ocupacion: dia(3),
  dias_margen: 2,
  expira_en: null,
  modo_entrega: 'tienda',
  modo_devolucion: 'tienda',
  direccion_entrega: null,
  datos_contacto: { nombre: 'Ana', email: 'ana@ejemplo.com', telefono: '600' },
  conflicto_en: null,
  importe_total: 120.5,
  stripe_payment_intent_id: 'pi_123',
  reembolso_solicitado_en: null,
  reembolso_importe: null,
  stripe_refund_id: null,
  motivo: null,
  motivo_cancelacion: null,
  entregada_en: null,
  devuelta_en: null,
  created_at: '2026-10-01T10:00:00.123456+00:00',
  historial: [],
  updated_at: LEIDO,
  ...cambios
});
// La reserva de otro cliente que va después, como la devuelve la búsqueda de choques.
const otra = {
  id: OTRA,
  pedido_id: PEDIDO_OTRA,
  tipo: 'alquiler',
  estado: 'confirmada',
  fecha_inicio: dia(6),
  fecha_fin: dia(9),
  fin_ocupacion: dia(9),
  dias_margen: 2,
  expira_en: null
};

// Lo que lee la búsqueda de choques de cada reserva: nada del cliente. La sesión de Stripe, para
// nombrar una compra web por su pedido (19 oct).
const COLUMNAS_CHOQUE = [
  'id',
  'pedido_id',
  'tipo',
  'estado',
  'fecha_inicio',
  'fecha_fin',
  'fin_ocupacion',
  'dias_margen',
  'expira_en',
  'stripe_session_id'
];

let peticiones;
let leida; // la última fila que devolvió una lectura por id: el UPDATE por defecto parte de ella
let leerReservas; // (params) => filas de GET /reservas
let responderPatch; // (params, cuerpo) => Response de PATCH /reservas
let responderPost; // (unObjeto) => Response de POST /reservas
const fetchFalso = async (url, init = {}) => {
  const u = new URL(url);
  const metodo = (init.method || 'GET').toUpperCase();
  const cabeceras = new Headers(init.headers);
  const peticion = {
    metodo,
    ruta: u.pathname,
    url,
    pares: [...u.searchParams],
    params: Object.fromEntries(u.searchParams),
    cuerpo: init.body ? JSON.parse(init.body) : null
  };
  peticiones.push(peticion);
  const unObjeto = (cabeceras.get('accept') || '').includes('vnd.pgrst.object');
  if (u.pathname === '/rest/v1/muebles') {
    if (metodo === 'GET') {
      return json(200, [
        { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' }
      ]);
    }
    return json(204);
  }
  if (u.pathname === '/rest/v1/reservas') {
    if (metodo === 'GET') {
      const filas = leerReservas(peticion.params);
      if (filas instanceof Response) return filas;
      if (peticion.params.id && filas.length) [leida] = filas;
      return json(200, filas);
    }
    if (metodo === 'PATCH') return responderPatch(peticion.params, peticion.cuerpo);
    if (metodo === 'POST') return responderPost(unObjeto, peticion.cuerpo);
  }
  return json(404, { message: `Petición no prevista: ${metodo} ${u.pathname}` });
};

const de = (metodo, ruta) =>
  peticiones.filter((p) => p.metodo === metodo && p.ruta === `/rest/v1/${ruta}`);
// La limpieza de caducadas de escribirEnCalendario (4.6) frente al UPDATE de la propia reserva.
const esLimpieza = (params) => params.estado === 'eq.pendiente';
const columnas = (params) => params.select.split(',');

let stripe;
let reembolsosEnStripe;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  peticiones = [];
  leida = null;
  leerReservas = () => [];
  // Por defecto: la limpieza no cambia nada y el UPDATE devuelve la fila leída con lo que se mandó.
  responderPatch = (params, cuerpo) =>
    esLimpieza(params)
      ? json(204)
      : json(200, [{ ...(leida || fila()), ...cuerpo, updated_at: LEIDO }]);
  responderPost = (unObjeto, cuerpo) => {
    const creada = { ...fila(), id: RESERVA, ...cuerpo };
    return json(201, unObjeto ? creada : [creada]);
  };
  const real = createClient('https://contrato.supabase.co', 'clave-de-prueba', {
    auth: { persistSession: false },
    global: { fetch: fetchFalso }
  });
  mock.method(supabase, 'from', (tabla) => real.from(tabla));
  reembolsosEnStripe = [];
  // Las llamadas a Stripe quedan también en `peticiones`, para ver su orden frente a la base de datos.
  const enStripe = (nombre, respuesta) =>
    mock.fn(async (...args) => {
      peticiones.push({ metodo: 'STRIPE', ruta: nombre, args });
      return respuesta(...args);
    });
  stripe = {
    refunds: {
      create: enStripe('refunds.create', () => ({ id: 're_1', status: 'succeeded' })),
      list: enStripe('refunds.list', () => ({ data: reembolsosEnStripe }))
    },
    paymentIntents: {
      retrieve: enStripe('paymentIntents.retrieve', (id) => ({ id, amount_received: 12050 }))
    }
  };
  mock.method(stripeUtil, 'getStripe', () => stripe);
  mock.method(console, 'error', () => {});
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

const comoAdmin = (peticion) => peticion.set('Authorization', `Bearer ${TOKEN_ADMIN}`);
const lista = (consulta) => comoAdmin(request(app).get(`/api/admin/reservas${consulta}`));
const accion = (nombre, cuerpo = {}) =>
  comoAdmin(request(app).post(`/api/admin/reservas/${RESERVA}/${nombre}`)).send(cuerpo);
const alta = (tipo, cuerpo) =>
  comoAdmin(request(app).post(`/api/admin/reservas/${tipo}`)).send(cuerpo);

describe('contrato de la lista: el filtro de cada vista', () => {
  test('próximas: dos consultas, lo que ocupa desde hoy sin ventas pasadas y los alquileres entregados', async () => {
    const res = await lista('?vista=proximas');

    assert.equal(res.status, 200);
    const consultas = de('GET', 'reservas');
    assert.equal(consultas.length, 2);
    const enCalendario = consultas.find((c) => c.params.rango_ocupado);
    assert.deepEqual(columnas(enCalendario.params), COLUMNAS_LISTA.split(', '));
    assert.equal(enCalendario.params.estado, ESTADOS_QUE_OCUPAN);
    assert.equal(enCalendario.params.rango_ocupado, `ov.[${hoy},)`);
    assert.equal(enCalendario.params.or, `(tipo.neq.venta,fecha_inicio.gte.${hoy})`);
    assert.equal(enCalendario.params.order, 'fecha_inicio.asc');
    const entregadas = consultas.find((c) => c !== enCalendario);
    assert.equal(entregadas.params.estado, 'eq.en_curso');
    assert.deepEqual(Object.keys(entregadas.params).sort(), ['estado', 'order', 'select']);
  });

  const casos = [
    [
      'entregas',
      [
        ['tipo', 'eq.alquiler'],
        ['estado', 'eq.confirmada'],
        ['fecha_inicio', `lte.${dia(1)}`],
        ['order', 'fecha_inicio.asc']
      ]
    ],
    [
      'recogidas',
      [
        ['tipo', 'eq.alquiler'],
        ['estado', 'eq.en_curso'],
        ['fin_ocupacion', `gte.${hoy}`],
        ['fin_ocupacion', `lte.${dia(1)}`],
        ['order', 'fin_ocupacion.asc']
      ]
    ],
    [
      'retrasadas',
      [
        ['tipo', 'eq.alquiler'],
        ['estado', 'eq.en_curso'],
        ['fecha_fin', `lt.${hoy}`],
        ['order', 'fecha_fin.asc']
      ]
    ],
    [
      'conflicto',
      [
        ['conflicto_en', 'not.is.null'],
        ['order', 'conflicto_en.desc']
      ]
    ],
    [
      'reembolsos',
      [
        ['reembolso_solicitado_en', 'not.is.null'],
        ['stripe_refund_id', 'is.null'],
        ['order', 'reembolso_solicitado_en.asc']
      ]
    ],
    [
      'legacy',
      [
        ['origen', 'eq.legacy'],
        ['estado', 'neq.cancelada'],
        ['order', 'fecha_inicio.asc']
      ]
    ],
    [
      'todas',
      [
        ['order', 'created_at.desc'],
        ['limit', '200']
      ]
    ]
  ];
  for (const [vista, filtros] of casos) {
    test(`${vista}: exactamente sus filtros`, async () => {
      assert.equal((await lista(`?vista=${vista}`)).status, 200);
      const [consulta] = de('GET', 'reservas');
      assert.deepEqual(columnas(consulta.params), COLUMNAS_LISTA.split(', '));
      assert.deepEqual(
        consulta.pares.filter(([clave]) => clave !== 'select'),
        filtros
      );
    });
  }

  test('con mueble_id, la pieza va como un filtro más', async () => {
    await lista(`?vista=entregas&mueble_id=${SOFA}`);
    const [consulta] = de('GET', 'reservas');
    assert.equal(consulta.params.mueble_id, `eq.${SOFA}`);
  });

  test('las piezas, con una segunda consulta por id; y la fila de PostgREST se lee bien', async () => {
    leerReservas = () => [fila({ pedido_id: 'a1b2c3d4-0000-4000-8000-000000000001' })];

    const res = await lista('?vista=todas');

    const [piezas] = de('GET', 'muebles');
    assert.equal(piezas.params.select, 'id,nombre,referencia');
    assert.equal(piezas.params.id, `in.(${SOFA})`);
    const [reserva] = res.body.reservas;
    assert.equal(reserva.referencia, 'A1B2C3D4');
    assert.equal(reserva.hora_entrega, '10:00');
    assert.equal(reserva.hora_recogida, '18:00');
    assert.equal(reserva.importe_total, 120.5);
    assert.equal(reserva.pieza.nombre, 'Sofá Lumina');
    assert.deepEqual(reserva.acciones, ['entregar', 'cancelar']);
  });

  test('un error de PostgREST en la lista: 500 genérico, sin el detalle de Postgres', async () => {
    leerReservas = () =>
      json(500, {
        code: '57014',
        details: null,
        hint: null,
        message: 'canceling statement due to statement timeout'
      });

    const res = await lista('?vista=todas');

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al cargar las reservas.' });
    assert.equal(de('GET', 'muebles').length, 0, 'sin reservas no se leen piezas');
  });

  test('una búsqueda lee las 1000 más recientes de todas, sin filtro de vista ni de texto, y filtra en memoria', async () => {
    leerReservas = () => [
      fila(),
      fila({
        id: OTRA,
        datos_contacto: { nombre: 'Luis', email: 'luis@ejemplo.com', telefono: '611' }
      })
    ];

    const res = await lista(`?q=luis&desde=${hoy}&hasta=${dia(3)}&mueble_id=${SOFA}`);

    assert.equal(res.status, 200);
    const consultas = de('GET', 'reservas');
    assert.equal(consultas.length, 1);
    assert.deepEqual(columnas(consultas[0].params), COLUMNAS_LISTA.split(', '));
    assert.deepEqual(
      consultas[0].pares.filter(([clave]) => clave !== 'select'),
      [
        ['mueble_id', `eq.${SOFA}`],
        ['order', 'created_at.desc'],
        ['limit', '1000']
      ]
    );
    assert.deepEqual(
      res.body.reservas.map((r) => r.id),
      [OTRA]
    );
    assert.equal(res.body.limitada, false);
  });

  test('el calendario: lo que ocupa la ventana (con su último día incluido) y, si llega a hoy, las retrasadas', async () => {
    leerReservas = (params) =>
      params.estado === 'eq.en_curso'
        ? [
            fila({
              id: OTRA,
              estado: 'en_curso',
              fecha_inicio: dia(-10),
              fecha_fin: dia(-3),
              fin_ocupacion: dia(-3)
            })
          ]
        : [fila({ fecha_inicio: dia(5), fecha_fin: dia(8), fin_ocupacion: dia(8) })];

    const res = await comoAdmin(
      request(app).get(
        `/api/admin/reservas/calendario?desde=${dia(0)}&hasta=${dia(30)}&mueble_id=${SOFA}`
      )
    );

    assert.equal(res.status, 200);
    const consultas = de('GET', 'reservas');
    assert.equal(consultas.length, 2);
    for (const consulta of consultas) {
      assert.deepEqual(columnas(consulta.params), COLUMNAS_LISTA.split(', '));
    }
    const enLaVentana = consultas.find((c) => c.params.rango_ocupado);
    assert.deepEqual(
      enLaVentana.pares.filter(([clave]) => clave !== 'select'),
      [
        ['mueble_id', `eq.${SOFA}`],
        ['estado', ESTADOS_QUE_OCUPAN],
        ['rango_ocupado', `ov.[${dia(0)},${dia(31)})`],
        ['order', 'fecha_inicio.asc'],
        ['limit', '1000']
      ]
    );
    const retrasadas = consultas.find((c) => c !== enLaVentana);
    assert.deepEqual(
      retrasadas.pares.filter(([clave]) => clave !== 'select'),
      [
        ['mueble_id', `eq.${SOFA}`],
        ['tipo', 'eq.alquiler'],
        ['estado', 'eq.en_curso'],
        ['fecha_fin', `lt.${hoy}`],
        ['order', 'fecha_inicio.asc']
      ]
    );
    assert.equal(de('GET', 'muebles').length, 1, 'las piezas de todas se leen de una vez');
    assert.deepEqual(
      res.body.reservas.map((r) => [r.id, r.retrasada]),
      [
        [OTRA, true],
        [RESERVA, false]
      ]
    );
  });

  test('el calendario de unos días pasados no busca retrasadas', async () => {
    const res = await comoAdmin(
      request(app).get(`/api/admin/reservas/calendario?desde=${dia(-20)}&hasta=${dia(-10)}`)
    );

    assert.equal(res.status, 200);
    assert.equal(de('GET', 'reservas').length, 1);
  });

  test('la agenda de hoy y mañana: las mismas dos consultas que «Entregas» y «Recogidas», y las piezas de las dos con una sola', async () => {
    leerReservas = (params) =>
      params.estado === 'eq.confirmada'
        ? [fila()]
        : [
            fila({
              id: OTRA,
              estado: 'en_curso',
              fecha_inicio: dia(-3),
              fecha_fin: dia(1),
              fin_ocupacion: dia(1)
            })
          ];

    const res = await comoAdmin(request(app).get('/api/admin/reservas/agenda'));

    assert.equal(res.status, 200);
    const consultas = de('GET', 'reservas');
    assert.equal(consultas.length, 2);
    for (const consulta of consultas) {
      assert.deepEqual(columnas(consulta.params), COLUMNAS_LISTA.split(', '));
    }
    const entregas = consultas.find((c) => c.params.estado === 'eq.confirmada');
    const recogidas = consultas.find((c) => c.params.estado === 'eq.en_curso');
    assert.equal(entregas.params.fecha_inicio, `lte.${dia(1)}`);
    assert.equal(recogidas.params.fin_ocupacion, `lte.${dia(1)}`);
    assert.equal(de('GET', 'muebles').length, 1, 'las piezas de la agenda se leen de una vez');
    assert.deepEqual(
      res.body.trayectos.map((t) => [t.tipo, t.dia, t.hora]),
      [
        ['entrega', hoy, '10:00'],
        ['recogida', dia(1), '18:00']
      ]
    );
  });
});

describe('contrato de las acciones: el UPDATE guardado por updated_at', () => {
  test('entregar: lee la fila, la cambia solo si sigue igual y luego la pieza, solo si estaba disponible', async () => {
    leerReservas = () => [fila()];

    const res = await accion('entregar');

    assert.equal(res.status, 200);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      [
        'GET /rest/v1/reservas',
        'PATCH /rest/v1/reservas',
        'PATCH /rest/v1/muebles',
        'GET /rest/v1/muebles'
      ]
    );
    const [lectura] = de('GET', 'reservas');
    assert.equal(lectura.params.id, `eq.${RESERVA}`);
    assert.deepEqual(columnas(lectura.params).slice(-4), [
      'id',
      'mueble_id',
      'historial',
      'updated_at'
    ]);
    const [cambio] = de('PATCH', 'reservas');
    assert.equal(cambio.params.id, `eq.${RESERVA}`);
    assert.equal(cambio.params.updated_at, `eq.${LEIDO}`);
    assert.ok(cambio.url.includes('%2B00%3A00'), 'el "+" va codificado en la URL');
    assert.deepEqual(Object.keys(cambio.cuerpo), ['estado', 'entregada_en', 'historial']);
    assert.equal(cambio.cuerpo.estado, 'en_curso');
    assert.equal(cambio.cuerpo.historial.at(-1).tipo, 'entregada');
    assert.equal(cambio.cuerpo.historial.at(-1).por, 'admin');
    const [pieza] = de('PATCH', 'muebles');
    assert.equal(pieza.params.id, `eq.${SOFA}`);
    assert.equal(pieza.params.estado, 'eq.disponible');
    assert.deepEqual(pieza.cuerpo, { estado: 'alquilado' });
    assert.equal(res.body.reserva.estado, 'en_curso');
  });

  test('si el UPDATE no cambia ninguna fila (otra escritura entre medias), vuelve a leer y decide otra vez', async () => {
    let lecturas = 0;
    leerReservas = () => {
      lecturas += 1;
      return [lecturas === 1 ? fila() : fila({ estado: 'en_curso', updated_at: LEIDO })];
    };
    responderPatch = () => json(200, []);

    const res = await accion('entregar');

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'Este alquiler ya está marcado como entregado.' });
    assert.equal(de('PATCH', 'reservas').length, 1);
    assert.equal(de('PATCH', 'muebles').length, 0);
  });

  test('recoger: pasa por la limpieza (ocupa más calendario si es tarde) y manda la devolución', async () => {
    leerReservas = () => [fila({ estado: 'en_curso', fecha_inicio: dia(-3), entregada_en: LEIDO })];

    const res = await accion('recoger');

    assert.equal(res.status, 200);
    const [limpieza, cambio] = de('PATCH', 'reservas');
    assert.ok(esLimpieza(limpieza.params));
    assert.equal(limpieza.params.mueble_id, `eq.${SOFA}`);
    assert.match(limpieza.params.expira_en, /^lt\./);
    assert.deepEqual(limpieza.cuerpo, { estado: 'expirada' });
    assert.deepEqual(Object.keys(cambio.cuerpo), ['estado', 'devuelta_en', 'historial']);
    assert.equal(cambio.cuerpo.estado, 'devuelta');
    assert.equal('fin_ocupacion' in cambio.cuerpo, false, 'lo pone el disparador de R2');
    const [pieza] = de('PATCH', 'muebles');
    assert.equal(pieza.params.estado, 'eq.alquilado');
    assert.deepEqual(pieza.cuerpo, { estado: 'disponible' });
  });

  test('ampliar: el 409 de PostgREST con 23P01 se limpia, se reintenta y acaba en el 409 que nombra la siguiente', async () => {
    leerReservas = (params) =>
      params.id
        ? [
            fila({
              estado: 'en_curso',
              fecha_inicio: dia(-3),
              fecha_fin: dia(-1),
              fin_ocupacion: dia(-1),
              entregada_en: LEIDO
            })
          ]
        : [otra];
    responderPatch = (params) => (esLimpieza(params) ? json(204) : json(409, ERROR_EXCLUSION));

    const res = await accion('ampliar', { fin_ocupacion: dia(5) });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `La nueva fecha choca con el alquiler #C0FFEE00 (del ${fechaLegible(dia(6))} al ` +
        `${fechaLegible(dia(9))}, más 2 días de margen): avisa a ese cliente antes de ampliar.`
    });
    assert.ok(!/Key|reservas_sin_solape/.test(res.body.error));
    assert.deepEqual(
      peticiones.filter((p) => p.ruta === '/rest/v1/reservas').map((p) => p.metodo),
      ['GET', 'PATCH', 'PATCH', 'PATCH', 'PATCH', 'GET']
    );
    const choques = de('GET', 'reservas')[1];
    assert.deepEqual(columnas(choques.params), COLUMNAS_CHOQUE);
    assert.equal(choques.params.mueble_id, `eq.${SOFA}`);
    assert.equal(choques.params.estado, ESTADOS_QUE_OCUPAN);
    assert.equal(choques.params.rango_ocupado, `ov.[${dia(-3)},${dia(7)})`);
  });

  test('cancelar con reembolso: lee el tope en Stripe, reclama la marca en el mismo UPDATE, reembolsa y guarda el id con otro UPDATE guardado', async () => {
    leerReservas = () => [fila()];

    const res = await accion('cancelar', { motivo: 'Avería', reembolso_centimos: 5000 });

    assert.equal(res.status, 200);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      [
        'GET /rest/v1/reservas',
        'STRIPE paymentIntents.retrieve',
        'STRIPE refunds.list',
        'GET /rest/v1/reservas',
        'PATCH /rest/v1/reservas',
        'STRIPE refunds.create',
        'GET /rest/v1/reservas',
        'PATCH /rest/v1/reservas',
        'GET /rest/v1/muebles'
      ]
    );
    const [lecturaPrevia] = de('GET', 'reservas');
    assert.equal(lecturaPrevia.params.id, `eq.${RESERVA}`);
    assert.deepEqual(stripe.paymentIntents.retrieve.mock.calls[0].arguments, ['pi_123']);
    assert.deepEqual(stripe.refunds.list.mock.calls[0].arguments, [
      { payment_intent: 'pi_123', limit: 100 }
    ]);
    const [cancelacion, guardado] = de('PATCH', 'reservas');
    assert.equal(cancelacion.params.updated_at, `eq.${LEIDO}`);
    assert.deepEqual(Object.keys(cancelacion.cuerpo), [
      'estado',
      'cancelada_en',
      'cancelada_por',
      'motivo_cancelacion',
      'reembolso_solicitado_en',
      'reembolso_importe',
      'historial'
    ]);
    assert.equal(cancelacion.cuerpo.estado, 'cancelada');
    assert.equal(cancelacion.cuerpo.cancelada_por, 'admin');
    assert.equal(cancelacion.cuerpo.reembolso_importe, 50);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    assert.equal(guardado.params.updated_at, `eq.${LEIDO}`);
    assert.deepEqual(Object.keys(guardado.cuerpo), ['stripe_refund_id', 'historial']);
    assert.equal(guardado.cuerpo.stripe_refund_id, 're_1');
    // Un alquiler: la pieza no se toca.
    assert.equal(de('PATCH', 'muebles').length, 0);
  });

  test('cancelar una venta: la pieza vuelve a disponible solo si estaba vendida', async () => {
    leerReservas = () => [
      fila({
        tipo: 'venta',
        fecha_fin: null,
        fin_ocupacion: null,
        dias_margen: 0,
        stripe_payment_intent_id: null
      })
    ];
    const res = await accion('cancelar', { motivo: 'Devolución', reembolso_centimos: 0 });
    assert.equal(res.status, 200);
    const [pieza] = de('PATCH', 'muebles');
    assert.equal(pieza.params.estado, 'eq.vendido');
    assert.deepEqual(pieza.cuerpo, { estado: 'disponible' });
  });

  test('entregar antes de tiempo: pasa por la limpieza y mueve fecha_inicio a hoy en el mismo UPDATE guardado', async () => {
    leerReservas = () => [fila({ fecha_inicio: dia(4), fecha_fin: dia(7), fin_ocupacion: dia(7) })];

    const res = await accion('entregar', { antes_de_tiempo: true });

    assert.equal(res.status, 200);
    const [limpieza, cambio] = de('PATCH', 'reservas');
    assert.ok(esLimpieza(limpieza.params));
    assert.equal(cambio.params.updated_at, `eq.${LEIDO}`);
    assert.deepEqual(Object.keys(cambio.cuerpo), [
      'estado',
      'entregada_en',
      'fecha_inicio',
      'historial'
    ]);
    assert.equal(cambio.cuerpo.fecha_inicio, hoy);
    assert.match(cambio.cuerpo.historial.at(-1).detalle, new RegExp(fechaLegible(dia(4))));
  });

  test('entregar antes de tiempo contra lo que va antes: el 23P01 acaba en el 409 que lo nombra', async () => {
    leerReservas = (params) =>
      params.id
        ? [fila({ fecha_inicio: dia(4), fecha_fin: dia(7), fin_ocupacion: dia(7) })]
        : [{ ...otra, fecha_inicio: dia(-3), fecha_fin: hoy, fin_ocupacion: hoy }];
    responderPatch = (params) => (esLimpieza(params) ? json(204) : json(409, ERROR_EXCLUSION));

    const res = await accion('entregar', { antes_de_tiempo: true });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `Entregarla hoy choca con el alquiler #C0FFEE00 (del ${fechaLegible(dia(-3))} al ` +
        `${fechaLegible(hoy)}, más 2 días de margen).`
    });
    const choques = de('GET', 'reservas')[1];
    assert.deepEqual(columnas(choques.params), COLUMNAS_CHOQUE);
    assert.equal(choques.params.rango_ocupado, `ov.[${hoy},${dia(9)})`);
    assert.equal(de('PATCH', 'muebles').length, 0);
  });

  test('recoger otro día: devuelta_en es ese día a las 12:00 de Madrid y fin_ocupacion lo pone R2', async () => {
    leerReservas = () => [
      fila({ estado: 'en_curso', fecha_inicio: dia(-5), entregada_en: `${dia(-5)}T09:00:00+00:00` })
    ];

    const res = await accion('recoger', { fecha_recogida: dia(-1) });

    assert.equal(res.status, 200);
    const [, cambio] = de('PATCH', 'reservas');
    assert.deepEqual(Object.keys(cambio.cuerpo), ['estado', 'devuelta_en', 'historial']);
    assert.equal(cambio.cuerpo.devuelta_en, instanteEnMadrid(dia(-1), '12:00').toISOString());
  });

  test('recoger tarde contra la siguiente: busca con qué choca y repite el UPDATE guardado con el margen recortado', async () => {
    leerReservas = (params) =>
      params.id
        ? [
            fila({
              estado: 'en_curso',
              fecha_inicio: dia(-6),
              fecha_fin: dia(-3),
              fin_ocupacion: dia(-3),
              entregada_en: LEIDO
            })
          ]
        : [{ ...otra, fecha_inicio: dia(1), fecha_fin: dia(4), fin_ocupacion: dia(4) }];
    responderPatch = (params, cuerpo) => {
      if (esLimpieza(params)) return json(204);
      if (cuerpo.dias_margen === undefined) return json(409, ERROR_EXCLUSION);
      return json(200, [{ ...leida, ...cuerpo, fin_ocupacion: hoy, updated_at: LEIDO }]);
    };

    const res = await accion('recoger');

    assert.equal(res.status, 200);
    assert.equal(
      res.body.aviso,
      `La pieza ha vuelto tarde: hasta el alquiler #C0FFEE00 del ${fechaLegible(dia(1))} solo ` +
        'queda 1 día de margen.'
    );
    assert.deepEqual(
      peticiones.filter((p) => p.ruta === '/rest/v1/reservas').map((p) => p.metodo),
      ['GET', 'PATCH', 'PATCH', 'PATCH', 'PATCH', 'GET', 'GET', 'PATCH', 'PATCH']
    );
    const choques = de('GET', 'reservas')[1];
    assert.deepEqual(columnas(choques.params), COLUMNAS_CHOQUE);
    assert.equal(choques.params.rango_ocupado, `ov.[${dia(-6)},${dia(2)})`);
    const recortado = de('PATCH', 'reservas').at(-1);
    assert.equal(recortado.params.updated_at, `eq.${LEIDO}`);
    assert.deepEqual(Object.keys(recortado.cuerpo), [
      'estado',
      'devuelta_en',
      'dias_margen',
      'historial'
    ]);
    assert.equal(recortado.cuerpo.dias_margen, 1);
  });

  test('dar por reembolsado: mira en Stripe lo devuelto y guarda solo la línea del historial, con el UPDATE guardado', async () => {
    leerReservas = () => [
      fila({
        estado: 'cancelada',
        reembolso_solicitado_en: '2026-10-10T10:00:00.123456+00:00',
        reembolso_importe: 50
      })
    ];
    reembolsosEnStripe = [
      {
        id: 're_fuera',
        status: 'succeeded',
        amount: 5000,
        created: Date.parse('2026-10-10T11:00:00Z') / 1000
      }
    ];

    const res = await accion('dar-por-reembolsado');

    assert.equal(res.status, 200);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      [
        'GET /rest/v1/reservas',
        'STRIPE refunds.list',
        'GET /rest/v1/reservas',
        'PATCH /rest/v1/reservas',
        'GET /rest/v1/muebles'
      ]
    );
    assert.deepEqual(stripe.refunds.list.mock.calls[0].arguments[0], {
      payment_intent: 'pi_123',
      limit: 100
    });
    const [cambio] = de('PATCH', 'reservas');
    assert.equal(cambio.params.id, `eq.${RESERVA}`);
    assert.equal(cambio.params.updated_at, `eq.${LEIDO}`);
    assert.deepEqual(Object.keys(cambio.cuerpo), ['historial']);
    assert.equal(cambio.cuerpo.historial.at(-1).tipo, 'reembolso_dado_por_hecho');
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(res.body.reserva.reembolso_a_medias, false);
  });

  test('levantar un bloqueo: solo estado, fecha y quién, más la línea', async () => {
    leerReservas = () => [
      fila({ tipo: 'bloqueo', hora_entrega: null, hora_recogida: null, dias_margen: 0 })
    ];
    const res = await accion('levantar-bloqueo');
    assert.equal(res.status, 200);
    const [cambio] = de('PATCH', 'reservas');
    assert.deepEqual(Object.keys(cambio.cuerpo), [
      'estado',
      'cancelada_en',
      'cancelada_por',
      'historial'
    ]);
  });
});

describe('contrato de las altas: el cuerpo de cada inserción', () => {
  const sinFecha = (cuerpo) => ({
    ...cuerpo,
    historial: cuerpo.historial.map(({ fecha, ...linea }) => {
      assert.ok(!Number.isNaN(Date.parse(fecha)));
      return linea;
    })
  });

  test('bloqueo: lee la pieza, limpia las caducadas y luego inserta, pidiendo la fila de vuelta', async () => {
    const res = await alta('bloqueos', {
      mueble_id: SOFA,
      fecha_inicio: dia(3),
      fecha_fin: dia(6),
      motivo: 'Mantenimiento'
    });

    assert.equal(res.status, 201);
    assert.deepEqual(
      peticiones.map((p) => `${p.metodo} ${p.ruta}`),
      ['GET /rest/v1/muebles', 'PATCH /rest/v1/reservas', 'POST /rest/v1/reservas']
    );
    const [pieza] = de('GET', 'muebles');
    assert.equal(pieza.params.id, `eq.${SOFA}`);
    assert.equal(pieza.params.select, 'id,nombre,referencia,estado');
    const [insercion] = de('POST', 'reservas');
    assert.deepEqual(columnas(insercion.params), COLUMNAS_LISTA.split(', '));
    assert.deepEqual(sinFecha(insercion.cuerpo), {
      mueble_id: SOFA,
      tipo: 'bloqueo',
      estado: 'confirmada',
      fecha_inicio: dia(3),
      fecha_fin: dia(6),
      fin_ocupacion: dia(6),
      dias_margen: 0,
      origen: 'manual',
      motivo: 'Mantenimiento',
      historial: [{ tipo: 'creada', detalle: 'Bloqueo: Mantenimiento', por: 'admin' }]
    });
  });

  test('alquiler fuera de la web', async () => {
    const res = await alta('alquileres', {
      mueble_id: SOFA,
      fecha_inicio: dia(0),
      hora_entrega: '09:30',
      fecha_fin: dia(6),
      hora_recogida: '19:00',
      modo_entrega: 'domicilio',
      modo_devolucion: 'tienda',
      contacto: { nombre: 'Marta', telefono: '622333444', direccion: 'Carrer de Sants 10' },
      importe_total_centimos: 18050,
      origen: 'manual',
      ya_entregado: true
    });

    assert.equal(res.status, 201);
    const [insercion] = de('POST', 'reservas');
    const { entregada_en: entregadaEn, ...resto } = sinFecha(insercion.cuerpo);
    assert.ok(!Number.isNaN(Date.parse(entregadaEn)));
    assert.deepEqual(resto, {
      mueble_id: SOFA,
      tipo: 'alquiler',
      estado: 'en_curso',
      fecha_inicio: dia(0),
      hora_entrega: '09:30',
      fecha_fin: dia(6),
      hora_recogida: '19:00',
      fin_ocupacion: dia(6),
      dias_margen: 2,
      modo_entrega: 'domicilio',
      modo_devolucion: 'tienda',
      direccion_entrega: 'Carrer de Sants 10',
      datos_contacto: {
        nombre: 'Marta',
        email: null,
        telefono: '622333444',
        direccion: 'Carrer de Sants 10',
        notas: null
      },
      importe_total: 180.5,
      origen: 'manual',
      historial: [
        {
          tipo: 'creada',
          detalle: 'Alquiler pactado fuera de la web. Ya estaba entregado.',
          por: 'admin'
        }
      ]
    });
    const [pieza] = de('PATCH', 'muebles');
    assert.equal(pieza.params.estado, 'eq.disponible');
    assert.deepEqual(pieza.cuerpo, { estado: 'alquilado' });
  });

  test('alquiler ya entregado con la recogida pactada pasada: fin_ocupacion es hoy, no la fecha pactada', async () => {
    const res = await alta('alquileres', {
      mueble_id: SOFA,
      fecha_inicio: dia(-20),
      hora_entrega: '09:30',
      fecha_fin: dia(-4),
      hora_recogida: '19:00',
      modo_entrega: 'tienda',
      modo_devolucion: 'tienda',
      contacto: { nombre: 'Marta' },
      origen: 'legacy',
      ya_entregado: true
    });
    assert.equal(res.status, 201);
    const [insercion] = de('POST', 'reservas');
    assert.equal(insercion.cuerpo.fecha_fin, dia(-4));
    assert.equal(insercion.cuerpo.fin_ocupacion, hoy);
  });

  test('venta fuera de la web de hoy: sin fin, y la pieza pasa a vendida sin mirar su estado', async () => {
    const res = await alta('ventas', { mueble_id: SOFA, fecha_inicio: hoy, motivo: 'En tienda' });

    assert.equal(res.status, 201);
    const [insercion] = de('POST', 'reservas');
    assert.deepEqual(sinFecha(insercion.cuerpo), {
      mueble_id: SOFA,
      tipo: 'venta',
      estado: 'confirmada',
      fecha_inicio: hoy,
      dias_margen: 0,
      origen: 'manual',
      motivo: 'En tienda',
      historial: [{ tipo: 'creada', detalle: 'Venta fuera de la web: En tienda', por: 'admin' }]
    });
    const [pieza] = de('PATCH', 'muebles');
    assert.deepEqual(pieza.params, { id: `eq.${SOFA}` });
    assert.deepEqual(pieza.cuerpo, { estado: 'vendido' });
  });

  test('el 409 de PostgREST con 23P01 al insertar: se limpia y se reintenta, y después es el 409 que dice con qué choca', async () => {
    responderPost = () => json(409, ERROR_EXCLUSION);
    leerReservas = () => [otra];

    const res = await alta('bloqueos', {
      mueble_id: SOFA,
      fecha_inicio: dia(5),
      fecha_fin: dia(8),
      motivo: 'Mantenimiento'
    });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `Esas fechas chocan con el alquiler #C0FFEE00 (del ${fechaLegible(dia(6))} al ` +
        `${fechaLegible(dia(9))}, más 2 días de margen).`
    });
    assert.ok(!res.text.includes(SOFA), 'nada del detalle de Postgres');
    assert.ok(!/Key|reservas_sin_solape|conflicting/.test(res.text));
    assert.deepEqual(
      peticiones.filter((p) => p.ruta === '/rest/v1/reservas').map((p) => p.metodo),
      ['PATCH', 'POST', 'PATCH', 'POST', 'GET']
    );
    const [choques] = de('GET', 'reservas');
    assert.equal(choques.params.rango_ocupado, `ov.[${dia(5)},${dia(8)})`);
    assert.equal(choques.params.estado, ESTADOS_QUE_OCUPAN);
  });

  test('una venta que choca: el rango que se busca es abierto por arriba', async () => {
    responderPost = () => json(409, ERROR_EXCLUSION);
    leerReservas = () => [otra];
    const res = await alta('ventas', { mueble_id: SOFA, fecha_inicio: hoy, motivo: 'En tienda' });
    assert.equal(res.status, 409);
    assert.match(
      res.body.error,
      new RegExp(`Puede empezar, como pronto, el ${fechaLegible(dia(11))}\\.$`)
    );
    const [choques] = de('GET', 'reservas');
    assert.equal(choques.params.rango_ocupado, `ov.[${hoy},)`);
    assert.equal(de('PATCH', 'muebles').length, 0, 'sin venta, la pieza no se toca');
  });

  test('el 23503 de PostgREST (la pieza ya no existe) es un 404', async () => {
    responderPost = () =>
      json(409, {
        code: '23503',
        details: `Key (mueble_id)=(${SOFA}) is not present in table "muebles".`,
        hint: null,
        message:
          'insert or update on table "reservas" violates foreign key constraint "reservas_mueble_id_fkey"'
      });
    const res = await alta('ventas', { mueble_id: SOFA, fecha_inicio: hoy, motivo: 'En tienda' });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Mueble no encontrado.' });
  });
});
