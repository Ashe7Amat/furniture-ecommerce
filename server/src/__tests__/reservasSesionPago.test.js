// Tests de POST /api/reservas/sesion-pago (utils/reservas.js, docs/reservas-diseno.md 6.3 y 4): la
// reserva provisional y su sesión de pago, con el doble de Supabase (que emula la exclusión de
// solapes, 23P01, y el índice de una provisional por cliente, 23505) y un Stripe de mentira. Las
// fechas van relativas a hoy en Madrid, porque el endpoint usa el reloj de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
process.env.CLIENT_URL = 'https://tienda.example.com';
// Cada petición llega desde una IP distinta (X-Forwarded-For, que solo se lee con VERCEL=1), para que
// el límite por IP no se mezcle con el resto de tests. El límite tiene su propio test al final.
process.env.VERCEL = '1';

const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const app = require('../index');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');
const { MENSAJE_ALQUILER_CERRADO } = require('../controllers/reservasController');
const {
  iniciarPagoDeReserva,
  MENSAJE_FECHAS_OCUPADAS,
  MENSAJE_OTRA_RESERVA,
  MENSAJE_REINTENTAR_PAGO,
  CODIGO_OTRA_RESERVA
} = require('../utils/reservas');
const { REGLAS_ALQUILER } = require('../utils/reglasAlquiler');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);

const ANA = '00000000-0000-4000-8000-0000000000a1';
const BEA = '00000000-0000-4000-8000-0000000000b2';
const SIN_VERIFICAR = '00000000-0000-4000-8000-0000000000c3';
const SILLA = '00000000-0000-4000-8000-000000000001';
const VENDIDA = '00000000-0000-4000-8000-000000000002';
const SIN_PRECIO = '00000000-0000-4000-8000-000000000003';
const NO_EXISTE = '00000000-0000-4000-8000-000000000009';

const token = (sub, email) =>
  jwt.sign({ sub, email, nombre: 'Cliente', rol: 'cliente' }, process.env.JWT_SECRET);
const TOKEN_ANA = token(ANA, 'ana@ejemplo.com');
const TOKEN_BEA = token(BEA, 'bea@ejemplo.com');

let ip = 0;
const reservar = (cuerpo, { tk = TOKEN_ANA, desde } = {}) => {
  ip += 1;
  const peticion = request(app)
    .post('/api/reservas/sesion-pago')
    .set('X-Forwarded-For', desde || `10.1.${Math.floor(ip / 250)}.${(ip % 250) + 1}`);
  return (tk ? peticion.set('Authorization', `Bearer ${tk}`) : peticion).send(cuerpo);
};

const cuerpo = (cambios = {}) => ({
  mueble_id: SILLA,
  fecha_inicio: dia(10),
  hora_entrega: '10:00',
  fecha_fin: dia(13),
  hora_recogida: '10:00',
  entrega: 'domicilio',
  recogida: 'tienda',
  contacto: {
    nombre: 'Ana Martínez',
    telefono: '600123456',
    direccion: 'Calle Mayor 15, 08001 Barcelona',
    notas: 'Llamar al timbre.'
  },
  acepta_condiciones: true,
  ...cambios
});

// Una reserva ya guardada, con lo mínimo que comprueban las restricciones.
const reserva = (cambios = {}) => ({
  id: `r-${Math.random().toString(16).slice(2)}`,
  mueble_id: SILLA,
  tipo: 'alquiler',
  estado: 'confirmada',
  fecha_inicio: dia(10),
  fecha_fin: dia(13),
  fin_ocupacion: dia(13),
  dias_margen: 2,
  cliente_id: BEA,
  ...cambios
});

// Stripe de mentira: recuerda el estado de cada sesión, como el de verdad, y solo deja caducar las
// abiertas.
let stripe;
const crearStripeFalso = () => {
  let n = 0;
  const sesiones = new Map();
  return {
    sesiones,
    checkout: {
      sessions: {
        create: mock.fn(async () => {
          n += 1;
          const id = `cs_test_${n}`;
          sesiones.set(id, 'open');
          return { id, url: `https://checkout.stripe.com/c/pay/${id}` };
        }),
        expire: mock.fn(async (id) => {
          if (sesiones.get(id) !== 'open') {
            throw new Error('Only Checkout Sessions with a status of open can be expired.');
          }
          sesiones.set(id, 'expired');
          return { id, status: 'expired' };
        }),
        retrieve: mock.fn(async (id) => ({ id, status: sesiones.get(id) }))
      }
    }
  };
};

let fake;
const instalar = ({ reservas = [] } = {}) => {
  fake = crearFakeSupabase({
    clientes: [
      { id: ANA, email: 'ana@ejemplo.com', email_verificado: true },
      { id: BEA, email: 'bea@ejemplo.com', email_verificado: true },
      { id: SIN_VERIFICAR, email: 'nadie@ejemplo.com', email_verificado: false }
    ],
    muebles: [
      { id: SILLA, nombre: 'Silla Thonet', estado: 'disponible', precio_alquiler_dia: 25 },
      { id: VENDIDA, nombre: 'Mesa', estado: 'vendido', precio_alquiler_dia: 40 },
      { id: SIN_PRECIO, nombre: 'Banco', estado: 'disponible', precio_alquiler_dia: null }
    ],
    reservas
  });
  mock.method(supabase, 'from', fake.from);
};

const filas = () => fake.tablas.reservas;
const deAna = () => filas().filter((r) => r.cliente_id === ANA);
const creaciones = () => stripe.checkout.sessions.create.mock.calls;

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  stripe = crearStripeFalso();
  mock.method(stripeUtil, 'getStripe', () => stripe);
  mock.method(console, 'error', () => {});
  instalar();
});

afterEach(() => {
  mock.restoreAll();
  process.env.MOSTRAR_PRECIOS = 'true';
  delete process.env.RESERVAS_ACTIVAS;
});

describe('interruptores y acceso', () => {
  test('con RESERVAS_ACTIVAS apagado responde 403 y no mira nada, ni siquiera la sesión', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const res = await reservar(cuerpo(), { tk: null });
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: MENSAJE_ALQUILER_CERRADO });
    assert.equal(fake.escrituras.length, 0);
  });

  test('solo "true" lo enciende', async () => {
    process.env.RESERVAS_ACTIVAS = 'TRUE';
    assert.equal((await reservar(cuerpo())).status, 403);
  });

  test('con los precios ocultos tampoco se puede reservar', async () => {
    process.env.MOSTRAR_PRECIOS = 'false';
    const res = await reservar(cuerpo());
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: MENSAJE_ALQUILER_CERRADO });
    assert.equal(filas().length, 0);
  });

  test('sin iniciar sesión, 401', async () => {
    const res = await reservar(cuerpo(), { tk: null });
    assert.equal(res.status, 401);
    assert.equal(filas().length, 0);
  });

  test('con el email sin verificar, 403 con su código, y no se crea nada', async () => {
    const res = await reservar(cuerpo(), { tk: token(SIN_VERIFICAR, 'nadie@ejemplo.com') });
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, {
      error: 'Confirma tu email para poder reservar.',
      codigo: 'email_no_verificado'
    });
    assert.equal(filas().length, 0);
    assert.equal(creaciones().length, 0);
  });

  test('un token de una cuenta que ya no existe, 401', async () => {
    const res = await reservar(cuerpo(), {
      tk: token('00000000-0000-4000-8000-0000000000ff', 'x@ejemplo.com')
    });
    assert.equal(res.status, 401);
  });

  test('sin Stripe configurado, 503', async () => {
    mock.method(stripeUtil, 'getStripe', () => null);
    const res = await reservar(cuerpo());
    assert.equal(res.status, 503);
    assert.equal(filas().length, 0);
  });
});

describe('validación', () => {
  const casos = [
    [
      'sin aceptar las condiciones',
      { acepta_condiciones: false },
      'Tienes que aceptar las condiciones del alquiler.'
    ],
    ['sin datos de contacto', { contacto: undefined }, 'Faltan tus datos de contacto.'],
    [
      'sin nombre',
      { contacto: { nombre: '  ', telefono: '600123456', direccion: 'Calle 1' } },
      'Escribe tu nombre.'
    ],
    [
      'sin teléfono',
      { contacto: { nombre: 'Ana', direccion: 'Calle 1' } },
      'Escribe un teléfono de contacto.'
    ],
    [
      'con un teléfono demasiado largo',
      { contacto: { nombre: 'Ana', telefono: '6'.repeat(31), direccion: 'Calle 1' } },
      'El teléfono es demasiado largo (máximo 30 caracteres).'
    ],
    [
      'con unas notas demasiado largas',
      {
        contacto: { nombre: 'Ana', telefono: '600', direccion: 'Calle 1', notas: 'x'.repeat(501) }
      },
      'Las notas son demasiado largas (máximo 500 caracteres).'
    ],
    [
      'con una dirección que no es texto',
      { contacto: { nombre: 'Ana', telefono: '600', direccion: 15 } },
      'Revisa tus datos de contacto.'
    ],
    [
      'a domicilio sin dirección',
      { contacto: { nombre: 'Ana', telefono: '600123456' } },
      'Escribe la dirección para la entrega o la recogida a domicilio.'
    ],
    ['sin la pieza', { mueble_id: undefined }, 'Falta la pieza que quieres reservar.'],
    [
      'con una pieza que no es un id',
      { mueble_id: 'silla' },
      'Falta la pieza que quieres reservar.'
    ],
    ['una pieza vendida', { mueble_id: VENDIDA }, 'Esta pieza no se puede alquilar.'],
    [
      'una pieza sin precio de alquiler',
      { mueble_id: SIN_PRECIO },
      'Esta pieza no se puede alquilar.'
    ],
    [
      'sin hora de entrega',
      { hora_entrega: undefined },
      'Elige la hora de entrega y la de recogida.'
    ],
    [
      'con la recogida el mismo día',
      { fecha_fin: dia(10), hora_recogida: '20:00' },
      'La recogida tiene que ser después del día de entrega.'
    ],
    [
      'sin el modo de recogida',
      { recogida: 'por mensajero' },
      'Elige si la recogida es a domicilio o en la tienda.'
    ]
  ];
  for (const [nombre, cambios, mensaje] of casos) {
    test(`${nombre}: 400 y no se crea nada`, async () => {
      const res = await reservar(cuerpo(cambios));
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: mensaje });
      assert.equal(filas().length, 0);
      assert.equal(creaciones().length, 0);
    });
  }

  test('antes de la antelación mínima, 400 con el primer día posible', async () => {
    const res = await reservar(cuerpo({ fecha_inicio: dia(1), fecha_fin: dia(3) }));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /^La entrega más temprana posible es el \d{2}\/\d{2}\/\d{4}\.$/);
  });

  test('una pieza que no existe, 404', async () => {
    const res = await reservar(cuerpo({ mueble_id: NO_EXISTE }));
    assert.equal(res.status, 404);
    assert.equal(filas().length, 0);
  });

  test('con entrega y recogida en la tienda no hace falta dirección', async () => {
    const res = await reservar(
      cuerpo({ entrega: 'tienda', contacto: { nombre: 'Ana', telefono: '600123456' } })
    );
    assert.equal(res.status, 200);
    assert.equal(filas()[0].direccion_entrega, null);
  });

  test('el cliente y el precio salen del servidor, nunca del cuerpo', async () => {
    const res = await reservar(
      cuerpo({ cliente_id: BEA, precio_alquiler_dia: 1, importe_total: 1, estado: 'confirmada' })
    );
    assert.equal(res.status, 200);
    const [fila] = filas();
    assert.equal(fila.cliente_id, ANA);
    assert.equal(fila.estado, 'pendiente');
    // 75 € de alquiler y 22,50 € de fianza (30 %): los dos los calcula el servidor.
    assert.equal(fila.importe_total, 97.5);
    assert.equal(fila.fianza_importe, 22.5);
  });
});

describe('la reserva provisional y su sesión de pago', () => {
  test('crea la provisional con todo lo aceptado y guarda en ella la sesión de Stripe', async () => {
    const antes = Date.now();
    const res = await reservar(cuerpo());
    const despues = Date.now();

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    const [fila] = filas();
    assert.equal(filas().length, 1);
    assert.equal(fila.tipo, 'alquiler');
    assert.equal(fila.estado, 'pendiente');
    assert.equal(fila.origen, 'web');
    assert.equal(fila.mueble_id, SILLA);
    assert.equal(fila.cliente_id, ANA);
    assert.equal(fila.fecha_inicio, dia(10));
    assert.equal(fila.fecha_fin, dia(13));
    assert.equal(fila.hora_entrega, '10:00');
    assert.equal(fila.hora_recogida, '10:00');
    assert.equal(fila.fin_ocupacion, dia(13));
    assert.equal(fila.dias_margen, 2);
    assert.equal(fila.rango_ocupado, `[${dia(10)},${dia(15)})`);
    assert.equal(fila.stripe_session_id, 'cs_test_1');
    assert.equal(fila.modo_entrega, 'domicilio');
    assert.equal(fila.modo_devolucion, 'tienda');
    assert.equal(fila.direccion_entrega, 'Calle Mayor 15, 08001 Barcelona');
    assert.deepEqual(fila.datos_contacto, {
      nombre: 'Ana Martínez',
      email: 'ana@ejemplo.com',
      telefono: '600123456',
      direccion: 'Calle Mayor 15, 08001 Barcelona',
      notas: 'Llamar al timbre.'
    });
    assert.equal(fila.importe_alquiler, 75);
    assert.equal(fila.importe_envio, 0);
    // La fianza (30 % del alquiler) va en el total y queda pendiente hasta que se pague.
    assert.equal(fila.importe_total, 97.5);
    assert.equal(fila.fianza_importe, 22.5);
    assert.equal(fila.fianza_estado, 'pendiente');
    assert.equal(fila.precio_desglose.dias, 3);
    assert.equal(fila.precio_desglose.importe_total_centimos, 9750);
    assert.equal(fila.precio_desglose.version_reglas, 2);
    assert.equal(fila.condiciones.politica_cancelacion, 'manual');
    assert.equal(fila.condiciones.dias_margen, 2);
    assert.equal(fila.historial.length, 1);
    assert.equal(fila.historial[0].tipo, 'creada');

    // Caduca a los 30 + 1 + 15 minutos: la sesión de Stripe, su margen y la gracia del webhook.
    const expira = new Date(fila.expira_en).getTime();
    assert.ok(expira >= antes + 46 * 60_000 && expira <= despues + 46 * 60_000);
  });

  test('la sesión de Stripe: líneas, metadata sin datos personales, "Reservar" y caducidad', async () => {
    const antes = Math.floor(Date.now() / 1000);
    await reservar(cuerpo({ hora_recogida: '10:30' }));
    const [
      {
        arguments: [parametros, opciones]
      }
    ] = creaciones();
    const [fila] = filas();

    assert.equal(parametros.mode, 'payment');
    assert.equal(parametros.submit_type, 'book');
    assert.equal(parametros.customer_email, 'ana@ejemplo.com');
    assert.equal(parametros.client_reference_id, fila.id);
    assert.deepEqual(parametros.metadata, { tipo: 'reserva', reserva_id: fila.id });
    assert.deepEqual(parametros.payment_intent_data.metadata, {
      tipo: 'reserva',
      reserva_id: fila.id
    });
    assert.equal(
      parametros.success_url,
      'https://tienda.example.com/checkout/exito?session_id={CHECKOUT_SESSION_ID}'
    );
    assert.equal(parametros.cancel_url, `https://tienda.example.com/producto/${SILLA}`);
    assert.deepEqual(opciones, { idempotencyKey: `reserva-${fila.id}` });

    // Recogida media hora más tarde que la entrega: 4 días.
    const [fi, ff] = [dia(10), dia(13)].map((f) => f.split('-').reverse().join('/'));
    assert.deepEqual(parametros.line_items, [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Alquiler de Silla Thonet',
            description: `Entrega el ${fi} a las 10:00 y recogida el ${ff} a las 10:30: 4 días × 25,00 €`
          },
          unit_amount: 10000
        },
        quantity: 1
      },
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Fianza reembolsable',
            description:
              '30 % del alquiler. Te la devolvemos en esta misma tarjeta después de la recogida, ' +
              'cuando revisemos la pieza.'
          },
          unit_amount: 3000
        },
        quantity: 1
      }
    ]);

    // Stripe admite de 30 minutos a 24 horas desde que crea la sesión.
    assert.ok(parametros.expires_at >= antes + 31 * 60);
    assert.ok(parametros.expires_at <= Math.floor(Date.now() / 1000) + 31 * 60);
    assert.ok(!JSON.stringify(parametros.metadata).includes('600123456'));
  });

  test('si una fecha ya está ocupada por la reserva de otra persona, 409 antes de llegar a Stripe', async () => {
    instalar({
      reservas: [reserva({ fecha_inicio: dia(12), fecha_fin: dia(20), fin_ocupacion: dia(20) })]
    });
    const res = await reservar(cuerpo());
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_FECHAS_OCUPADAS });
    assert.equal(creaciones().length, 0);
    assert.equal(deAna().length, 0);
  });

  test('el margen de la reserva anterior también cuenta: cabe justo al acabar', async () => {
    // Recogida el día 6 y 2 días de margen: la pieza está libre desde el día 8.
    instalar({
      reservas: [reserva({ fecha_inicio: dia(3), fecha_fin: dia(6), fin_ocupacion: dia(6) })]
    });
    assert.equal((await reservar(cuerpo({ fecha_inicio: dia(7) }))).status, 409);
    assert.equal((await reservar(cuerpo({ fecha_inicio: dia(8) }))).status, 200);
  });

  test('y el margen de la nueva protege a la siguiente', async () => {
    // La nueva acaba el día 13 y la siguiente empieza el 14: con 2 días de margen no cabe.
    instalar({
      reservas: [reserva({ fecha_inicio: dia(14), fecha_fin: dia(16), fin_ocupacion: dia(16) })]
    });
    assert.equal((await reservar(cuerpo())).status, 409);
  });

  test('una venta (sin fin) y un bloqueo también ocupan el calendario', async () => {
    instalar({
      reservas: [
        reserva({
          tipo: 'venta',
          fecha_inicio: dia(30),
          fecha_fin: null,
          fin_ocupacion: null,
          dias_margen: 0,
          cliente_id: null
        })
      ]
    });
    assert.equal(
      (await reservar(cuerpo({ fecha_inicio: dia(40), fecha_fin: dia(42) }))).status,
      409
    );
    assert.equal((await reservar(cuerpo())).status, 200);

    instalar({
      reservas: [reserva({ tipo: 'bloqueo', dias_margen: 0, cliente_id: null })]
    });
    assert.equal((await reservar(cuerpo())).status, 409);
  });

  test('las canceladas y expiradas no ocupan', async () => {
    instalar({
      reservas: [
        reserva({ estado: 'cancelada' }),
        reserva({ estado: 'expirada', cliente_id: null })
      ]
    });
    assert.equal((await reservar(cuerpo())).status, 200);
  });

  test('la provisional caducada de otra persona se marca expirada y deja de estorbar', async () => {
    const caducada = reserva({
      estado: 'pendiente',
      expira_en: new Date(Date.now() - 60_000).toISOString(),
      stripe_session_id: 'cs_de_bea'
    });
    instalar({ reservas: [caducada] });

    const res = await reservar(cuerpo());

    assert.equal(res.status, 200);
    assert.equal(filas().find((r) => r.id === caducada.id).estado, 'expirada');
    assert.equal(deAna()[0].estado, 'pendiente');
    // Se limpia antes de escribir, no después de chocar: la inserción entra a la primera.
    assert.equal(fake.estado.exclusionRechazada, 0);
  });

  test('la provisional todavía vigente de otra persona sí ocupa', async () => {
    instalar({
      reservas: [
        reserva({ estado: 'pendiente', expira_en: new Date(Date.now() + 60_000).toISOString() })
      ]
    });
    assert.equal((await reservar(cuerpo())).status, 409);
  });
});

test('con descuento y entrega de pago: Stripe recibe el alquiler ya descontado y una línea por trayecto', async () => {
  // Las reglas de hoy no tienen ni descuentos ni tarifas (pendientes del cliente): se prueban con
  // unas de ejemplo.
  const reglas = {
    ...REGLAS_ALQUILER,
    tramosDescuento: [{ desdeDias: 3, porcentaje: 10 }],
    tarifasTrayectoCentimos: { domicilio: 3000, tienda: 0 }
  };
  await iniciarPagoDeReserva({
    stripe,
    cuenta: { id: ANA, email: 'ana@ejemplo.com' },
    mueble: { id: SILLA, nombre: 'Silla Thonet', estado: 'disponible', precio_alquiler_dia: 25 },
    datos: cuerpo({ recogida: 'domicilio' }),
    reglas
  });

  const lineas = creaciones()[0].arguments[0].line_items;
  assert.deepEqual(
    lineas.map((l) => [l.price_data.product_data.name, l.price_data.unit_amount]),
    [
      ['Alquiler de Silla Thonet', 6750],
      ['Entrega a domicilio', 3000],
      ['Recogida a domicilio', 3000],
      // La fianza, el 30 % del alquiler ya descontado (67,50 €), sin los trayectos.
      ['Fianza reembolsable', 2025]
    ]
  );
  assert.match(
    lineas[0].price_data.product_data.description,
    /: 3 días × 25,00 € − 10 % por 3 días o más$/
  );
  const [fila] = filas();
  assert.equal(fila.importe_alquiler, 67.5);
  assert.equal(fila.importe_envio, 60);
  assert.equal(fila.importe_total, 147.75);
});

test('sin fianza (0 %): no hay línea de fianza y no aplica', async () => {
  await iniciarPagoDeReserva({
    stripe,
    cuenta: { id: ANA, email: 'ana@ejemplo.com' },
    mueble: { id: SILLA, nombre: 'Silla Thonet', estado: 'disponible', precio_alquiler_dia: 25 },
    datos: cuerpo(),
    reglas: { ...REGLAS_ALQUILER, fianzaPorcentaje: 0 }
  });
  const lineas = creaciones()[0].arguments[0].line_items;
  assert.deepEqual(
    lineas.map((l) => l.price_data.product_data.name),
    ['Alquiler de Silla Thonet']
  );
  const [fila] = filas();
  assert.equal(fila.fianza_importe, 0);
  assert.equal(fila.fianza_estado, 'no_aplica');
  assert.equal(fila.importe_total, 75);
});

describe('la reserva anterior del mismo cliente (6.3, paso 4)', () => {
  const anteriorDeAna = (cambios = {}) =>
    reserva({
      id: 'r-anterior',
      estado: 'pendiente',
      cliente_id: ANA,
      expira_en: new Date(Date.now() + 20 * 60_000).toISOString(),
      stripe_session_id: 'cs_anterior',
      ...cambios
    });
  const anterior = () => filas().find((r) => r.id === 'r-anterior');

  test('con la sesión abierta: se caduca en Stripe, se cancela y se crea la nueva (las mismas fechas incluidas)', async () => {
    instalar({ reservas: [anteriorDeAna()] });
    stripe.sesiones.set('cs_anterior', 'open');

    const res = await reservar(cuerpo());

    assert.equal(res.status, 200);
    assert.deepEqual(stripe.checkout.sessions.expire.mock.calls[0].arguments, ['cs_anterior']);
    assert.equal(anterior().estado, 'cancelada');
    assert.equal(anterior().cancelada_por, 'sistema');
    assert.equal(anterior().motivo_cancelacion, 'El cliente empezó otra reserva.');
    assert.equal(deAna().filter((r) => r.estado === 'pendiente').length, 1);
  });

  test('sin sesión todavía: se cancela sin llamar a Stripe', async () => {
    instalar({ reservas: [anteriorDeAna({ stripe_session_id: null })] });
    assert.equal((await reservar(cuerpo())).status, 200);
    assert.equal(stripe.checkout.sessions.expire.mock.callCount(), 0);
    assert.equal(anterior().estado, 'cancelada');
  });

  test('si la sesión ya había caducado en Stripe, se marca expirada', async () => {
    instalar({ reservas: [anteriorDeAna()] });
    stripe.sesiones.set('cs_anterior', 'expired');
    assert.equal((await reservar(cuerpo())).status, 200);
    assert.equal(anterior().estado, 'expirada');
  });

  test('si ya está pagada no se toca, y la nueva da 409 (se está confirmando la anterior)', async () => {
    instalar({ reservas: [anteriorDeAna()] });
    stripe.sesiones.set('cs_anterior', 'complete');

    const res = await reservar(cuerpo({ fecha_inicio: dia(30), fecha_fin: dia(32) }));

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_OTRA_RESERVA, codigo: CODIGO_OTRA_RESERVA });
    assert.equal(anterior().estado, 'pendiente');
    assert.equal(creaciones().length, 0);
  });

  test('si Stripe no deja caducarla ni consultarla, 503 y no se toca nada', async () => {
    instalar({ reservas: [anteriorDeAna()] });
    stripe.sesiones.set('cs_anterior', 'open');
    stripe.checkout.sessions.expire.mock.mockImplementation(async () => {
      throw new Error('socket hang up');
    });
    stripe.checkout.sessions.retrieve.mock.mockImplementation(async () => {
      throw new Error('socket hang up');
    });

    const res = await reservar(cuerpo());

    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: MENSAJE_REINTENTAR_PAGO });
    assert.equal(anterior().estado, 'pendiente');
    assert.equal(deAna().length, 1);
    assert.equal(creaciones().length, 0);
  });

  test('si no la deja caducar y sigue abierta, también 503', async () => {
    instalar({ reservas: [anteriorDeAna()] });
    stripe.sesiones.set('cs_anterior', 'open');
    stripe.checkout.sessions.expire.mock.mockImplementation(async () => {
      throw new Error('Rate limit');
    });
    assert.equal((await reservar(cuerpo())).status, 503);
    assert.equal(anterior().estado, 'pendiente');
  });
});

describe('fallos y carreras', () => {
  test('si Stripe no crea la sesión: 500, la provisional se cancela y las fechas quedan libres', async () => {
    stripe.checkout.sessions.create.mock.mockImplementationOnce(async () => {
      throw new Error('Stripe caído');
    });

    const res = await reservar(cuerpo());

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'No se pudo iniciar el proceso de pago.' });
    assert.equal(filas()[0].estado, 'cancelada');
    assert.equal(filas()[0].motivo_cancelacion, 'No se pudo crear la sesión de pago.');
    assert.equal((await reservar(cuerpo(), { tk: TOKEN_BEA })).status, 200);
  });

  test('si otra petición del mismo cliente cancela la provisional mientras se crea la sesión, esa sesión se caduca (paso 8)', async () => {
    stripe.checkout.sessions.create.mock.mockImplementationOnce(async () => {
      filas()[0].estado = 'cancelada';
      stripe.sesiones.set('cs_carrera', 'open');
      return { id: 'cs_carrera', url: 'https://checkout.stripe.com/c/pay/cs_carrera' };
    });

    const res = await reservar(cuerpo());

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_OTRA_RESERVA, codigo: CODIGO_OTRA_RESERVA });
    assert.deepEqual(stripe.checkout.sessions.expire.mock.calls[0].arguments, ['cs_carrera']);
    assert.equal(stripe.sesiones.get('cs_carrera'), 'expired');
    assert.equal(filas()[0].stripe_session_id, undefined);
  });

  test('si falla guardar la sesión en la reserva: 500 y esa sesión se caduca', async () => {
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.stripe_session_id ? { message: 'conexión perdida' } : null;

    const res = await reservar(cuerpo());

    assert.equal(res.status, 500);
    assert.equal(stripe.sesiones.get('cs_test_1'), 'expired');
  });

  test('un fallo de la base de datos al insertar es un 500 y no llega a Stripe', async () => {
    fake.fallos['reservas.insert'] = { message: 'conexión perdida' };
    const res = await reservar(cuerpo());
    assert.equal(res.status, 500);
    assert.equal(creaciones().length, 0);
  });

  test('doble clic: las dos peticiones a la vez dejan una sola provisional con una sola sesión válida', async () => {
    const respuestas = await Promise.all([reservar(cuerpo()), reservar(cuerpo())]);
    const estados = respuestas.map((r) => r.status).sort();

    assert.equal(estados[0], 200);
    assert.ok([200, 409].includes(estados[1]), `estados: ${estados}`);
    // Si la segunda choca, es con la suya: "vuelve a intentarlo", no "esas fechas se acaban de
    // reservar" (4.4).
    const rechazada = respuestas.find((r) => r.status === 409);
    if (rechazada) {
      assert.deepEqual(rechazada.body, {
        error: MENSAJE_OTRA_RESERVA,
        codigo: CODIGO_OTRA_RESERVA
      });
    }
    const pendientes = deAna().filter((r) => r.estado === 'pendiente');
    assert.equal(pendientes.length, 1);
    const abiertas = [...stripe.sesiones].filter(([, estado]) => estado === 'open');
    assert.deepEqual(
      abiertas.map(([id]) => id),
      [pendientes[0].stripe_session_id]
    );
  });

  test('dos clientes a la vez por las mismas fechas: uno reserva y el otro recibe 409 sin pasar por Stripe', async () => {
    const [ana, bea] = await Promise.all([
      reservar(cuerpo()),
      reservar(cuerpo(), { tk: TOKEN_BEA })
    ]);
    assert.deepEqual([ana.status, bea.status].sort(), [200, 409]);
    assert.equal(creaciones().length, 1);
    assert.equal(filas().filter((r) => r.estado === 'pendiente').length, 1);
  });

  test('un 23P01 se reintenta una vez después de limpiar las caducadas (4.6)', async () => {
    let intentos = 0;
    fake.fallos['reservas.insert'] = () => {
      intentos += 1;
      return intentos === 1 ? { code: '23P01', message: 'conflicting key value' } : null;
    };
    const res = await reservar(cuerpo());
    assert.equal(res.status, 200);
    assert.equal(intentos, 2);
  });

  test('si choca con una provisional suya que otra pestaña acaba de crear: 409 "vuelve a intentarlo"', async () => {
    fake.fallos['reservas.insert'] = () => {
      // Entre el paso 4 y la inserción, otra petición suya deja su provisional por las mismas fechas.
      if (!filas().some((r) => r.id === 'r-otra-pestana')) {
        filas().push(
          reserva({
            id: 'r-otra-pestana',
            estado: 'pendiente',
            cliente_id: ANA,
            expira_en: new Date(Date.now() + 20 * 60_000).toISOString()
          })
        );
      }
      return { code: '23P01', message: 'conflicting key value' };
    };
    const res = await reservar(cuerpo());
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_OTRA_RESERVA, codigo: CODIGO_OTRA_RESERVA });
  });

  test('una provisional suya ya caducada no cuenta: el choque es con otra persona', async () => {
    fake.fallos['reservas.insert'] = () => {
      if (!filas().some((r) => r.id === 'r-caducada')) {
        filas().push(
          reserva({
            id: 'r-caducada',
            mueble_id: VENDIDA,
            estado: 'pendiente',
            cliente_id: ANA,
            expira_en: new Date(Date.now() - 60_000).toISOString()
          })
        );
      }
      return { code: '23P01', message: 'conflicting key value' };
    };
    const res = await reservar(cuerpo());
    assert.deepEqual(res.body, { error: MENSAJE_FECHAS_OCUPADAS });
  });

  test('si vuelve a chocar después de limpiar, es un conflicto de verdad', async () => {
    let intentos = 0;
    fake.fallos['reservas.insert'] = () => {
      intentos += 1;
      return { code: '23P01', message: 'conflicting key value' };
    };
    const res = await reservar(cuerpo());
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: MENSAJE_FECHAS_OCUPADAS });
    assert.equal(intentos, 2);
  });
});

describe('límite de peticiones', () => {
  test('10 intentos por IP cada 15 minutos; el 11 da 429 sin llegar a Stripe', async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await reservar(cuerpo({ acepta_condiciones: false }), { desde: '10.9.9.9' });
      assert.equal(res.status, 400, `el intento ${i} todavía pasa`);
    }
    const res = await reservar(cuerpo(), { desde: '10.9.9.9' });
    assert.equal(res.status, 429);
    assert.deepEqual(res.body, {
      error:
        'Demasiados intentos de reserva seguidos. Espera unos minutos antes de volver a intentarlo.'
    });
    assert.equal(creaciones().length, 0);
  });
});
