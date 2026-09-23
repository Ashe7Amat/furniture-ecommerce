// Tests de utils/email.js (tarea 5): asunto, destinatario y campos de cada función de envío.
// El escape de HTML ya está cubierto en emailEscape.test.js/emailAlerta.test.js -- este archivo
// se centra en lo que pide la tarea 5: a quién se envía, con qué asunto, y que las variables
// esperadas (nombre, total, piezas...) llegan tal cual, SIN comprobar el HTML completo (frágil).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.RESEND_FROM = 'Nave 5 Test <avisos@example.com>';

const { Resend } = require('resend');
const email = require('../utils/email');

const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);

let enviar;
beforeEach(() => {
  enviar = mock.method(clasePeticiones, 'send', async () => ({ data: { id: 'email_1' }, error: null }));
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
});
afterEach(() => mock.restoreAll());

describe('enviarNotificacionVenta', () => {
  test('envía siempre al ADMIN_EMAIL, nunca al comprador', async () => {
    await email.enviarNotificacionVenta({
      items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 50 }],
      clienteInfo: { email: 'comprador@example.com' },
      total: 50
    });
    assert.equal(enviar.mock.calls[0].arguments[0].to, 'admin@example.com');
  });

  test('el asunto lleva el total formateado con 2 decimales', async () => {
    await email.enviarNotificacionVenta({
      items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 49.9 }],
      clienteInfo: {},
      total: 49.9
    });
    assert.equal(enviar.mock.calls[0].arguments[0].subject, 'Nueva venta en Nave 5 Barcelona - 49.90 €');
  });

  test('sin total explícito, se calcula sumando precio × cantidad de cada pieza', async () => {
    await email.enviarNotificacionVenta({
      items: [
        { nombre: 'Silla', modalidad: 'compra', cantidad: 2, precio: 30 },
        { nombre: 'Mesa', modalidad: 'compra', cantidad: 1, precio: 40 }
      ],
      clienteInfo: {}
    });
    // 2*30 + 1*40 = 100
    assert.equal(enviar.mock.calls[0].arguments[0].subject, 'Nueva venta en Nave 5 Barcelona - 100.00 €');
  });

  test('el HTML menciona el nombre de cada pieza y el total (sin comprobar el HTML entero)', async () => {
    await email.enviarNotificacionVenta({
      items: [{ nombre: 'Baúl de viaje', modalidad: 'compra', cantidad: 1, precio: 110 }],
      clienteInfo: { nombre: 'Ana' },
      total: 110
    });
    const { html } = enviar.mock.calls[0].arguments[0];
    assert.match(html, /Baúl de viaje/);
    assert.match(html, /Ana/);
    assert.match(html, /110\.00\s*€/);
  });

  test('una pieza de alquiler añade "(alquiler / día)" junto al nombre', async () => {
    await email.enviarNotificacionVenta({
      items: [{ nombre: 'Silla', modalidad: 'alquiler', cantidad: 1, precio: 8 }],
      clienteInfo: {},
      total: 8
    });
    assert.match(enviar.mock.calls[0].arguments[0].html, /Silla\s*\(alquiler \/ día\)/);
  });
});

describe('enviarConfirmacionCliente', () => {
  test('envía al email del cliente, no al admin', async () => {
    await email.enviarConfirmacionCliente({
      items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 50 }],
      clienteInfo: { email: 'comprador@example.com' },
      total: 50
    });
    assert.equal(enviar.mock.calls[0].arguments[0].to, 'comprador@example.com');
  });

  test('el asunto es siempre el mismo, fijo', async () => {
    await email.enviarConfirmacionCliente({
      items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 50 }],
      clienteInfo: { email: 'x@example.com' },
      total: 50
    });
    assert.equal(enviar.mock.calls[0].arguments[0].subject, 'Hemos recibido tu pedido - Nave 5 Barcelona');
  });

  test('sin email de cliente, no se envía nada (ni se lanza)', async () => {
    await assert.doesNotReject(
      email.enviarConfirmacionCliente({ items: [], clienteInfo: {}, total: 0 })
    );
    assert.equal(enviar.mock.callCount(), 0);
  });

  test('sin total explícito, se calcula desde los items', async () => {
    await email.enviarConfirmacionCliente({
      items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 3, precio: 10 }],
      clienteInfo: { email: 'x@example.com' }
    });
    assert.match(enviar.mock.calls[0].arguments[0].html, /30\.00\s*€/);
  });
});

describe('enviarEmailBienvenida', () => {
  test('envía al email pasado como primer argumento, con el nombre en el cuerpo', async () => {
    await email.enviarEmailBienvenida('nueva@example.com', 'María');
    const envio = enviar.mock.calls[0].arguments[0];
    assert.equal(envio.to, 'nueva@example.com');
    assert.match(envio.subject, /bienvenida/i);
    assert.match(envio.html, /María/);
  });
});

describe('enviarMensajeContacto', () => {
  test('envía al ADMIN_EMAIL con replyTo puesto al email de quien escribió, y asunto con su nombre', async () => {
    const resultado = await email.enviarMensajeContacto({ nombre: 'Carlos', email: 'carlos@example.com', mensaje: 'Hola' });
    const envio = enviar.mock.calls[0].arguments[0];
    assert.equal(envio.to, 'admin@example.com');
    assert.equal(envio.replyTo, 'carlos@example.com');
    assert.equal(envio.subject, 'Nuevo mensaje de contacto — Carlos');
    assert.equal(resultado, true);
  });

  test('devuelve false (no lanza) si Resend responde con error', async () => {
    enviar.mock.mockImplementation(async () => ({ data: null, error: { message: 'fallo' } }));
    const resultado = await email.enviarMensajeContacto({ nombre: 'Carlos', email: 'c@example.com', mensaje: 'Hola' });
    assert.equal(resultado, false);
  });

  test('devuelve false (no lanza) si Resend lanza una excepción', async () => {
    enviar.mock.mockImplementation(async () => { throw new Error('sin red'); });
    const resultado = await email.enviarMensajeContacto({ nombre: 'Carlos', email: 'c@example.com', mensaje: 'Hola' });
    assert.equal(resultado, false);
  });
});
