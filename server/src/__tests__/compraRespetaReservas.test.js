// La compra respeta las reservas (docs/reservas-diseno.md, 6.7; paso 9 del bloque R-b). Dos sitios:
//   - antes de cobrar (crear-sesion-pago): no se cobra una pieza que tiene algo en el calendario de
//     hoy en adelante, con la misma definición que la ficha;
//   - al confirmar el pago (utils/pagos.js): cada pieza comprada deja su fila de venta antes de
//     marcarse como vendida, y si el calendario no la admite hay conflicto con aviso, nunca una venta
//     silenciosa.
// Incluye los tests obligatorios del 6.7. Supabase, Stripe y los emails son dobles; el doble emula la
// restricción de exclusión y la unicidad en el mismo orden que Postgres.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad
process.env.CLIENT_URL = 'https://tienda.example.com';
// Cada petición llega desde una IP distinta (X-Forwarded-For, que solo se lee con VERCEL=1) y con otro
// email, para que los límites de intentos de pago no se mezclen con lo que se prueba aquí.
process.env.VERCEL = '1';
process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
const tokenAdmin = () =>
  jwt.sign({ email: 'admin@test.com', nombre: 'Admin', rol: 'admin' }, process.env.JWT_SECRET);

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const stripeUtil = require('../utils/stripe');
const { procesarSesionPagada } = require('../utils/pagos');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { MUEBLES_DE_PRUEBA, crearSesion } = require('./helpers/stripeFixtures');
const { hoyEnMadrid, sumarDias, fechaLegible } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const ANA = '00000000-0000-4000-8000-0000000000a1';

let fake;
let correos;
let crearSesionDeStripe;
let registroErrores;

const instalar = ({ reservas = [], muebles = MUEBLES_DE_PRUEBA() } = {}) => {
  fake = crearFakeSupabase({ muebles, reservas });
  mock.method(supabase, 'from', fake.from);
};

beforeEach(() => {
  correos = {
    venta: mock.method(email, 'enviarNotificacionVenta', async () => {}),
    cliente: mock.method(email, 'enviarConfirmacionCliente', async () => {}),
    alerta: mock.method(email, 'enviarAlertaAdmin', async () => {})
  };
  crearSesionDeStripe = mock.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_1' }));
  mock.method(stripeUtil, 'getStripe', () => ({
    checkout: { sessions: { create: crearSesionDeStripe } }
  }));
  registroErrores = mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  instalar();
});

afterEach(() => mock.restoreAll());

// Filas del calendario, como las dejan las reservas, el panel o una compra anterior.
const alquiler = (cambios = {}) => ({
  id: 'r-alquiler',
  mueble_id: 'mueble-1',
  tipo: 'alquiler',
  estado: 'confirmada',
  fecha_inicio: dia(5),
  fecha_fin: dia(8),
  fin_ocupacion: dia(8),
  dias_margen: 2,
  cliente_id: ANA,
  ...cambios
});
const provisional = (cambios = {}) =>
  alquiler({
    id: 'r-provisional',
    estado: 'pendiente',
    expira_en: new Date(Date.now() + 20 * 60_000).toISOString(),
    ...cambios
  });
const bloqueo = (cambios = {}) => ({
  id: 'r-bloqueo',
  mueble_id: 'mueble-1',
  tipo: 'bloqueo',
  estado: 'confirmada',
  fecha_inicio: dia(20),
  fecha_fin: dia(25),
  fin_ocupacion: dia(25),
  dias_margen: 0,
  ...cambios
});
const venta = (cambios = {}) => ({
  id: 'r-venta',
  mueble_id: 'mueble-1',
  tipo: 'venta',
  estado: 'confirmada',
  fecha_inicio: dia(-3),
  stripe_session_id: 'cs_otra',
  ...cambios
});

const comprador = {
  nombre: 'Ana Martínez',
  email: 'ana@ejemplo.com',
  telefono: '600123456',
  direccion: 'Calle Mayor 15, 08001 Barcelona',
  notas: ''
};
let ip = 0;
const pedirPago = (items) => {
  ip += 1;
  return request(app)
    .post('/api/muebles/crear-sesion-pago')
    .set('X-Forwarded-For', `10.2.${Math.floor(ip / 250)}.${(ip % 250) + 1}`)
    .send({ items, clienteInfo: { ...comprador, email: `ana+${ip}@ejemplo.com` } });
};
const comprarSofa = () => pedirPago([{ productId: 'mueble-1', modalidad: 'compra' }]);

const sesionConItems = (items, cambios = {}) => {
  const base = crearSesion();
  return { ...base, metadata: { ...base.metadata, items: JSON.stringify(items) }, ...cambios };
};

const filasDe = (tipo) => fake.tablas.reservas.filter((r) => r.tipo === tipo);
const estadoDe = (id) => fake.tablas.muebles.find((m) => m.id === id).estado;

describe('antes de cobrar: crear-sesion-pago mira el calendario', () => {
  test('con un alquiler confirmado más adelante: 400 con el último día ocupado (margen incluido) y sin llegar a Stripe', async () => {
    instalar({ reservas: [alquiler()] });

    const res = await comprarSofa();

    assert.equal(res.status, 400);
    // Ocupa [día 5, día 10): el último día ocupado es el 9.
    assert.deepEqual(res.body, {
      error: `"Sofá Lumina" tiene reservas o está bloqueada hasta el ${fechaLegible(dia(9))}; no se puede comprar ahora.`
    });
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });

  test('con un bloqueo del administrador, igual', async () => {
    instalar({ reservas: [bloqueo()] });
    const res = await comprarSofa();
    assert.equal(res.status, 400);
    assert.match(res.body.error, new RegExp(`bloqueada hasta el ${fechaLegible(dia(24))};`));
  });

  test('con varias cosas en el calendario, la fecha es la del final de la última', async () => {
    instalar({ reservas: [alquiler(), bloqueo()] });
    const res = await comprarSofa();
    assert.match(res.body.error, new RegExp(`hasta el ${fechaLegible(dia(24))};`));
  });

  test('una provisional en plazo cuenta: alguien la está pagando', async () => {
    instalar({ reservas: [provisional()] });
    assert.equal((await comprarSofa()).status, 400);
  });

  test('una provisional caducada no cuenta: se puede comprar', async () => {
    instalar({
      reservas: [provisional({ expira_en: new Date(Date.now() - 60_000).toISOString() })]
    });
    const res = await comprarSofa();
    assert.equal(res.status, 200);
    assert.equal(crearSesionDeStripe.mock.callCount(), 1);
  });

  test('ni una cancelada, ni una expirada, ni un alquiler que ya terminó, ni las de otra pieza', async () => {
    instalar({
      reservas: [
        alquiler({ id: 'a', estado: 'cancelada' }),
        alquiler({ id: 'b', estado: 'expirada' }),
        // Ocupó hasta ayer, margen incluido: [día -10, hoy).
        alquiler({ id: 'c', fecha_inicio: dia(-10), fecha_fin: dia(-2), fin_ocupacion: dia(-2) }),
        alquiler({ id: 'd', mueble_id: 'mueble-3' })
      ]
    });
    assert.equal((await comprarSofa()).status, 200);
  });

  test('un alquiler que se devuelve hoy con margen sí cuenta hasta que acabe el margen', async () => {
    instalar({
      reservas: [
        alquiler({
          estado: 'devuelta',
          fecha_inicio: dia(-6),
          fecha_fin: dia(-1),
          fin_ocupacion: dia(0)
        })
      ]
    });
    const res = await comprarSofa();
    assert.equal(res.status, 400);
    assert.match(res.body.error, new RegExp(`hasta el ${fechaLegible(dia(1))};`));
  });

  test('con su fila de venta (sin fin): "ya ha sido vendida", aunque muebles.estado no lo diga', async () => {
    instalar({ reservas: [venta()] });
    const res = await comprarSofa();
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error: 'Lo sentimos, la pieza única "Sofá Lumina" ya ha sido vendida.'
    });
  });

  test('en un carrito de varias piezas, el mensaje nombra la ocupada', async () => {
    instalar({ reservas: [alquiler({ mueble_id: 'mueble-3' })] });
    const res = await pedirPago([
      { productId: 'mueble-1', modalidad: 'compra' },
      { productId: 'mueble-3', modalidad: 'compra' }
    ]);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /^"Mesa de comedor" tiene reservas/);
  });

  test('el alquiler por días de la cesta (el flujo antiguo, sin fechas) no mira el calendario', async () => {
    instalar({ reservas: [alquiler({ mueble_id: 'mueble-2' })] });
    const res = await pedirPago([{ productId: 'mueble-2', modalidad: 'alquiler' }]);
    assert.equal(res.status, 200);
  });

  test('si falla la lectura del calendario: 500 genérico y no se cobra nada', async () => {
    fake.fallos['reservas.select'] = { message: 'conexión perdida' };
    const res = await comprarSofa();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'No se pudo iniciar el proceso de pago.' });
    assert.equal(crearSesionDeStripe.mock.callCount(), 0);
  });
});

describe('al confirmar el pago: la fila de venta (6.7)', () => {
  test('sin nada en el calendario: deja su fila de venta, de hoy sin fin, y la pieza vendida', async () => {
    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.deepEqual(resultado.conflictos, []);
    const [fila] = filasDe('venta');
    assert.equal(fake.tablas.reservas.length, 1);
    assert.equal(fila.mueble_id, 'mueble-1');
    assert.equal(fila.estado, 'confirmada');
    assert.equal(fila.fecha_inicio, hoy);
    assert.equal(fila.fecha_fin, undefined);
    assert.equal(fila.rango_ocupado, `[${hoy},)`);
    assert.equal(fila.stripe_session_id, 'cs_test_123');
    assert.equal(fila.origen, 'web');
    assert.equal(estadoDe('mueble-1'), 'vendido');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('la fila de venta va antes que el pedido', async () => {
    await procesarSesionPagada(crearSesion());
    const orden = fake.escrituras.map((e) => `${e.tabla}.${e.accion}`);
    assert.ok(orden.indexOf('reservas.insert') < orden.indexOf('pedidos.insert'), orden.join(', '));
  });

  test('OBLIGATORIO 1: contra un alquiler futuro confirmado, conflicto con aviso y nunca una venta silenciosa', async () => {
    instalar({ reservas: [alquiler()] });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1, 'el pedido se registra');
    assert.equal(filasDe('venta').length, 0, 'sin fila de venta');
    assert.equal(estadoDe('mueble-1'), 'disponible', 'muebles.estado sin tocar');
    assert.equal(fake.tablas.reservas[0].estado, 'confirmada', 'el alquiler sigue');
    assert.equal(correos.alerta.mock.callCount(), 1, 'un solo aviso al administrador');
    const { asunto, detalles } = correos.alerta.mock.calls[0].arguments[0];
    assert.equal(asunto, 'Compra cobrada de una pieza con reservas');
    assert.match(detalles[0], /^"Sofá Lumina" \(mueble-1\): tenía reservas o un bloqueo/);
    assert.ok(detalles.some((d) => /entregársela cuando quede libre/.test(d)));
    assert.equal(resultado.conflictos.length, 1);
    // El comprador recibe su confirmación como hoy; el administrador decide (reembolso o entrega
    // diferida).
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(correos.venta.mock.callCount(), 1);
  });

  test('OBLIGATORIO 2: contra una provisional caducada, se vende (la limpieza la marca expirada antes)', async () => {
    instalar({
      reservas: [provisional({ expira_en: new Date(Date.now() - 60_000).toISOString() })]
    });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.deepEqual(resultado.conflictos, []);
    assert.equal(fake.tablas.reservas.find((r) => r.id === 'r-provisional').estado, 'expirada');
    assert.equal(filasDe('venta').length, 1);
    assert.equal(estadoDe('mueble-1'), 'vendido');
    assert.equal(correos.alerta.mock.callCount(), 0);
    assert.equal(fake.estado.exclusionRechazada, 0, 'entra a la primera, sin conflicto');
  });

  test('OBLIGATORIO 3a: contra un bloqueo del administrador, conflicto', async () => {
    instalar({ reservas: [bloqueo()] });
    await procesarSesionPagada(crearSesion());
    assert.equal(filasDe('venta').length, 0);
    assert.equal(estadoDe('mueble-1'), 'disponible');
    assert.equal(correos.alerta.mock.callCount(), 1);
  });

  test('OBLIGATORIO 3b: un reintento del webhook sobre una venta ya registrada no duplica nada ni da falso conflicto', async () => {
    // El primer intento deja la fila de venta y la pieza vendida, y muere al registrar el pedido.
    fake.fallos['pedidos.insert'] = { message: 'conexión perdida' };
    await assert.rejects(procesarSesionPagada(crearSesion()));
    assert.equal(filasDe('venta').length, 1);
    assert.equal(fake.tablas.pedidos.length, 0);

    delete fake.fallos['pedidos.insert'];
    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.deepEqual(resultado.conflictos, []);
    assert.equal(filasDe('venta').length, 1, 'sigue habiendo una sola');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.alerta.mock.callCount(), 0);
    // Postgres da 23P01 (la venta repetida se solapa con la suya) antes que 23505: es el camino que
    // se ha probado.
    assert.ok(fake.estado.exclusionRechazada >= 1);
  });

  test('si la base de datos devolviera 23505 (la unicidad antes que la exclusión), también es "ya registrada"', async () => {
    fake.fallos['reservas.insert'] = { code: '23505', message: 'duplicate key value' };
    const resultado = await procesarSesionPagada(crearSesion());
    assert.deepEqual(resultado.conflictos, []);
    assert.equal(estadoDe('mueble-1'), 'vendido');
  });

  test('el webhook y la página de éxito a la vez: una sola fila de venta, un solo pedido y ningún aviso', async () => {
    await Promise.all([procesarSesionPagada(crearSesion()), procesarSesionPagada(crearSesion())]);
    assert.equal(filasDe('venta').length, 1);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.alerta.mock.callCount(), 0);
    assert.equal(correos.cliente.mock.callCount(), 1);
  });

  test('otra venta de la misma pieza (otra sesión): la doble venta de siempre, sin proponer entrega diferida', async () => {
    instalar({
      reservas: [venta()],
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'vendido' } : m
      )
    });
    const resultado = await procesarSesionPagada(crearSesion());
    assert.equal(filasDe('venta').length, 1);
    assert.equal(estadoDe('mueble-1'), 'vendido');
    assert.equal(correos.alerta.mock.callCount(), 1);
    const { asunto, detalles } = correos.alerta.mock.calls[0].arguments[0];
    assert.equal(asunto, 'Posible doble venta de una pieza única');
    assert.match(detalles[0], /el calendario ya tenía registrada otra venta de esta pieza/);
    assert.ok(!detalles.some((d) => /cuando quede libre/.test(d)));
    assert.equal(resultado.conflictos[0].enCalendario, false);
  });

  test('dos compradores con la misma pieza abierta: el segundo pago es una doble venta', async () => {
    await procesarSesionPagada(crearSesion({ id: 'cs_A' }));
    await procesarSesionPagada(crearSesion({ id: 'cs_B' }));
    assert.equal(filasDe('venta').length, 1);
    assert.equal(filasDe('venta')[0].stripe_session_id, 'cs_A');
    assert.equal(fake.tablas.pedidos.length, 2);
    assert.equal(correos.alerta.mock.callCount(), 1);
    const { asunto, detalles } = correos.alerta.mock.calls[0].arguments[0];
    assert.equal(asunto, 'Posible doble venta de una pieza única');
    assert.ok(detalles.some((d) => /ya se había vendido en el pedido/.test(d)));
  });

  test('la pieza ya estaba alquilada (alquiler por días de la cesta): doble venta y su fila de venta se cancela', async () => {
    instalar({
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'alquilado' } : m
      )
    });

    const resultado = await procesarSesionPagada(crearSesion());

    const [fila] = filasDe('venta');
    assert.equal(fila.estado, 'cancelada');
    assert.equal(fila.cancelada_por, 'sistema');
    assert.equal(
      fila.motivo_cancelacion,
      'La pieza ya figuraba como "alquilado" cuando se cobró (posible doble venta).'
    );
    assert.deepEqual(
      fila.historial.map((h) => h.tipo),
      ['creada', 'cancelada']
    );
    assert.equal(estadoDe('mueble-1'), 'alquilado');
    const { asunto, detalles } = correos.alerta.mock.calls[0].arguments[0];
    assert.equal(asunto, 'Posible doble venta de una pieza única');
    assert.match(
      detalles[0],
      /ya figuraba como "alquilado".*su venta no se ha dejado en el calendario/
    );
    assert.equal(resultado.conflictos[0].enCalendario, false);

    // Cuando vuelve el alquiler y el administrador la deja disponible, se puede comprar.
    fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado = 'disponible';
    assert.equal((await comprarSofa()).status, 200);
  });

  test('vendida a mano fuera de la web, sin fila ni pedido: como antes de las reservas, no hay señal de doble venta', async () => {
    instalar({
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'vendido' } : m
      )
    });
    // Sin pedido anterior: solo lo dice muebles.estado... que coincide con lo que se busca. Es el caso
    // que ya existía antes de las reservas (H5): sin otra señal no hay aviso, y la fila se queda.
    await procesarSesionPagada(crearSesion());
    assert.equal(filasDe('venta')[0].estado, 'confirmada');
  });

  test('un reintento tras anular la venta no la vuelve a dejar ni repite el aviso', async () => {
    instalar({
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'alquilado' } : m
      )
    });
    await procesarSesionPagada(crearSesion());
    const segundo = await procesarSesionPagada(crearSesion());
    assert.equal(segundo.estado, 'ya_procesada');
    assert.deepEqual(
      filasDe('venta').map((r) => r.estado),
      ['cancelada']
    );
    assert.equal(correos.alerta.mock.callCount(), 1);
  });

  test('si falla al anular la venta, lanza antes de registrar el pedido (Stripe reintenta)', async () => {
    instalar({
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'alquilado' } : m
      )
    });
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos?.estado === 'cancelada' ? { message: 'conexión perdida' } : null;
    await assert.rejects(
      procesarSesionPagada(crearSesion()),
      (e) => e.message === 'conexión perdida'
    );
    assert.equal(fake.tablas.pedidos.length, 0);

    // El reintento la encuentra suya ('ya_registrada') y la anula.
    delete fake.fallos['reservas.update'];
    await procesarSesionPagada(crearSesion());
    assert.equal(filasDe('venta')[0].estado, 'cancelada');
    assert.equal(correos.alerta.mock.callCount(), 1);
  });

  test('si la otra llamada de la misma sesión dejó la venta mientras tanto, no se avisa de un conflicto que no es', async () => {
    instalar({ reservas: [provisional()] });
    // Mientras esta llamada registra el pedido, la provisional caduca y la otra (webhook o página de
    // éxito) deja la venta de esta misma sesión y marca la pieza.
    fake.fallos['pedidos.insert'] = () => {
      fake.tablas.reservas[0].estado = 'expirada';
      fake.tablas.reservas.push({
        id: 'r-venta-gemela',
        mueble_id: 'mueble-1',
        tipo: 'venta',
        estado: 'confirmada',
        fecha_inicio: hoy,
        stripe_session_id: 'cs_test_123'
      });
      fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado = 'vendido';
      return null;
    };

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.deepEqual(resultado.conflictos, []);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('un interbloqueo (40P01) al insertar la venta se reintenta y entra', async () => {
    let veces = 0;
    fake.fallos['reservas.insert'] = () => {
      veces += 1;
      return veces === 1 ? { code: '40P01', message: 'deadlock detected' } : null;
    };
    const resultado = await procesarSesionPagada(crearSesion());
    assert.deepEqual(resultado.conflictos, []);
    assert.equal(filasDe('venta').length, 1);
    assert.equal(estadoDe('mueble-1'), 'vendido');
  });

  test('si el interbloqueo se repite, se mira de quién es la venta, como con un 23P01', async () => {
    instalar({ reservas: [alquiler()] });
    fake.fallos['reservas.insert'] = { code: '40P01', message: 'deadlock detected' };
    const resultado = await procesarSesionPagada(crearSesion());
    assert.equal(resultado.conflictos.length, 1);
    assert.equal(resultado.conflictos[0].enCalendario, true);
  });

  test('compra de dos piezas, una con reservas: la otra se vende y un solo aviso nombra solo la ocupada', async () => {
    instalar({ reservas: [alquiler({ mueble_id: 'mueble-3' })] });

    const resultado = await procesarSesionPagada(
      sesionConItems([
        { productId: 'mueble-1', modalidad: 'compra' },
        { productId: 'mueble-3', modalidad: 'compra' }
      ])
    );

    assert.equal(estadoDe('mueble-1'), 'vendido');
    assert.equal(estadoDe('mueble-3'), 'disponible');
    assert.deepEqual(
      filasDe('venta').map((r) => r.mueble_id),
      ['mueble-1']
    );
    assert.deepEqual(
      resultado.conflictos.map((c) => c.productId),
      ['mueble-3']
    );
    assert.equal(correos.alerta.mock.callCount(), 1);
  });

  test('el alquiler por días de la cesta (flujo antiguo) no deja fila de venta', async () => {
    await procesarSesionPagada(sesionConItems([{ productId: 'mueble-2', modalidad: 'alquiler' }]));
    assert.equal(fake.tablas.reservas.length, 0);
    assert.equal(estadoDe('mueble-2'), 'alquilado');
  });

  test('una pieza que ya no está en el catálogo: el pedido se registra igual, sin fila de venta', async () => {
    const resultado = await procesarSesionPagada(
      sesionConItems([{ productId: 'mueble-borrado', modalidad: 'compra' }])
    );
    assert.equal(resultado.estado, 'procesada');
    assert.equal(fake.tablas.reservas.length, 0);
    assert.equal(fake.tablas.pedidos.length, 1);
  });

  test('si falla la base de datos al insertar la venta: lanza y no registra nada (Stripe reintenta)', async () => {
    fake.fallos['reservas.insert'] = { message: 'conexión perdida' };
    await assert.rejects(
      procesarSesionPagada(crearSesion()),
      (e) => e.message === 'conexión perdida'
    );
    assert.equal(fake.tablas.pedidos.length, 0);
    assert.equal(estadoDe('mueble-1'), 'disponible');
  });

  test('si tras un 23P01 no se puede comprobar si la venta es suya: lanza, sin dar nada por hecho', async () => {
    instalar({ reservas: [alquiler()] });
    fake.fallos['reservas.select'] = { message: 'conexión perdida' };
    await assert.rejects(
      procesarSesionPagada(crearSesion()),
      (e) => e.message === 'conexión perdida'
    );
    assert.equal(fake.tablas.pedidos.length, 0);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('el aviso de doble venta de siempre no cambia si el calendario no tenía nada', async () => {
    instalar({
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'alquilado' } : m
      )
    });
    await procesarSesionPagada(crearSesion());
    assert.equal(
      correos.alerta.mock.calls[0].arguments[0].asunto,
      'Posible doble venta de una pieza única'
    );
    assert.ok(registroErrores.mock.calls.some((c) => /\[ALERTA\]/.test(c.arguments[0])));
  });
});

// Antes de que el estado de la pieza lo derive el calendario (3.3), el administrador lo cambia a mano.
// Si vuelve a poner a la venta una pieza vendida (p. ej. tras reembolsar la compra), su venta del
// calendario se cancela; si no, nadie podría volver a comprarla.
describe('el administrador vuelve a poner a la venta una pieza vendida', () => {
  const comoAdmin = (peticion) => peticion.set('Authorization', `Bearer ${tokenAdmin()}`);
  const ponerEstado = (id, estado) =>
    comoAdmin(request(app).put(`/api/muebles/${id}`)).send({ estado });
  const vendido = () =>
    MUEBLES_DE_PRUEBA().map((m) => (m.id === 'mueble-1' ? { ...m, estado: 'vendido' } : m));

  test('de vendido a disponible: la venta se cancela, con su motivo, y se puede volver a comprar', async () => {
    instalar({ reservas: [venta({ historial: [{ tipo: 'creada' }] })], muebles: vendido() });

    const res = await ponerEstado('mueble-1', 'disponible');

    assert.equal(res.status, 200);
    const [fila] = filasDe('venta');
    assert.equal(fila.estado, 'cancelada');
    assert.equal(fila.cancelada_por, 'admin');
    assert.equal(
      fila.motivo_cancelacion,
      'La pieza se ha vuelto a poner a la venta desde el panel.'
    );
    assert.ok(fila.cancelada_en);
    assert.deepEqual(
      fila.historial.map((h) => h.tipo),
      ['creada', 'cancelada']
    );
    assert.equal(estadoDe('mueble-1'), 'disponible');

    assert.equal((await comprarSofa()).status, 200);
    const resultado = await procesarSesionPagada(crearSesion({ id: 'cs_nueva' }));
    assert.deepEqual(resultado.conflictos, []);
    assert.equal(estadoDe('mueble-1'), 'vendido');
  });

  test('editar una pieza que ya estaba disponible no toca su calendario (una venta con entrega diferida sigue)', async () => {
    instalar({ reservas: [venta({ fecha_inicio: dia(30) })] });
    const res = await ponerEstado('mueble-1', 'disponible');
    assert.equal(res.status, 200);
    assert.equal(filasDe('venta')[0].estado, 'confirmada');
  });

  test('pasar a vendido o a alquilado tampoco', async () => {
    instalar({ reservas: [venta()], muebles: vendido() });
    assert.equal((await ponerEstado('mueble-1', 'alquilado')).status, 200);
    assert.equal(filasDe('venta')[0].estado, 'confirmada');
  });

  test('si falla el calendario, no se cambia el estado: el reintento la vuelve a ver vendida', async () => {
    instalar({ reservas: [venta()], muebles: vendido() });
    fake.fallos['reservas.update'] = { message: 'conexión perdida' };
    const res = await ponerEstado('mueble-1', 'disponible');
    assert.equal(res.status, 500);
    assert.equal(estadoDe('mueble-1'), 'vendido');
    assert.equal(filasDe('venta')[0].estado, 'confirmada');
  });

  test('si falla la lectura del estado anterior: 500 y nada cambia', async () => {
    instalar({ reservas: [venta()], muebles: vendido() });
    fake.fallos['muebles.select'] = { message: 'conexión perdida' };
    assert.equal((await ponerEstado('mueble-1', 'disponible')).status, 500);
    assert.equal(estadoDe('mueble-1'), 'vendido');
    assert.equal(filasDe('venta')[0].estado, 'confirmada');
  });
});

describe('borrar una pieza con filas en el calendario', () => {
  const borrar = (id) =>
    request(app).delete(`/api/muebles/${id}`).set('Authorization', `Bearer ${tokenAdmin()}`);

  test('409 con la explicación, y la pieza sigue (también con la venta cancelada)', async () => {
    instalar({ reservas: [venta({ estado: 'cancelada' })] });
    const res = await borrar('mueble-1');
    assert.equal(res.status, 409);
    assert.equal(
      res.body.error,
      'No se puede borrar: esta pieza tiene ventas o reservas registradas en el calendario, y se guardan como historial.'
    );
    assert.ok(fake.tablas.muebles.some((m) => m.id === 'mueble-1'));
  });

  test('sin nada en el calendario se borra como siempre', async () => {
    instalar({ reservas: [venta({ mueble_id: 'mueble-3' })] });
    const res = await borrar('mueble-1');
    assert.equal(res.status, 200);
    assert.ok(!fake.tablas.muebles.some((m) => m.id === 'mueble-1'));
  });
});
