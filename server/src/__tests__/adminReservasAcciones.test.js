// Panel de reservas: las acciones sobre una reserva, POST /api/admin/reservas/:id/:accion
// (docs/reservas-diseno.md, 8.3, 8.4 y 8.6; bloque R-d, commit 14). Cada acción con su caso normal,
// los 409 de un estado que no la admite, los choques en el calendario (que dicen con qué chocan, sin
// datos del otro cliente), el estado de la pieza mientras no lo derive el calendario (3.3) y los
// movimientos de dinero idempotentes del 8.6. Supabase y Stripe son dobles.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const {
  MENSAJE_REEMBOLSO_EN_CURSO,
  MENSAJE_REEMBOLSO_A_MEDIAS,
  MENSAJE_REINTENTO_FALLIDO,
  claveDeReembolso
} = require('../utils/adminReservas');
const { hoyEnMadrid, sumarDias, fechaLegible } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const ANA = uuid(900);
const LUIS = uuid(901);
const RESERVA = uuid(101);
const SIGUIENTE = uuid(102);
const PEDIDO_SIGUIENTE = 'c0ffee00-0000-4000-8000-000000000002';

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const MUEBLES = (estado = 'disponible') => [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado }
];
const CONTACTO_LUIS = {
  nombre: 'Luis Pérez',
  email: 'luis@ejemplo.com',
  telefono: '611222333',
  direccion: 'Avinguda Diagonal 1, Barcelona',
  notas: null
};
const ENTREGADA_EN = '2026-01-01T10:00:00.000Z';

const alquiler = (cambios = {}) => ({
  id: RESERVA,
  mueble_id: SOFA,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: hoy,
  hora_entrega: '10:00:00',
  fecha_fin: dia(3),
  hora_recogida: '10:00:00',
  fin_ocupacion: dia(3),
  dias_margen: 2,
  cliente_id: ANA,
  modo_entrega: 'tienda',
  modo_devolucion: 'tienda',
  datos_contacto: { nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456' },
  importe_total: 120.5,
  stripe_payment_intent_id: 'pi_123',
  historial: [{ fecha: '2026-10-01T10:00:00.000Z', tipo: 'creada', por: 'cliente' }],
  created_at: '2026-10-01T10:00:00.000Z',
  ...cambios
});
// La reserva de otro cliente que va justo después, con su margen ya respetado.
const siguiente = (cambios = {}) =>
  alquiler({
    id: SIGUIENTE,
    pedido_id: PEDIDO_SIGUIENTE,
    cliente_id: LUIS,
    datos_contacto: CONTACTO_LUIS,
    direccion_entrega: CONTACTO_LUIS.direccion,
    ...cambios
  });
const enCurso = (cambios = {}) =>
  alquiler({ estado: 'en_curso', fecha_inicio: dia(-3), entregada_en: ENTREGADA_EN, ...cambios });
const bloqueo = (cambios = {}) => ({
  id: uuid(201),
  mueble_id: SOFA,
  tipo: 'bloqueo',
  estado: 'confirmada',
  origen: 'manual',
  fecha_inicio: dia(20),
  fecha_fin: dia(25),
  fin_ocupacion: dia(25),
  dias_margen: 0,
  motivo: 'Mantenimiento',
  historial: [],
  ...cambios
});
const venta = (cambios = {}) => ({
  id: uuid(301),
  mueble_id: SOFA,
  tipo: 'venta',
  estado: 'confirmada',
  origen: 'manual',
  fecha_inicio: dia(-3),
  dias_margen: 0,
  historial: [],
  ...cambios
});

let fake;
const instalar = ({ reservas = [], muebles = MUEBLES() } = {}) => {
  fake = crearFakeSupabase({ muebles, reservas });
  mock.method(supabase, 'from', fake.from);
};

let stripe;
let registroErrores;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  registroErrores = mock.method(console, 'error', () => {});
  stripe = {
    refunds: {
      create: mock.fn(async () => ({ id: 're_1', status: 'succeeded' })),
      list: mock.fn(async () => ({ data: [], has_more: false }))
    },
    // Lo cobrado en el pago de la reserva (el importe_total de alquiler(), 120,50 €).
    paymentIntents: {
      retrieve: mock.fn(async (id) => ({ id, amount_received: 12050, status: 'succeeded' }))
    }
  };
  mock.method(stripeUtil, 'getStripe', () => stripe);
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

const accion = (id, nombre, cuerpo = {}) =>
  request(app)
    .post(`/api/admin/reservas/${id}/${nombre}`)
    .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
    .send(cuerpo);
const fila = (id = RESERVA) => fake.tablas.reservas.find((r) => r.id === id);
const estadoPieza = () => fake.tablas.muebles.find((m) => m.id === SOFA).estado;
const ultimaLinea = (id = RESERVA) => fila(id).historial.at(-1);
const escriturasDe = (tabla) => fake.escrituras.filter((e) => e.tabla === tabla);
// El texto de un 409 no puede llevar nada del otro cliente.
const sinDatosDeLuis = (texto) => {
  for (const dato of [CONTACTO_LUIS.nombre, 'Luis', CONTACTO_LUIS.email, CONTACTO_LUIS.telefono]) {
    assert.ok(!texto.includes(dato), `el mensaje no debe llevar "${dato}": ${texto}`);
  }
  assert.ok(!/reservas_sin_solape|conflicting key|Key \(/.test(texto), texto);
};

describe('la ruta de las acciones', () => {
  test('un id que no es un uuid: 404 sin tocar la base de datos', async () => {
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    const res = await accion('r-1', 'entregar');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Reserva no encontrada.' });
    assert.equal(from.mock.callCount(), 0);
  });

  test('una acción que no existe: 404', async () => {
    const res = await accion(RESERVA, 'borrar');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Esa acción no existe.' });
  });

  test('los nombres que hereda cualquier objeto de JavaScript tampoco son acciones (404)', async () => {
    instalar({ reservas: [alquiler()] });
    for (const nombre of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      const res = await accion(RESERVA, nombre);
      assert.equal(res.status, 404, nombre);
      assert.deepEqual(res.body, { error: 'Esa acción no existe.' });
    }
    assert.equal(fake.escrituras.length, 0);
  });

  test('un cuerpo JSON que no es un objeto: 400 en castellano, sin el texto de Zod', async () => {
    instalar({ reservas: [enCurso()] });
    for (const [nombre, cuerpo] of [
      ['recoger', '[]'],
      ['entregar', '[true]'],
      ['cancelar', '[{"motivo":"x","reembolso_centimos":0}]']
    ]) {
      const res = await request(app)
        .post(`/api/admin/reservas/${RESERVA}/${nombre}`)
        .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
        .set('Content-Type', 'application/json')
        .send(cuerpo);
      assert.equal(res.status, 400, nombre);
      assert.deepEqual(res.body, { error: 'Los datos tienen que ir en un objeto JSON.' });
    }
    const texto = await request(app)
      .post(`/api/admin/reservas/${RESERVA}/recoger`)
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
      .set('Content-Type', 'application/json')
      .send('"hoy"');
    assert.equal(texto.status, 400);
    assert.deepEqual(texto.body, { error: 'El cuerpo de la petición no es un JSON válido.' });
    assert.equal(fake.escrituras.length, 0);
  });

  test('una reserva que no existe: 404', async () => {
    const res = await accion(uuid(999), 'entregar');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Reserva no encontrada.' });
  });

  test('el cuerpo se valida por acción: 400 con el mensaje en castellano', async () => {
    instalar({ reservas: [alquiler()] });
    const casos = [
      ['ampliar', {}, 'Elige la nueva fecha de recogida (AAAA-MM-DD).'],
      [
        'ampliar',
        { fin_ocupacion: '2026-02-30' },
        'Elige la nueva fecha de recogida (AAAA-MM-DD).'
      ],
      ['cancelar', { reembolso_centimos: 0 }, 'Escribe el motivo de la cancelación.'],
      [
        'cancelar',
        { motivo: '   ', reembolso_centimos: 0 },
        'Escribe el motivo de la cancelación.'
      ],
      [
        'cancelar',
        { motivo: 'x'.repeat(501), reembolso_centimos: 0 },
        'El motivo es demasiado largo (máximo 500 caracteres).'
      ],
      [
        'cancelar',
        { motivo: 'Avería' },
        'Indica el reembolso en céntimos (0 si no se devuelve nada).'
      ],
      [
        'cancelar',
        { motivo: 'Avería', reembolso_centimos: 10.5 },
        'El reembolso tiene que ser un número entero de céntimos.'
      ],
      [
        'cancelar',
        { motivo: 'Avería', reembolso_centimos: -1 },
        'El reembolso no puede ser negativo.'
      ],
      [
        'entregar',
        { antes_de_tiempo: 'sí' },
        'Indica si la entregas antes de tiempo (true o false).'
      ]
    ];
    for (const [nombre, cuerpo, mensaje] of casos) {
      const res = await accion(RESERVA, nombre, cuerpo);
      assert.equal(res.status, 400, `${nombre} ${JSON.stringify(cuerpo)}`);
      assert.deepEqual(res.body, { error: mensaje });
    }
    assert.equal(fake.escrituras.length, 0);
  });

  test('si falla la base de datos: 500 genérico, sin el detalle', async () => {
    instalar({ reservas: [alquiler()] });
    fake.fallos['reservas.update'] = { message: 'conexión perdida con 10.0.0.3' };
    const res = await accion(RESERVA, 'entregar');
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      error: 'Error interno al guardar. Recarga la lista de reservas para ver cómo ha quedado.'
    });
    assert.ok(registroErrores.mock.calls.length > 0);
  });
});

describe('entregar', () => {
  test('un alquiler confirmado para hoy: en curso, con la hora de entrega y su línea del historial', async () => {
    instalar({ reservas: [alquiler()] });

    const res = await accion(RESERVA, 'entregar');

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.estado, 'en_curso');
    assert.equal(res.body.reserva.etiqueta, 'Entregada');
    assert.deepEqual(res.body.reserva.acciones, ['recoger', 'ampliar']);
    assert.ok(res.body.reserva.entregada_en);
    assert.equal(fila().estado, 'en_curso');
    assert.equal(fila().entregada_en, res.body.reserva.entregada_en);
    const linea = ultimaLinea();
    assert.equal(linea.tipo, 'entregada');
    assert.equal(linea.detalle, 'Entregada.');
    assert.equal(linea.por, 'admin');
    assert.ok(!Number.isNaN(Date.parse(linea.fecha)));
    assert.equal(fila().historial.length, 2);
  });

  test('la pieza pasa de disponible a alquilada', async () => {
    instalar({ reservas: [alquiler()] });
    await accion(RESERVA, 'entregar');
    assert.equal(estadoPieza(), 'alquilado');
  });

  test('nunca pisa un estado puesto a mano: una pieza marcada vendida sigue vendida', async () => {
    instalar({ reservas: [alquiler()], muebles: MUEBLES('vendido') });
    assert.equal((await accion(RESERVA, 'entregar')).status, 200);
    assert.equal(estadoPieza(), 'vendido');
  });

  test('una entrega atrasada (la fecha ya pasó) se puede marcar', async () => {
    instalar({ reservas: [alquiler({ fecha_inicio: dia(-2) })] });
    assert.equal((await accion(RESERVA, 'entregar')).status, 200);
  });

  test('antes de la fecha prevista: 409 con el código entrega_anticipada, y no cambia nada', async () => {
    instalar({ reservas: [alquiler({ fecha_inicio: dia(2), fecha_fin: dia(5) })] });

    const res = await accion(RESERVA, 'entregar');

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: `La entrega está prevista para el ${fechaLegible(dia(2))}. ¿Seguro que la entregas antes?`,
      codigo: 'entrega_anticipada'
    });
    assert.equal(fila().estado, 'confirmada');
    assert.equal(estadoPieza(), 'disponible');
  });

  test('antes de la fecha prevista con antes_de_tiempo: ocupa desde hoy y el historial guarda la fecha prevista', async () => {
    instalar({
      reservas: [alquiler({ fecha_inicio: dia(2), fecha_fin: dia(5), fin_ocupacion: dia(5) })]
    });
    const res = await accion(RESERVA, 'entregar', { antes_de_tiempo: true });
    assert.equal(res.status, 200);
    assert.equal(fila().estado, 'en_curso');
    assert.equal(fila().fecha_inicio, hoy);
    assert.equal(fila().rango_ocupado, `[${hoy},${dia(7)})`);
    assert.equal(res.body.reserva.fecha_inicio, hoy);
    assert.equal(
      ultimaLinea().detalle,
      `Entregada antes de la fecha prevista (${fechaLegible(dia(2))}): ocupa el calendario desde hoy.`
    );
  });

  test('entregada antes de tiempo, los días de antes de la fecha prevista ya no se pueden reservar', async () => {
    instalar({
      reservas: [alquiler({ fecha_inicio: dia(6), fecha_fin: dia(9), fin_ocupacion: dia(9) })]
    });
    assert.equal((await accion(RESERVA, 'entregar', { antes_de_tiempo: true })).status, 200);
    const { error } = await fake
      .from('reservas')
      .insert(
        bloqueo({ id: uuid(555), fecha_inicio: dia(2), fecha_fin: dia(4), fin_ocupacion: dia(4) })
      );
    assert.equal(error?.code, '23P01');
  });

  test('entregada antes de tiempo, se puede recoger cuando vuelva (sin rangos imposibles)', async () => {
    instalar({
      reservas: [alquiler({ fecha_inicio: dia(6), fecha_fin: dia(9), fin_ocupacion: dia(9) })]
    });
    assert.equal((await accion(RESERVA, 'entregar', { antes_de_tiempo: true })).status, 200);
    const res = await accion(RESERVA, 'recoger');
    assert.equal(res.status, 200);
    assert.equal(fila().estado, 'devuelta');
    assert.equal(fila().rango_ocupado, `[${hoy},${dia(2)})`);
  });

  test('si entregarla hoy choca con lo que va antes: 409 que lo nombra, y no cambia nada', async () => {
    instalar({
      reservas: [
        alquiler({ fecha_inicio: dia(5), fecha_fin: dia(8), fin_ocupacion: dia(8) }),
        bloqueo({ fecha_inicio: dia(-1), fecha_fin: dia(2), fin_ocupacion: dia(2) })
      ]
    });

    const res = await accion(RESERVA, 'entregar', { antes_de_tiempo: true });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: `Entregarla hoy choca con el bloqueo #00000000 (del ${fechaLegible(dia(-1))} al ${fechaLegible(dia(2))}).`
    });
    assert.equal(fila().estado, 'confirmada');
    assert.equal(fila().fecha_inicio, dia(5));
    assert.equal(estadoPieza(), 'disponible');
  });

  test('el doble, como Postgres: un rango con el fin antes del principio es un 22000 y no escribe', async () => {
    instalar({
      reservas: [enCurso({ fecha_inicio: dia(6), fecha_fin: dia(9), fin_ocupacion: dia(9) })]
    });
    const { data, error } = await fake
      .from('reservas')
      .update({ estado: 'devuelta', devuelta_en: new Date().toISOString() })
      .eq('id', RESERVA)
      .select('id');
    assert.equal(data, null);
    assert.deepEqual(error, {
      code: '22000',
      message: 'range lower bound must be less than or equal to range upper bound'
    });
    assert.equal(fila().estado, 'en_curso');
    // Acabar (margen incluido) el mismo día que empieza no es un error: es un rango vacío.
    const vacio = await fake
      .from('reservas')
      .update({ estado: 'devuelta', devuelta_en: `${dia(4)}T10:00:00.000Z` })
      .eq('id', RESERVA);
    assert.equal(vacio.error, null);
    assert.equal(fila().rango_ocupado, 'empty');
  });

  test('en otro estado: 409 con el motivo, y no cambia nada', async () => {
    const casos = [
      [enCurso(), 'Este alquiler ya está marcado como entregado.'],
      [alquiler({ estado: 'cancelada' }), 'Esta reserva ya está cancelada.'],
      [
        alquiler({ estado: 'expirada', conflicto_en: '2026-10-10T10:00:00.000Z' }),
        'Esta reserva no se pudo confirmar: el reembolso se hace desde el Dashboard de Stripe.'
      ],
      [
        alquiler({ estado: 'pendiente', expira_en: new Date(Date.now() + 60_000).toISOString() }),
        'Solo se puede marcar como entregado un alquiler confirmado.'
      ],
      [
        alquiler({ estado: 'devuelta', entregada_en: ENTREGADA_EN, devuelta_en: ENTREGADA_EN }),
        'Solo se puede marcar como entregado un alquiler confirmado.'
      ],
      [
        bloqueo({ id: RESERVA, fecha_inicio: hoy }),
        'Solo se puede marcar como entregado un alquiler confirmado.'
      ],
      [venta({ id: RESERVA }), 'Solo se puede marcar como entregado un alquiler confirmado.']
    ];
    for (const [reserva, mensaje] of casos) {
      instalar({ reservas: [reserva] });
      const res = await accion(RESERVA, 'entregar', { antes_de_tiempo: true });
      assert.equal(res.status, 409, `${reserva.tipo} ${reserva.estado}`);
      assert.deepEqual(res.body, { error: mensaje });
      assert.equal(escriturasDe('reservas').length, 0);
      assert.equal(estadoPieza(), 'disponible');
    }
  });

  test('dos clics a la vez: uno entrega y el otro recibe 409', async () => {
    instalar({ reservas: [alquiler()] });
    const respuestas = await Promise.all([
      accion(RESERVA, 'entregar'),
      accion(RESERVA, 'entregar')
    ]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
    assert.equal(fila().historial.filter((h) => h.tipo === 'entregada').length, 1);
  });

  test('si falla el cambio de la pieza, la entrega queda hecha: 200 y el fallo al log', async () => {
    instalar({ reservas: [alquiler()] });
    fake.fallos['muebles.update'] = { message: 'conexión perdida' };
    const res = await accion(RESERVA, 'entregar');
    assert.equal(res.status, 200);
    assert.equal(fila().estado, 'en_curso');
    assert.ok(
      registroErrores.mock.calls.some((c) => /No se pudo poner la pieza/.test(c.arguments[0]))
    );
  });
});

describe('recoger', () => {
  test('a tiempo: devuelta, con su hora, y fin_ocupacion pasa a hoy (el disparador de R2)', async () => {
    instalar({ reservas: [enCurso({ fecha_fin: hoy, fin_ocupacion: hoy })] });

    const res = await accion(RESERVA, 'recoger');

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.estado, 'devuelta');
    assert.equal(res.body.reserva.etiqueta, 'Devuelta');
    assert.deepEqual(res.body.reserva.acciones, []);
    assert.ok(res.body.reserva.devuelta_en);
    assert.equal(fila().fin_ocupacion, hoy);
    assert.equal(fila().rango_ocupado, `[${dia(-3)},${dia(2)})`);
    assert.equal(ultimaLinea().tipo, 'recogida');
    assert.equal(ultimaLinea().detalle, 'Recogida.');
    assert.equal(ultimaLinea().por, 'admin');
  });

  test('antes de tiempo: libera los días sobrantes (menos el margen)', async () => {
    instalar({ reservas: [enCurso({ fecha_fin: dia(4), fin_ocupacion: dia(4) })] });
    assert.equal((await accion(RESERVA, 'recoger')).status, 200);
    assert.equal(fila().fin_ocupacion, hoy);
  });

  test('tarde y sin nada detrás: se recoge, con los días de retraso en el historial', async () => {
    instalar({
      reservas: [enCurso({ fecha_inicio: dia(-6), fecha_fin: dia(-3), fin_ocupacion: dia(-3) })]
    });
    const res = await accion(RESERVA, 'recoger');
    assert.equal(res.status, 200);
    assert.equal(ultimaLinea().detalle, 'Recogida con 3 días de retraso.');
    assert.equal(fila().fin_ocupacion, hoy);
  });

  test('la pieza pasa de alquilada a disponible', async () => {
    instalar({ reservas: [enCurso()], muebles: MUEBLES('alquilado') });
    await accion(RESERVA, 'recoger');
    assert.equal(estadoPieza(), 'disponible');
  });

  test('nunca pisa un estado puesto a mano: una pieza marcada vendida sigue vendida', async () => {
    instalar({ reservas: [enCurso()], muebles: MUEBLES('vendido') });
    assert.equal((await accion(RESERVA, 'recoger')).status, 200);
    assert.equal(estadoPieza(), 'vendido');
  });

  test('tarde, y el margen alcanza a la reserva siguiente: se recoge igual, con el margen que queda y un aviso', async () => {
    // Ocupaba hasta ayer (fin hace 3 días + 2 de margen); la siguiente empieza mañana. Devuelta hoy,
    // con su margen ocuparía hasta pasado mañana: le queda 1 día.
    instalar({
      reservas: [
        enCurso({ fecha_inicio: dia(-6), fecha_fin: dia(-3), fin_ocupacion: dia(-3) }),
        siguiente({ fecha_inicio: dia(1), fecha_fin: dia(4), fin_ocupacion: dia(4) })
      ],
      muebles: MUEBLES('alquilado')
    });

    const res = await accion(RESERVA, 'recoger');

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['aviso', 'reserva']);
    assert.equal(
      res.body.aviso,
      `La pieza ha vuelto tarde: hasta el alquiler #C0FFEE00 del ${fechaLegible(dia(1))} solo ` +
        'queda 1 día de margen.'
    );
    sinDatosDeLuis(res.body.aviso);
    assert.equal(res.body.reserva.estado, 'devuelta');
    assert.equal(res.body.reserva.dias_margen, 1);
    assert.equal(fila().estado, 'devuelta');
    assert.equal(fila().fin_ocupacion, hoy);
    assert.equal(fila().dias_margen, 1);
    assert.equal(fila().rango_ocupado, `[${dia(-6)},${dia(1)})`);
    assert.equal(
      ultimaLinea().detalle,
      `Recogida con 3 días de retraso. Margen recortado de 2 días a 1 día por el alquiler ` +
        `#C0FFEE00 del ${fechaLegible(dia(1))}.`
    );
    assert.equal(fila(SIGUIENTE).estado, 'confirmada', 'la siguiente no se toca');
    assert.equal(estadoPieza(), 'disponible');
  });

  test('el aviso cuenta los días que quedan, o que no queda margen', async () => {
    const casos = [
      // [margen, días hasta la siguiente, aviso]
      [3, 2, 'solo quedan 2 días de margen.'],
      [2, 0, 'no queda margen.']
    ];
    for (const [margen, hasta, final] of casos) {
      instalar({
        reservas: [
          enCurso({
            fecha_inicio: dia(-8),
            fecha_fin: dia(-3 - margen),
            fin_ocupacion: dia(-3 - margen),
            dias_margen: margen
          }),
          bloqueo({
            fecha_inicio: dia(hasta),
            fecha_fin: dia(hasta + 2),
            fin_ocupacion: dia(hasta + 2)
          })
        ]
      });
      const res = await accion(RESERVA, 'recoger');
      assert.equal(res.status, 200, `margen ${margen}`);
      assert.equal(
        res.body.aviso,
        `La pieza ha vuelto tarde: hasta el bloqueo #00000000 del ${fechaLegible(dia(hasta))} ${final}`
      );
      assert.equal(fila().dias_margen, hasta);
      assert.match(
        ultimaLinea().detalle,
        new RegExp(
          `Margen recortado de ${margen} días a ${hasta === 1 ? '1 día' : `${hasta} días`} `
        )
      );
    }
  });

  test('si volvió cuando la siguiente ya había empezado: 409 que la nombra, sin sus datos ni acciones que no hay, y nada cambia', async () => {
    instalar({
      reservas: [
        enCurso({ fecha_inicio: dia(-8), fecha_fin: dia(-5), fin_ocupacion: dia(-5) }),
        siguiente({ fecha_inicio: dia(-2), fecha_fin: dia(1), fin_ocupacion: dia(1) })
      ],
      muebles: MUEBLES('alquilado')
    });

    const res = await accion(RESERVA, 'recoger');

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `La pieza volvió el ${fechaLegible(hoy)}, cuando ya había empezado el alquiler #C0FFEE00 ` +
        `(del ${fechaLegible(dia(-2))} al ${fechaLegible(dia(1))}, más 2 días de margen): no se ` +
        'puede apuntar esa recogida.'
    });
    sinDatosDeLuis(res.body.error);
    assert.ok(!/mueva|mover/.test(res.body.error));
    assert.equal(fila().estado, 'en_curso');
    assert.equal(fila().fin_ocupacion, dia(-5));
    assert.equal(fila().dias_margen, 2);
    assert.equal(estadoPieza(), 'alquilado');

    // Si en realidad volvió antes de que empezara la siguiente, con su fecha entra.
    const antes = await accion(RESERVA, 'recoger', { fecha_recogida: dia(-3) });
    assert.equal(antes.status, 200);
    assert.equal(fila().fin_ocupacion, dia(-3));
    assert.equal(fila().dias_margen, 1);
  });

  test('una ventana que se cierra entre medias: se vuelve a mirar y se recorta otra vez', async () => {
    instalar({
      reservas: [
        enCurso({
          fecha_inicio: dia(-6),
          fecha_fin: dia(-3),
          fin_ocupacion: dia(-3),
          dias_margen: 3
        }),
        siguiente({ fecha_inicio: dia(2), fecha_fin: dia(4), fin_ocupacion: dia(4) })
      ]
    });
    // Justo después de buscar con qué chocaba (la siguiente, pasado mañana), alguien bloquea
    // mañana: el margen recortado a 2 días vuelve a chocar.
    let busquedas = 0;
    const deEsteTest = fake;
    deEsteTest.fallos['reservas.select'] = (consulta) => {
      if (consulta.usa.has('overlaps') && ++busquedas === 1) {
        setImmediate(() =>
          deEsteTest.tablas.reservas.push({
            ...bloqueo({
              id: uuid(777),
              fecha_inicio: dia(1),
              fecha_fin: dia(2),
              fin_ocupacion: dia(2)
            }),
            rango_ocupado: `[${dia(1)},${dia(2)})`
          })
        );
      }
      return null;
    };

    const res = await accion(RESERVA, 'recoger');

    assert.equal(busquedas, 2);

    assert.equal(res.status, 200);
    assert.equal(fila().dias_margen, 1);
    assert.match(res.body.aviso, /hasta el bloqueo #00000000 del .* solo queda 1 día de margen\.$/);
  });

  test('una provisional caducada en el camino no cuenta: se limpia antes (4.6) y se recoge', async () => {
    instalar({
      reservas: [
        enCurso({ fecha_inicio: dia(-6), fecha_fin: dia(-3), fin_ocupacion: dia(-3) }),
        siguiente({
          estado: 'pendiente',
          pedido_id: null,
          fecha_inicio: dia(1),
          expira_en: new Date(Date.now() - 60_000).toISOString()
        })
      ]
    });
    assert.equal((await accion(RESERVA, 'recoger')).status, 200);
    assert.equal(fila(SIGUIENTE).estado, 'expirada');
  });

  test('en otro estado: 409', async () => {
    instalar({ reservas: [alquiler()] });
    assert.deepEqual((await accion(RESERVA, 'recoger')).body, {
      error: 'Solo se puede marcar como recogido un alquiler entregado.'
    });
    instalar({
      reservas: [enCurso({ estado: 'devuelta', devuelta_en: ENTREGADA_EN })]
    });
    assert.deepEqual((await accion(RESERVA, 'recoger')).body, {
      error: 'Este alquiler ya está marcado como recogido.'
    });
  });

  describe('con fecha_recogida (se apunta otro día)', () => {
    const horaEnMadrid = (instante) =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date(instante));

    test('un día pasado: devuelta ese día a las 12:00 de Madrid, y el historial lo dice', async () => {
      instalar({
        reservas: [enCurso({ fecha_inicio: dia(-6), fecha_fin: dia(-3), fin_ocupacion: dia(-3) })]
      });

      const res = await accion(RESERVA, 'recoger', { fecha_recogida: dia(-4) });

      assert.equal(res.status, 200);
      assert.deepEqual(Object.keys(res.body), ['reserva']);
      assert.equal(hoyEnMadrid(new Date(fila().devuelta_en)), dia(-4));
      assert.equal(horaEnMadrid(fila().devuelta_en), '12:00');
      assert.equal(res.body.reserva.devuelta_en, fila().devuelta_en);
      assert.equal(fila().fin_ocupacion, dia(-4));
      assert.equal(ultimaLinea().detalle, `Recogida el ${fechaLegible(dia(-4))}.`);
    });

    test('tarde y otro día: el retraso se cuenta hasta ese día', async () => {
      instalar({
        reservas: [enCurso({ fecha_inicio: dia(-9), fecha_fin: dia(-6), fin_ocupacion: dia(-6) })]
      });
      assert.equal((await accion(RESERVA, 'recoger', { fecha_recogida: dia(-2) })).status, 200);
      assert.equal(
        ultimaLinea().detalle,
        `Recogida el ${fechaLegible(dia(-2))}, con 4 días de retraso.`
      );
    });

    test('hoy es lo mismo que no mandarla: devuelta ahora', async () => {
      instalar({ reservas: [enCurso()] });
      const antes = Date.now();
      assert.equal((await accion(RESERVA, 'recoger', { fecha_recogida: hoy })).status, 200);
      const devuelta = Date.parse(fila().devuelta_en);
      assert.ok(devuelta >= antes && devuelta <= Date.now(), fila().devuelta_en);
      assert.equal(ultimaLinea().detalle, 'Recogida.');
    });

    test('ni después de hoy ni antes de la entrega (400), y sin escribir', async () => {
      instalar({
        reservas: [
          enCurso({
            fecha_inicio: dia(-6),
            entregada_en: new Date(Date.now() - 5 * 86_400_000).toISOString()
          })
        ]
      });
      const entrega = hoyEnMadrid(new Date(fila().entregada_en));
      assert.deepEqual((await accion(RESERVA, 'recoger', { fecha_recogida: dia(1) })).body, {
        error: 'La fecha de recogida no puede ser posterior a hoy.'
      });
      assert.deepEqual(
        (await accion(RESERVA, 'recoger', { fecha_recogida: sumarDias(entrega, -1) })).body,
        {
          error: `La fecha de recogida no puede ser anterior a la entrega (${fechaLegible(entrega)}).`
        }
      );
      assert.equal((await accion(RESERVA, 'recoger', { fecha_recogida: entrega })).status, 200);
    });

    test('la forma: 400 con su mensaje', async () => {
      instalar({ reservas: [enCurso()] });
      for (const fecha of ['2026-02-30', '19/10/2026', 20261019, null]) {
        const res = await accion(RESERVA, 'recoger', { fecha_recogida: fecha });
        assert.equal(res.status, 400, String(fecha));
        assert.deepEqual(res.body, { error: 'Elige la fecha de recogida (AAAA-MM-DD).' });
      }
      assert.equal(escriturasDe('reservas').length, 0);
    });
  });
});

describe('ampliar', () => {
  const retrasada = () =>
    enCurso({ fecha_inicio: dia(-6), fecha_fin: dia(-1), fin_ocupacion: dia(-1) });

  test('un retraso: la nueva recogida prevista ocupa el calendario, con su línea', async () => {
    instalar({ reservas: [retrasada()] });

    const res = await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(2) });

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.fin_ocupacion, dia(2));
    assert.equal(res.body.reserva.etiqueta, 'Retrasada', 'sigue retrasada respecto a lo pactado');
    assert.equal(fila().rango_ocupado, `[${dia(-6)},${dia(4)})`);
    assert.equal(ultimaLinea().tipo, 'ampliada');
    assert.equal(
      ultimaLinea().detalle,
      `Recogida prevista para el ${fechaLegible(dia(2))} (antes, el ${fechaLegible(dia(-1))}).`
    );
  });

  test('antes de la recogida pactada o antes de hoy: 400', async () => {
    instalar({ reservas: [enCurso({ fecha_fin: dia(3), fin_ocupacion: dia(3) })] });
    assert.deepEqual((await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(2) })).body, {
      error: `La nueva fecha no puede ser anterior a la recogida pactada (${fechaLegible(dia(3))}).`
    });
    instalar({ reservas: [retrasada()] });
    assert.deepEqual((await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(-1) })).body, {
      error: 'La nueva fecha no puede ser anterior a hoy.'
    });
    assert.equal(escriturasDe('reservas').length, 0);
  });

  test('si alcanza a la reserva siguiente: 409 que la nombra y pide avisar a ese cliente', async () => {
    instalar({
      reservas: [
        retrasada(),
        siguiente({ fecha_inicio: dia(3), fecha_fin: dia(6), fin_ocupacion: dia(6) })
      ]
    });

    const res = await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(2) });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `La nueva fecha choca con el alquiler #C0FFEE00 (del ${fechaLegible(dia(3))} al ` +
        `${fechaLegible(dia(6))}, más 2 días de margen): avisa a ese cliente antes de ampliar.`
    });
    sinDatosDeLuis(res.body.error);
    assert.equal(fila().fin_ocupacion, dia(-1));
  });

  test('con un bloqueo o una venta detrás, el consejo cambia', async () => {
    instalar({ reservas: [retrasada(), bloqueo({ fecha_inicio: dia(2) })] });
    assert.match(
      (await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(2) })).body.error,
      /choca con el bloqueo #00000000 .*: levanta ese bloqueo antes de ampliar\.$/
    );
    instalar({ reservas: [retrasada(), venta({ fecha_inicio: dia(2) })] });
    assert.match(
      (await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(2) })).body.error,
      new RegExp(
        `choca con la venta #00000000 \\(desde el ${fechaLegible(dia(2))}\\): avisa a ese comprador antes de ampliar\\.$`
      )
    );
  });

  test('una provisional caducada en el camino no cuenta (4.6)', async () => {
    instalar({
      reservas: [
        retrasada(),
        siguiente({
          estado: 'pendiente',
          pedido_id: null,
          fecha_inicio: dia(2),
          expira_en: new Date(Date.now() - 60_000).toISOString()
        })
      ]
    });
    assert.equal((await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(2) })).status, 200);
  });

  test('solo un alquiler entregado: 409 en otro estado', async () => {
    instalar({ reservas: [alquiler()] });
    assert.deepEqual((await accion(RESERVA, 'ampliar', { fin_ocupacion: dia(5) })).body, {
      error: 'Solo se puede ampliar un alquiler entregado que todavía no se ha recogido.'
    });
  });
});

describe('cancelar (8.4, política manual)', () => {
  const cancelar = (cuerpo, id = RESERVA) => accion(id, 'cancelar', cuerpo);

  test('un alquiler pagado, con reembolso: cancela, reembolsa en Stripe una vez y guarda el id', async () => {
    instalar({ reservas: [alquiler()] });

    const res = await cancelar({ motivo: '  El cliente no puede  ', reembolso_centimos: 6025 });

    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    const [datos, opciones] = stripe.refunds.create.mock.calls[0].arguments;
    assert.deepEqual(datos, {
      payment_intent: 'pi_123',
      amount: 6025,
      metadata: { reserva_id: RESERVA, tipo: 'reembolso_cancelacion' }
    });
    assert.deepEqual(opciones, { idempotencyKey: `reserva_${RESERVA}_reembolso_cancelacion` });
    assert.equal(claveDeReembolso(RESERVA), `reserva_${RESERVA}_reembolso_cancelacion`);

    const guardada = fila();
    assert.equal(guardada.estado, 'cancelada');
    assert.equal(guardada.cancelada_por, 'admin');
    assert.ok(guardada.cancelada_en);
    assert.equal(guardada.motivo_cancelacion, 'El cliente no puede');
    assert.equal(guardada.reembolso_importe, 60.25);
    assert.ok(guardada.reembolso_solicitado_en);
    assert.equal(guardada.stripe_refund_id, 're_1');
    assert.deepEqual(
      guardada.historial.map((h) => [h.tipo, h.detalle, h.por]),
      [
        ['creada', undefined, 'cliente'],
        ['cancelada', 'Motivo: El cliente no puede. Reembolso pedido: 60,25 €.', 'admin'],
        ['reembolso', 'Reembolso de 60,25 € hecho en Stripe (re_1).', 'admin']
      ]
    );

    assert.equal(res.body.reserva.etiqueta, 'Cancelada');
    assert.deepEqual(res.body.reserva.acciones, []);
    assert.equal(res.body.reserva.reembolso_a_medias, false);
    assert.deepEqual(res.body.reserva.reembolso, {
      solicitado_en: guardada.reembolso_solicitado_en,
      importe: 60.25,
      stripe_refund_id: 're_1'
    });
    assert.equal(res.body.reserva.motivo_cancelacion, 'El cliente no puede');
  });

  test('todo lo pagado se puede reembolsar, ni un céntimo más (400)', async () => {
    instalar({ reservas: [alquiler()] });
    const demasiado = await cancelar({ motivo: 'Avería', reembolso_centimos: 12051 });
    assert.equal(demasiado.status, 400);
    assert.deepEqual(demasiado.body, {
      error: 'El reembolso no puede pasar de lo pagado (120,50 €).'
    });
    assert.equal(fila().estado, 'confirmada');
    assert.equal(stripe.refunds.create.mock.callCount(), 0);

    assert.equal((await cancelar({ motivo: 'Avería', reembolso_centimos: 12050 })).status, 200);
    assert.equal(stripe.refunds.create.mock.calls[0].arguments[0].amount, 12050);
  });

  test('sin reembolso: cancela sin llamar a Stripe y sin marca de reembolso', async () => {
    instalar({ reservas: [alquiler()] });
    const res = await cancelar({ motivo: 'Lo pide el cliente', reembolso_centimos: 0 });
    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(fila().estado, 'cancelada');
    assert.equal(fila().reembolso_solicitado_en, undefined);
    assert.equal(ultimaLinea().detalle, 'Motivo: Lo pide el cliente. Sin reembolso.');
    assert.equal(res.body.reserva.reembolso, null);
    assert.equal(res.body.reserva.etiqueta, 'Cancelada');
  });

  test('cancelar libera las fechas: otra reserva puede ocuparlas', async () => {
    instalar({ reservas: [alquiler()] });
    await cancelar({ motivo: 'Avería', reembolso_centimos: 0 });
    const { error } = await fake
      .from('reservas')
      .insert(siguiente({ id: uuid(555), estado: 'confirmada' }));
    assert.equal(error, null);
  });

  test('un alquiler que no se pagó en la web: solo sin reembolso (400 si no)', async () => {
    instalar({
      reservas: [alquiler({ origen: 'manual', stripe_payment_intent_id: null, cliente_id: null })]
    });
    const res = await cancelar({ motivo: 'Avería', reembolso_centimos: 100 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error: 'Este alquiler no se pagó en la web: el reembolso, si lo hay, se hace a mano.'
    });
    assert.equal((await cancelar({ motivo: 'Avería', reembolso_centimos: 0 })).status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
  });

  test('una venta: solo sin reembolso (las compras se reembolsan en el Dashboard), y la pieza vuelve a estar disponible', async () => {
    instalar({ reservas: [venta({ id: RESERVA })], muebles: MUEBLES('vendido') });
    const conReembolso = await cancelar({ motivo: 'Devolución', reembolso_centimos: 100 });
    assert.equal(conReembolso.status, 400);
    assert.deepEqual(conReembolso.body, {
      error: 'Las compras se reembolsan desde el Dashboard de Stripe, como hasta ahora.'
    });
    assert.equal(estadoPieza(), 'vendido');

    const res = await cancelar({ motivo: 'Devolución', reembolso_centimos: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.etiqueta, 'Venta cancelada');
    assert.equal(fila().estado, 'cancelada');
    assert.equal(estadoPieza(), 'disponible');
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
  });

  test('cancelar una venta nunca pisa un estado puesto a mano: una pieza alquilada sigue alquilada', async () => {
    instalar({
      reservas: [venta({ id: RESERVA, fecha_inicio: dia(30) })],
      muebles: MUEBLES('alquilado')
    });
    assert.equal((await cancelar({ motivo: 'Se echa atrás', reembolso_centimos: 0 })).status, 200);
    assert.equal(estadoPieza(), 'alquilado');
  });

  test('cancelar un alquiler no toca la pieza', async () => {
    instalar({ reservas: [alquiler()], muebles: MUEBLES('alquilado') });
    await cancelar({ motivo: 'Avería', reembolso_centimos: 0 });
    assert.equal(escriturasDe('muebles').length, 0);
  });

  test('en otro estado: 409, y no se llama a Stripe', async () => {
    const casos = [
      [
        enCurso(),
        'Solo se puede cancelar un alquiler confirmado (antes de entregarlo) o una venta.'
      ],
      [alquiler({ estado: 'cancelada' }), 'Esta reserva ya está cancelada.'],
      [
        bloqueo({ id: RESERVA }),
        'Solo se puede cancelar un alquiler confirmado (antes de entregarlo) o una venta.'
      ],
      [
        alquiler({ conflicto_en: '2026-10-10T10:00:00.000Z', estado: 'expirada' }),
        'Esta reserva no se pudo confirmar: el reembolso se hace desde el Dashboard de Stripe.'
      ],
      [
        alquiler({
          estado: 'cancelada',
          reembolso_solicitado_en: '2026-10-10T10:00:00.000Z',
          reembolso_importe: 10
        }),
        MENSAJE_REEMBOLSO_EN_CURSO
      ]
    ];
    for (const [reserva, mensaje] of casos) {
      instalar({ reservas: [reserva] });
      const res = await cancelar({ motivo: 'Avería', reembolso_centimos: 0 });
      assert.equal(res.status, 409, `${reserva.tipo} ${reserva.estado}`);
      assert.deepEqual(res.body, { error: mensaje });
    }
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
  });

  test('8.6: dos cancelaciones a la vez: una sola llamada a Stripe y un 409', async () => {
    instalar({ reservas: [alquiler()] });
    // Stripe tarda un poco, para que la segunda llegue mientras la primera está reembolsando.
    stripe.refunds.create = mock.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { id: 're_1' };
    });

    const respuestas = await Promise.all([
      cancelar({ motivo: 'Avería', reembolso_centimos: 5000 }),
      cancelar({ motivo: 'Avería', reembolso_centimos: 5000 })
    ]);

    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
    const conflicto = respuestas.find((r) => r.status === 409);
    assert.deepEqual(conflicto.body, { error: MENSAJE_REEMBOLSO_EN_CURSO });
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    assert.equal(fila().stripe_refund_id, 're_1');
    assert.equal(fila().historial.filter((h) => h.tipo === 'cancelada').length, 1);
  });

  test('8.6: dos cancelaciones sin reembolso a la vez: una cancela y la otra recibe 409', async () => {
    instalar({ reservas: [alquiler()] });
    const respuestas = await Promise.all([
      cancelar({ motivo: 'A', reembolso_centimos: 0 }),
      cancelar({ motivo: 'B', reembolso_centimos: 0 })
    ]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
    assert.deepEqual(respuestas.find((r) => r.status === 409).body, {
      error: 'Esta reserva ya está cancelada.'
    });
  });

  test('8.6: con Stripe sin configurar, la reserva queda cancelada a medias: 502 con la reserva', async () => {
    instalar({ reservas: [alquiler()] });
    mock.method(stripeUtil, 'getStripe', () => null);

    const res = await cancelar({ motivo: 'Avería', reembolso_centimos: 5000 });

    assert.equal(res.status, 502);
    assert.equal(res.body.error, MENSAJE_REEMBOLSO_A_MEDIAS);
    assert.equal(
      MENSAJE_REEMBOLSO_A_MEDIAS,
      'La reserva está cancelada, pero el reembolso no se ha podido hacer. Usa «Reintentar reembolso».'
    );
    assert.equal(res.body.reserva.estado, 'cancelada');
    assert.equal(res.body.reserva.reembolso_a_medias, true);
    assert.equal(res.body.reserva.etiqueta, 'Cancelada · reembolso a medias');
    assert.deepEqual(res.body.reserva.acciones, ['reintentar-reembolso', 'dar-por-reembolsado']);
    assert.equal(fila().estado, 'cancelada');
    assert.ok(fila().reembolso_solicitado_en);
    assert.equal(fila().stripe_refund_id, undefined);
    assert.ok(registroErrores.mock.calls.some((c) => /\[ALERTA\]/.test(c.arguments[0])));
  });

  test('8.6: si Stripe falla al reembolsar, igual: 502 a medias, y sale en la vista de reembolsos', async () => {
    instalar({ reservas: [alquiler()] });
    stripe.refunds.create = mock.fn(async () => {
      throw new Error('Stripe no responde');
    });

    const res = await cancelar({ motivo: 'Avería', reembolso_centimos: 5000 });

    assert.equal(res.status, 502);
    assert.equal(res.body.reserva.reembolso_a_medias, true);
    const enLaLista = await request(app)
      .get('/api/admin/reservas?vista=reembolsos')
      .set('Authorization', `Bearer ${TOKEN_ADMIN}`);
    assert.deepEqual(
      enLaLista.body.reservas.map((r) => r.id),
      [RESERVA]
    );
  });

  test('8.6: un fallo entre reclamar y guardar, y «Reintentar» encuentra el reembolso en Stripe y no crea otro', async () => {
    instalar({ reservas: [alquiler()] });
    // Stripe hace el reembolso, pero guardar su id falla (o el proceso muere antes).
    const hechos = [];
    stripe.refunds.create = mock.fn(async (datos) => {
      const refund = { id: `re_${hechos.length + 1}`, metadata: datos.metadata };
      hechos.push(refund);
      return refund;
    });
    stripe.refunds.list = mock.fn(async () => ({ data: hechos, has_more: false }));
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.stripe_refund_id ? { message: 'conexión perdida' } : null;

    const primera = await cancelar({ motivo: 'Avería', reembolso_centimos: 5000 });
    assert.equal(primera.status, 502);
    assert.equal(primera.body.reserva.reembolso_a_medias, true);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);

    delete fake.fallos['reservas.update'];
    const reintento = await accion(RESERVA, 'reintentar-reembolso');

    assert.equal(reintento.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1, 'no se crea otro reembolso');
    assert.deepEqual(stripe.refunds.list.mock.calls[0].arguments[0], {
      payment_intent: 'pi_123',
      limit: 100
    });
    assert.equal(fila().stripe_refund_id, 're_1');
    assert.equal(reintento.body.reserva.reembolso_a_medias, false);
    assert.equal(reintento.body.reserva.etiqueta, 'Cancelada');
    assert.equal(fila().historial.filter((h) => h.tipo === 'reembolso').length, 1);
  });
});

describe('reintentar el reembolso (8.6, capa 3)', () => {
  const aMedias = (cambios = {}) =>
    alquiler({
      estado: 'cancelada',
      cancelada_por: 'admin',
      reembolso_solicitado_en: '2026-10-10T10:00:00.000Z',
      reembolso_importe: 50.1,
      ...cambios
    });

  test('si Stripe no lo tiene, lo crea con la misma clave y el importe reclamado', async () => {
    instalar({ reservas: [aMedias()] });
    // Un reembolso de otra cosa del mismo pago no cuenta.
    stripe.refunds.list = mock.fn(async () => ({
      data: [
        { id: 're_otro', metadata: { reserva_id: uuid(5), tipo: 'reembolso_cancelacion' } },
        { id: 're_fianza', metadata: { reserva_id: RESERVA, tipo: 'fianza' } }
      ]
    }));

    const res = await accion(RESERVA, 'reintentar-reembolso');

    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 1);
    const [datos, opciones] = stripe.refunds.create.mock.calls[0].arguments;
    assert.equal(datos.amount, 5010);
    assert.equal(datos.payment_intent, 'pi_123');
    assert.deepEqual(opciones, { idempotencyKey: `reserva_${RESERVA}_reembolso_cancelacion` });
    assert.equal(fila().stripe_refund_id, 're_1');
    assert.equal(ultimaLinea().detalle, 'Reembolso de 50,10 € hecho en Stripe (re_1).');
  });

  test('si Stripe lo tiene, guarda ese y no crea otro', async () => {
    instalar({ reservas: [aMedias()] });
    stripe.refunds.list = mock.fn(async () => ({
      data: [{ id: 're_9', metadata: { reserva_id: RESERVA, tipo: 'reembolso_cancelacion' } }]
    }));
    const res = await accion(RESERVA, 'reintentar-reembolso');
    assert.equal(res.status, 200);
    assert.equal(stripe.refunds.create.mock.callCount(), 0);
    assert.equal(fila().stripe_refund_id, 're_9');
  });

  test('dos reintentos a la vez: una sola línea de reembolso en el historial', async () => {
    instalar({ reservas: [aMedias()] });
    const respuestas = await Promise.all([
      accion(RESERVA, 'reintentar-reembolso'),
      accion(RESERVA, 'reintentar-reembolso')
    ]);
    // El segundo puede llegar cuando el primero ya lo guardó (409, ya no está a medias) o a la vez
    // (Stripe le devuelve el mismo reembolso por la clave de idempotencia y no se duplica nada).
    for (const res of respuestas) assert.ok([200, 409].includes(res.status), String(res.status));
    assert.equal(fila().stripe_refund_id, 're_1');
    assert.equal(fila().historial.filter((h) => h.tipo === 'reembolso').length, 1);
  });

  test('si Stripe sigue sin responder: 502 y sigue a medias', async () => {
    instalar({ reservas: [aMedias()] });
    stripe.refunds.list = mock.fn(async () => {
      throw new Error('Stripe no responde');
    });
    const res = await accion(RESERVA, 'reintentar-reembolso');
    assert.equal(res.status, 502);
    assert.deepEqual(res.body.error, MENSAJE_REINTENTO_FALLIDO);
    assert.equal(
      MENSAJE_REINTENTO_FALLIDO,
      'El reembolso todavía no se ha podido hacer. Vuelve a intentarlo en un momento.'
    );
    assert.equal(res.body.reserva.reembolso_a_medias, true);
    assert.equal(fila().stripe_refund_id, undefined);
  });

  test('una reserva sin reembolso a medias: 409', async () => {
    for (const reserva of [
      aMedias({ stripe_refund_id: 're_hecho' }),
      alquiler({ estado: 'cancelada' }),
      alquiler()
    ]) {
      instalar({ reservas: [reserva] });
      const res = await accion(RESERVA, 'reintentar-reembolso');
      assert.equal(res.status, 409);
      assert.deepEqual(res.body, { error: 'Esta reserva no tiene ningún reembolso a medias.' });
    }
    assert.equal(stripe.refunds.list.mock.callCount(), 0);
  });
});

describe('levantar un bloqueo', () => {
  test('un bloqueo activo: cancelado por el administrador, y las fechas quedan libres', async () => {
    instalar({ reservas: [bloqueo({ id: RESERVA })] });

    const res = await accion(RESERVA, 'levantar-bloqueo');

    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.etiqueta, 'Bloqueo levantado');
    assert.deepEqual(res.body.reserva.acciones, []);
    assert.equal(fila().estado, 'cancelada');
    assert.equal(fila().cancelada_por, 'admin');
    assert.ok(fila().cancelada_en);
    assert.equal(ultimaLinea().tipo, 'levantado');
    assert.equal(ultimaLinea().detalle, 'Bloqueo levantado.');
  });

  test('ya levantado, o no es un bloqueo: 409', async () => {
    instalar({ reservas: [bloqueo({ id: RESERVA, estado: 'cancelada' })] });
    assert.deepEqual((await accion(RESERVA, 'levantar-bloqueo')).body, {
      error: 'Este bloqueo ya está levantado.'
    });
    instalar({ reservas: [alquiler()] });
    assert.deepEqual((await accion(RESERVA, 'levantar-bloqueo')).body, {
      error: 'Solo se puede levantar un bloqueo activo.'
    });
  });
});
