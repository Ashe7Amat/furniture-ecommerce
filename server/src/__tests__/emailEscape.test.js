// H2 del registro de la rama: las plantillas de email insertaban texto del comprador o del
// visitante (nombre, dirección, notas, mensaje...) sin escapar. Este archivo comprueba que las
// CUATRO plantillas afectadas (enviarNotificacionVenta, enviarConfirmacionCliente,
// enviarEmailBienvenida, enviarMensajeContacto) escapan ese texto antes de insertarlo en el HTML
// del correo. Resend está sustituido (se reemplaza el método .send() de su propio prototipo,
// igual que en emailAlerta.test.js) para no enviar nada de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.RESEND_FROM = 'Nave 5 Test <avisos@example.com>';

const { Resend } = require('resend');
const email = require('../utils/email');

const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);
const PAYLOAD_XSS = '<script>alert(1)</script> & "Cía" <img src=x onerror=alert(2)>';

const sinEtiquetasPeligrosas = (html) => {
  assert.ok(!html.includes('<script>'), 'no debe colarse ninguna etiqueta script');
  assert.ok(!html.includes('<img'), 'no debe colarse ninguna etiqueta img');
  assert.ok(html.includes('&lt;script&gt;'), 'el texto original debe seguir presente, escapado');
};

let enviar;
beforeEach(() => {
  enviar = mock.method(clasePeticiones, 'send', async () => ({
    data: { id: 'email_1' },
    error: null
  }));
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

describe('enviarNotificacionVenta — escapa los datos del comprador y de las piezas', () => {
  test('nombre, email, teléfono, dirección y notas del comprador llegan escapados', async () => {
    await email.enviarNotificacionVenta({
      items: [{ nombre: 'Sofá normal', modalidad: 'compra', cantidad: 1, precio: 100 }],
      clienteInfo: {
        nombre: PAYLOAD_XSS,
        email: PAYLOAD_XSS,
        telefono: PAYLOAD_XSS,
        direccion: PAYLOAD_XSS,
        notas: PAYLOAD_XSS,
        metodoPago: 'Tarjeta (Stripe)'
      },
      total: 100
    });

    const { html } = enviar.mock.calls[0].arguments[0];
    sinEtiquetasPeligrosas(html);
  });

  test('el nombre de una pieza del pedido también llega escapado', async () => {
    await email.enviarNotificacionVenta({
      items: [{ nombre: PAYLOAD_XSS, modalidad: 'compra', cantidad: 1, precio: 100 }],
      clienteInfo: { nombre: 'Ana' },
      total: 100
    });

    sinEtiquetasPeligrosas(enviar.mock.calls[0].arguments[0].html);
  });
});

describe('enviarConfirmacionCliente — escapa los datos del comprador y de las piezas', () => {
  test('nombre, dirección y notas llegan escapados (incluida la fila condicional de notas)', async () => {
    await email.enviarConfirmacionCliente({
      items: [{ nombre: PAYLOAD_XSS, modalidad: 'compra', cantidad: 1, precio: 100 }],
      clienteInfo: {
        nombre: PAYLOAD_XSS,
        email: 'ana@example.com',
        direccion: PAYLOAD_XSS,
        notas: PAYLOAD_XSS
      },
      total: 100
    });

    sinEtiquetasPeligrosas(enviar.mock.calls[0].arguments[0].html);
  });
});

describe('enviarEmailBienvenida — escapa el nombre del cliente', () => {
  test('el nombre en el saludo llega escapado', async () => {
    await email.enviarEmailBienvenida('ana@example.com', PAYLOAD_XSS);
    sinEtiquetasPeligrosas(enviar.mock.calls[0].arguments[0].html);
  });
});

describe('enviarMensajeContacto — escapa nombre, email y mensaje', () => {
  test('el nombre, el email y el mensaje del formulario llegan escapados', async () => {
    await email.enviarMensajeContacto({
      nombre: PAYLOAD_XSS,
      email: PAYLOAD_XSS,
      mensaje: PAYLOAD_XSS
    });
    sinEtiquetasPeligrosas(enviar.mock.calls[0].arguments[0].html);
  });
});
