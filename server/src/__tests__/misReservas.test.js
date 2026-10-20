// "Mis reservas" en la cuenta del cliente (bloque R-c, commit 13; docs/reservas-diseno.md 8.4):
//   GET  /api/reservas/mias                        las reservas de alquiler de la cuenta
//   POST /api/reservas/:id/solicitar-cancelacion   el cliente pide cancelar; cancela el administrador
// Con el doble de Supabase y los emails de mentira.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
// Cada petición desde una IP distinta, para que el límite por IP no se mezcle con lo demás.
process.env.VERCEL = '1';

const supabase = require('../data/supabase');
const email = require('../utils/email');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');
const { MENSAJE_ALQUILER_CERRADO } = require('../controllers/reservasController');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);

const ANA = '00000000-0000-4000-8000-0000000000a1';
const BEA = '00000000-0000-4000-8000-0000000000b2';
const SIN_VERIFICAR = '00000000-0000-4000-8000-0000000000c3';
const SILLA = '00000000-0000-4000-8000-000000000001';
const MESA = '00000000-0000-4000-8000-000000000002';
const R1 = '10000000-0000-4000-8000-000000000001';
const R2 = '10000000-0000-4000-8000-000000000002';
const PEDIDO = 'a1b2c3d4-0000-5000-8000-000000000001';

const token = (sub, correo) =>
  jwt.sign({ sub, email: correo, nombre: 'Cliente', rol: 'cliente' }, process.env.JWT_SECRET);
const TOKEN_ANA = token(ANA, 'ana@ejemplo.com');

let ip = 0;
const conIp = (peticion) => {
  ip += 1;
  return peticion.set('X-Forwarded-For', `10.3.${Math.floor(ip / 250)}.${(ip % 250) + 1}`);
};
const misReservas = (tk = TOKEN_ANA) => {
  const peticion = conIp(request(app).get('/api/reservas/mias'));
  return tk ? peticion.set('Authorization', `Bearer ${tk}`) : peticion;
};
const solicitar = (id, cuerpo = {}, { tk = TOKEN_ANA, desde } = {}) => {
  const peticion = request(app).post(`/api/reservas/${id}/solicitar-cancelacion`);
  if (desde) peticion.set('X-Forwarded-For', desde);
  else conIp(peticion);
  return (tk ? peticion.set('Authorization', `Bearer ${tk}`) : peticion).send(cuerpo);
};

// Una reserva de Ana ya pagada y confirmada.
const pagada = (cambios = {}) => ({
  id: R1,
  mueble_id: SILLA,
  tipo: 'alquiler',
  estado: 'confirmada',
  fecha_inicio: dia(10),
  hora_entrega: '10:00:00',
  fecha_fin: dia(13),
  hora_recogida: '18:30:00',
  fin_ocupacion: dia(13),
  dias_margen: 2,
  cliente_id: ANA,
  pedido_id: PEDIDO,
  stripe_session_id: 'cs_1',
  stripe_payment_intent_id: 'pi_1',
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: 'Calle Mayor 15, 08001 Barcelona',
  datos_contacto: {
    nombre: 'Ana Martínez',
    email: 'ana@ejemplo.com',
    telefono: '600123456',
    direccion: 'Calle Mayor 15, 08001 Barcelona',
    notas: null
  },
  importe_total: 112.5,
  precio_desglose: { dias: 3 },
  historial: [{ tipo: 'creada', por: 'cliente' }],
  ...cambios
});

let fake;
let alertas;
let lecturas;
const instalar = ({ reservas = [] } = {}) => {
  fake = crearFakeSupabase({
    clientes: [
      { id: ANA, email: 'ana@ejemplo.com', email_verificado: true },
      { id: BEA, email: 'bea@ejemplo.com', email_verificado: true },
      { id: SIN_VERIFICAR, email: 'nadie@ejemplo.com', email_verificado: false }
    ],
    muebles: [
      {
        id: SILLA,
        nombre: 'Silla Thonet',
        estado: 'disponible',
        imagenes: ['https://x/silla.webp']
      },
      { id: MESA, nombre: 'Mesa de roble', estado: 'disponible', imagenes: [] }
    ],
    reservas
  });
  lecturas = 0;
  mock.method(supabase, 'from', (tabla) => {
    lecturas += 1;
    return fake.from(tabla);
  });
};

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  alertas = mock.method(email, 'enviarAlertaAdmin', async () => {});
  mock.method(console, 'error', () => {});
  instalar();
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('GET /api/reservas/mias', () => {
  test('con RESERVAS_ACTIVAS apagado: 403 sin mirar nada', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const res = await misReservas(null);
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: MENSAJE_ALQUILER_CERRADO });
    assert.equal(lecturas, 0);
  });

  test('sin sesión, 401; sin el email verificado, 403 con su código', async () => {
    assert.equal((await misReservas(null)).status, 401);
    const res = await misReservas(token(SIN_VERIFICAR, 'nadie@ejemplo.com'));
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, {
      error: 'Confirma tu email para ver tus reservas.',
      codigo: 'email_no_verificado'
    });
  });

  test('sin reservas, una lista vacía', async () => {
    const res = await misReservas();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('una reserva confirmada, campo a campo, sin nada interno', async () => {
    instalar({ reservas: [pagada()] });
    const res = await misReservas();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [
      {
        id: R1,
        referencia: 'A1B2C3D4',
        estado: 'confirmada',
        pieza: { id: SILLA, nombre: 'Silla Thonet', imagen: 'https://x/silla.webp' },
        fecha_inicio: dia(10),
        hora_entrega: '10:00',
        fecha_fin: dia(13),
        hora_recogida: '18:30',
        modo_entrega: 'domicilio',
        modo_devolucion: 'tienda',
        direccion_entrega: 'Calle Mayor 15, 08001 Barcelona',
        dias: 3,
        importe_total_centimos: 11250,
        cancelacion_solicitada: false,
        puede_solicitar_cancelacion: true,
        pago_hasta: null,
        reembolso: null
      }
    ]);
  });

  test('una reserva que espera el pago dice hasta cuándo se puede pagar: lo que dura su sesión, sin la gracia', async () => {
    const expiraEn = new Date(Date.now() + 40 * 60_000).toISOString();
    instalar({
      reservas: [
        pagada({ estado: 'pendiente', expira_en: expiraEn, stripe_payment_intent_id: null })
      ]
    });
    const [reserva] = (await misReservas()).body;
    assert.equal(reserva.estado, 'esperando_pago');
    // 15 minutos de gracia del webhook (REGLAS_ALQUILER.graciaWebhookMin) menos que `expira_en`.
    assert.equal(reserva.pago_hasta, new Date(Date.parse(expiraEn) - 15 * 60_000).toISOString());
    assert.equal(reserva.reembolso, null);
  });

  test('una cancelada enseña lo que se le devuelve y si ya está hecho; sin reembolso, nada', async () => {
    instalar({
      reservas: [
        pagada({
          id: R1,
          estado: 'cancelada',
          reembolso_solicitado_en: '2026-10-20T10:00:00Z',
          reembolso_importe: 87.5,
          stripe_refund_id: 're_1'
        }),
        pagada({
          id: R2,
          estado: 'cancelada',
          fecha_inicio: dia(30),
          fecha_fin: dia(33),
          fin_ocupacion: dia(33),
          reembolso_solicitado_en: '2026-10-20T10:00:00Z',
          reembolso_importe: 112.5,
          stripe_refund_id: null
        }),
        pagada({
          id: '10000000-0000-4000-8000-000000000003',
          estado: 'cancelada',
          fecha_inicio: dia(40),
          fecha_fin: dia(43),
          fin_ocupacion: dia(43)
        })
      ]
    });
    const porId = Object.fromEntries((await misReservas()).body.map((r) => [r.id, r]));
    assert.deepEqual(porId[R1].reembolso, { importe_centimos: 8750, hecho: true });
    assert.deepEqual(porId[R2].reembolso, { importe_centimos: 11250, hecho: false });
    assert.equal(porId['10000000-0000-4000-8000-000000000003'].reembolso, null);
    // Nunca sale el id del reembolso de Stripe.
    assert.ok(!JSON.stringify(porId).includes('re_1'));
  });

  test('solo las de su cuenta y solo alquileres', async () => {
    instalar({
      reservas: [
        pagada(),
        pagada({
          id: R2,
          cliente_id: BEA,
          mueble_id: MESA,
          fecha_inicio: dia(30),
          fecha_fin: dia(31),
          fin_ocupacion: dia(31)
        })
      ]
    });
    const res = await misReservas();
    assert.deepEqual(
      res.body.map((r) => r.id),
      [R1]
    );
  });

  test('cada estado, como lo ve el cliente; lo que nunca llegó a pagarse no sale', async () => {
    const enMinutos = (n) => new Date(Date.now() + n * 60_000).toISOString();
    const fila = (n, cambios) =>
      pagada({
        id: `10000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
        fecha_inicio: dia(n * 10),
        fecha_fin: dia(n * 10 + 2),
        fin_ocupacion: dia(n * 10 + 2),
        ...cambios
      });
    instalar({
      reservas: [
        fila(1, { estado: 'pendiente', expira_en: enMinutos(20), stripe_payment_intent_id: null }),
        fila(2, { estado: 'pendiente', expira_en: enMinutos(-5), stripe_payment_intent_id: null }),
        fila(3, { estado: 'expirada', stripe_payment_intent_id: null }),
        fila(4, { estado: 'cancelada', stripe_payment_intent_id: null }),
        fila(5, { estado: 'en_curso', entregada_en: new Date().toISOString() }),
        fila(6, {
          estado: 'devuelta',
          entregada_en: '2026-01-01T10:00:00Z',
          devuelta_en: '2026-01-03T10:00:00Z'
        }),
        fila(7, { estado: 'cancelada' }),
        fila(8, { estado: 'expirada', conflicto_en: new Date().toISOString() })
      ]
    });
    const res = await misReservas();
    const porFecha = Object.fromEntries(res.body.map((r) => [r.fecha_inicio, r.estado]));
    assert.deepEqual(porFecha, {
      [dia(10)]: 'esperando_pago',
      [dia(50)]: 'en_curso',
      [dia(60)]: 'devuelta',
      [dia(70)]: 'cancelada',
      [dia(80)]: 'no_confirmada'
    });
    // Las más lejanas primero.
    assert.deepEqual(
      res.body.map((r) => r.fecha_inicio),
      [dia(80), dia(70), dia(60), dia(50), dia(10)]
    );
    // Solo una confirmada se puede pedir cancelar.
    assert.ok(res.body.every((r) => r.puede_solicitar_cancelacion === false));
  });

  test('si la pieza ya no está en el catálogo, se dice; sin pedido, la referencia es la de la reserva', async () => {
    instalar({
      reservas: [pagada({ mueble_id: '00000000-0000-4000-8000-000000000099', pedido_id: null })]
    });
    const [reserva] = (await misReservas()).body;
    assert.deepEqual(reserva.pieza, {
      id: '00000000-0000-4000-8000-000000000099',
      nombre: 'Pieza retirada del catálogo',
      imagen: null
    });
    assert.equal(reserva.referencia, '10000000');
  });

  test('una cancelación ya pedida se enseña y no se puede volver a pedir', async () => {
    instalar({
      reservas: [pagada({ historial: [{ tipo: 'creada' }, { tipo: 'cancelacion_solicitada' }] })]
    });
    const [reserva] = (await misReservas()).body;
    assert.equal(reserva.cancelacion_solicitada, true);
    assert.equal(reserva.puede_solicitar_cancelacion, false);
  });

  test('si falla la base de datos: 500 genérico', async () => {
    instalar({ reservas: [pagada()] });
    fake.fallos['reservas.select'] = { message: 'conexión perdida' };
    const res = await misReservas();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al obtener tus reservas.' });
  });

  test('si falla la lectura de las piezas: 500 genérico', async () => {
    instalar({ reservas: [pagada()] });
    fake.fallos['muebles.select'] = { message: 'conexión perdida' };
    assert.equal((await misReservas()).status, 500);
  });
});

describe('POST /api/reservas/:id/solicitar-cancelacion', () => {
  const historialDe = (id) => fake.tablas.reservas.find((r) => r.id === id).historial;

  test('con RESERVAS_ACTIVAS apagado: 403 sin mirar nada', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const res = await solicitar(R1, {}, { tk: null });
    assert.equal(res.status, 403);
    assert.equal(lecturas, 0);
  });

  test('queda en el historial, se avisa al administrador y la reserva sigue confirmada', async () => {
    instalar({ reservas: [pagada()] });

    const res = await solicitar(R1, { motivo: '  Se ha cancelado el rodaje.  ' });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      mensaje:
        'Hemos recibido tu solicitud. Te escribiremos para confirmar la cancelación y el reembolso.'
    });
    const fila = fake.tablas.reservas[0];
    assert.equal(fila.estado, 'confirmada');
    const linea = fila.historial.at(-1);
    assert.equal(linea.tipo, 'cancelacion_solicitada');
    assert.equal(linea.detalle, 'Se ha cancelado el rodaje.');
    assert.equal(linea.por, 'cliente');
    assert.ok(linea.fecha);
    assert.equal(fila.historial.length, 2);

    assert.equal(alertas.mock.callCount(), 1);
    const { asunto, detalles } = alertas.mock.calls[0].arguments[0];
    assert.equal(asunto, 'Solicitud de cancelación de una reserva');
    assert.match(detalles[0], /^Reserva #A1B2C3D4 de Silla Thonet/);
    assert.ok(detalles.includes('Motivo: Se ha cancelado el rodaje.'));
    assert.ok(detalles.includes('Importe pagado: 112.50 €'));
    assert.ok(detalles.some((d) => /a las 10:00$/.test(d)));
    assert.ok(detalles.some((d) => /a las 18:30$/.test(d)));

    // Ya no se puede pedir otra vez.
    const [enLaLista] = (await misReservas()).body;
    assert.equal(enLaLista.cancelacion_solicitada, true);
  });

  test('sin motivo también vale', async () => {
    instalar({ reservas: [pagada()] });
    assert.equal((await solicitar(R1)).status, 200);
    assert.equal(historialDe(R1).at(-1).detalle, 'Sin motivo.');
    assert.ok(alertas.mock.calls[0].arguments[0].detalles.includes('Motivo: no lo ha indicado'));
  });

  test('pedirlo dos veces: 409 y un solo aviso', async () => {
    instalar({ reservas: [pagada()] });
    await solicitar(R1);
    const res = await solicitar(R1);
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: 'Ya nos has pedido cancelar esta reserva. Te escribiremos pronto.'
    });
    assert.equal(alertas.mock.callCount(), 1);
  });

  test('dos a la vez: una sola línea en el historial y un solo aviso', async () => {
    instalar({ reservas: [pagada()] });
    const respuestas = await Promise.all([solicitar(R1), solicitar(R1)]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 409]);
    assert.equal(historialDe(R1).filter((l) => l.tipo === 'cancelacion_solicitada').length, 1);
    assert.equal(alertas.mock.callCount(), 1);
  });

  test('en otro estado: 409 y nada cambia', async () => {
    for (const cambios of [
      { estado: 'en_curso', entregada_en: new Date().toISOString() },
      { estado: 'cancelada' },
      { estado: 'expirada', conflicto_en: new Date().toISOString() }
    ]) {
      instalar({ reservas: [pagada(cambios)] });
      const res = await solicitar(R1);
      assert.equal(res.status, 409);
      assert.deepEqual(res.body, {
        error: 'Esta reserva ya no se puede cancelar desde aquí. Escríbenos y lo vemos.'
      });
      assert.equal(historialDe(R1).length, 1);
    }
    assert.equal(alertas.mock.callCount(), 0);
  });

  test('la reserva de otro cliente, una que no existe o un id raro: 404 igual', async () => {
    instalar({ reservas: [pagada({ cliente_id: BEA })] });
    for (const id of [R1, R2, 'no-es-un-uuid']) {
      const res = await solicitar(id);
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: 'No encontramos esa reserva.' });
    }
    assert.equal(historialDe(R1).length, 1);
    assert.equal(alertas.mock.callCount(), 0);
  });

  test('sin sesión 401; sin el email verificado 403', async () => {
    instalar({ reservas: [pagada()] });
    assert.equal((await solicitar(R1, {}, { tk: null })).status, 401);
    const res = await solicitar(R1, {}, { tk: token(SIN_VERIFICAR, 'nadie@ejemplo.com') });
    assert.equal(res.status, 403);
    assert.equal(res.body.codigo, 'email_no_verificado');
  });

  test('un motivo demasiado largo o que no es texto: 400', async () => {
    instalar({ reservas: [pagada()] });
    const largo = await solicitar(R1, { motivo: 'x'.repeat(501) });
    assert.equal(largo.status, 400);
    assert.equal(largo.body.error, 'El motivo es demasiado largo (máximo 500 caracteres).');
    assert.equal((await solicitar(R1, { motivo: 42 })).status, 400);
  });

  test('si falla la base de datos al guardarla: 500 y no se avisa', async () => {
    instalar({ reservas: [pagada()] });
    fake.fallos['reservas.update'] = { message: 'conexión perdida' };
    const res = await solicitar(R1);
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      error: 'No hemos podido enviar tu solicitud. Inténtalo de nuevo.'
    });
    assert.equal(alertas.mock.callCount(), 0);
  });

  test('si no se puede leer la pieza, el aviso sale igual', async () => {
    instalar({ reservas: [pagada()] });
    fake.fallos['muebles.select'] = { message: 'conexión perdida' };
    assert.equal((await solicitar(R1)).status, 200);
    assert.match(alertas.mock.calls[0].arguments[0].detalles[0], /de una pieza/);
  });

  test('como mucho 5 solicitudes cada 15 minutos por IP', async () => {
    instalar({ reservas: [pagada({ cliente_id: BEA })] });
    const desde = '10.99.0.1';
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await solicitar(R1, {}, { desde })).status, 404);
    }
    const res = await solicitar(R1, {}, { desde });
    assert.equal(res.status, 429);
    assert.deepEqual(res.body, {
      error: 'Demasiadas solicitudes seguidas. Espera unos minutos antes de volver a intentarlo.'
    });
  });
});
