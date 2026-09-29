// Tests del modo "simulación" de utils/email.js (tarea 5): sin RESEND_API_KEY configurada, el
// módulo crea `resend = null` al cargarse, y cada función debe limitarse a loguear en vez de
// intentar enviar nada (ni lanzar). Archivo propio porque `resend` se decide UNA VEZ, al
// cargar el módulo -- tiene que quedar sin definir ANTES del primer require de email.js, y
// node --test aísla cada archivo en su propio proceso, así que esto no afecta a los demás tests
// (que sí necesitan RESEND_API_KEY presente).
//
// CAMBIADO CON H27 (29 sep 2026): antes se comprobaba que el log decía "SIMULACIÓN" y escribía el
// contenido del correo. Ahora escribe solo un aviso, sin ningún dato personal, salvo con
// EMAIL_DEBUG_DATOS=true fuera de producción.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

delete process.env.RESEND_API_KEY;
process.env.ADMIN_EMAIL = 'admin@example.com';

const email = require('../utils/email');

const AVISO = '[email simulado omitido: falta RESEND_API_KEY, contenido con datos personales]';

// Datos personales reconocibles: ninguno debe acabar en el log.
const COMPRADOR = {
  nombre: 'Lucía Ferrer',
  email: 'lucia.ferrer@correo.test',
  telefono: '611223344',
  direccion: 'Carrer de Verdi 12, 08012 Barcelona',
  notas: 'Portal verde, timbre 3º'
};
const DATOS = Object.values(COMPRADOR);
const PEDIDO = {
  items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 50 }],
  clienteInfo: COMPRADOR,
  total: 50
};

// Las cinco funciones, cada una con datos del comprador.
const ENVIOS = [
  ['enviarNotificacionVenta', () => email.enviarNotificacionVenta(PEDIDO)],
  ['enviarConfirmacionCliente', () => email.enviarConfirmacionCliente(PEDIDO)],
  ['enviarEmailBienvenida', () => email.enviarEmailBienvenida(COMPRADOR.email, COMPRADOR.nombre)],
  [
    'enviarMensajeContacto',
    () =>
      email.enviarMensajeContacto({
        nombre: COMPRADOR.nombre,
        email: COMPRADOR.email,
        mensaje: `Llamadme al ${COMPRADOR.telefono}`
      })
  ],
  [
    'enviarAlertaAdmin',
    () =>
      email.enviarAlertaAdmin({
        asunto: 'Pago cobrado sin registrar',
        detalles: [
          `Comprador: ${COMPRADOR.nombre} <${COMPRADOR.email}> · ${COMPRADOR.telefono}`,
          `Dirección de entrega: ${COMPRADOR.direccion}`
        ]
      })
  ]
];

let logs;
const entornoOriginal = { debug: process.env.EMAIL_DEBUG_DATOS, nodeEnv: process.env.NODE_ENV };
beforeEach(() => {
  logs = [];
  mock.method(console, 'log', (...args) => logs.push(args.join(' ')));
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});
afterEach(() => {
  mock.restoreAll();
  for (const [clave, valor] of [
    ['EMAIL_DEBUG_DATOS', entornoOriginal.debug],
    ['NODE_ENV', entornoOriginal.nodeEnv]
  ]) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

describe('Sin RESEND_API_KEY, cada función solo simula (loguea) y no lanza', () => {
  for (const [nombre, enviar] of ENVIOS) {
    test(`${nombre}: no lanza y deja el aviso de correo simulado`, async () => {
      await assert.doesNotReject(enviar());
      assert.ok(logs.some((l) => l.startsWith(AVISO)));
    });
  }

  test('enviarMensajeContacto devuelve true (se considera "enviado" en simulación)', async () => {
    const resultado = await email.enviarMensajeContacto({
      nombre: 'Ana',
      email: 'a@example.com',
      mensaje: 'Hola'
    });
    assert.equal(resultado, true);
  });
});

describe('H27 — el log de la simulación no lleva datos personales', () => {
  for (const [nombre, enviar] of ENVIOS) {
    test(`${nombre}: ni nombre, ni email, ni teléfono, ni dirección, ni notas`, async () => {
      await enviar();

      const todo = logs.join('\n');
      for (const dato of DATOS) assert.ok(!todo.includes(dato), `el log no debe llevar "${dato}"`);
      assert.equal(logs.length, 1, 'una sola línea: el aviso');
    });
  }

  test('el aviso dice de qué correo se trata, sin datos', async () => {
    await email.enviarNotificacionVenta(PEDIDO);
    assert.deepEqual(logs, [`${AVISO} (aviso de venta al administrador)`]);
  });

  test('con EMAIL_DEBUG_DATOS=true fuera de producción, sí se escriben (para depurar en local)', async () => {
    process.env.EMAIL_DEBUG_DATOS = 'true';
    process.env.NODE_ENV = 'development';

    await email.enviarConfirmacionCliente(PEDIDO);

    const todo = logs.join('\n');
    assert.ok(todo.includes(COMPRADOR.email));
    assert.ok(todo.includes(COMPRADOR.direccion));
  });

  test('con EMAIL_DEBUG_DATOS=true en producción, tampoco se escriben', async () => {
    process.env.EMAIL_DEBUG_DATOS = 'true';
    process.env.NODE_ENV = 'production';

    for (const [, enviar] of ENVIOS) await enviar();

    const todo = logs.join('\n');
    for (const dato of DATOS) assert.ok(!todo.includes(dato), `el log no debe llevar "${dato}"`);
  });

  test('EMAIL_DEBUG_DATOS con otro valor que "true" no cuenta', async () => {
    process.env.EMAIL_DEBUG_DATOS = '1';
    process.env.NODE_ENV = 'development';

    await email.enviarMensajeContacto({ nombre: 'Lucía', email: COMPRADOR.email, mensaje: 'Hola' });

    assert.ok(!logs.join('\n').includes(COMPRADOR.email));
  });
});
