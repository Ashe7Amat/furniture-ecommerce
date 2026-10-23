// Tests de los dos correos de las reservas por fechas (utils/email.js): la confirmación al cliente y
// el aviso de que su pago no pudo confirmar la reserva. Misma maqueta que los demás correos al
// cliente, con todo lo que escribe el cliente escapado y una versión en texto plano.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.RESEND_FROM = 'Nave 5 Test <avisos@example.com>';

const { Resend } = require('resend');
const email = require('../utils/email');

const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);

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

const enviado = () => enviar.mock.calls[0].arguments[0];

const reserva = (cambios = {}) => ({
  pedidoId: 'a1b2c3d4-0000-4000-8000-000000000000',
  pieza: 'Silla <Thonet>',
  fechaInicio: '2026-11-02',
  horaEntrega: '10:00',
  fechaFin: '2026-11-05',
  horaRecogida: '18:30',
  dias: 4,
  modoEntrega: 'domicilio',
  modoRecogida: 'tienda',
  direccion: 'Calle Mayor 15 & 17, Barcelona',
  total: 100,
  ...cambios
});

describe('confirmación de la reserva', () => {
  test('al email de la cuenta, con la pieza en el asunto', async () => {
    await email.enviarConfirmacionReserva({
      email: 'ana@ejemplo.com',
      nombre: 'Ana',
      reserva: reserva()
    });
    const { to, from, subject } = enviado();
    assert.equal(to, 'ana@ejemplo.com');
    assert.equal(from, 'Nave 5 Test <avisos@example.com>');
    assert.equal(subject, 'Reserva confirmada: Silla <Thonet>');
  });

  test('las fechas, las horas, los trayectos, la duración y el total, en HTML y en texto', async () => {
    await email.enviarConfirmacionReserva({
      email: 'ana@ejemplo.com',
      nombre: 'Ana',
      reserva: reserva()
    });
    const { html, text } = enviado();
    for (const contenido of [html, text]) {
      assert.match(contenido, /#A1B2C3D4/);
      assert.match(contenido, /02\/11\/2026 a las 10:00, a domicilio/);
      assert.match(contenido, /05\/11\/2026 a las 18:30, en la tienda/);
      assert.match(contenido, /4 días/);
      assert.match(contenido, /100,00 € \(IVA incluido\)/);
    }
    assert.match(text, /^Tu reserva está confirmada$/m);
    assert.match(text, /^Dirección: Calle Mayor 15 & 17, Barcelona$/m);
  });

  test('lo que escribe el cliente va escapado en el HTML', async () => {
    await email.enviarConfirmacionReserva({
      email: 'ana@ejemplo.com',
      nombre: '<b>Ana</b>',
      reserva: reserva()
    });
    const { html } = enviado();
    assert.doesNotMatch(html, /<b>Ana<\/b>/);
    assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;/);
    assert.match(html, /Silla &lt;Thonet&gt;/);
    assert.match(html, /Calle Mayor 15 &amp; 17/);
  });

  test('un solo día va en singular, y sin dirección no sale la fila', async () => {
    await email.enviarConfirmacionReserva({
      email: 'ana@ejemplo.com',
      nombre: 'Ana',
      reserva: reserva({ dias: 1, direccion: null, modoEntrega: 'tienda' })
    });
    const { text } = enviado();
    assert.match(text, /^Duración: 1 día$/m);
    assert.doesNotMatch(text, /Dirección/);
  });
});

describe('reserva que no se pudo confirmar', () => {
  test('le dice al cliente que se le devolverá el importe completo', async () => {
    await email.enviarConflictoReserva({
      email: 'ana@ejemplo.com',
      nombre: 'Ana',
      reserva: reserva({ total: 75.5 })
    });
    const { to, subject, html, text } = enviado();
    assert.equal(to, 'ana@ejemplo.com');
    assert.equal(subject, 'No hemos podido confirmar tu reserva');
    assert.match(text, /Hemos recibido tu pago por Silla <Thonet>/);
    assert.match(text, /Te devolveremos el importe completo \(75,50 €\) en la misma tarjeta/);
    assert.match(html, /Silla &lt;Thonet&gt;/);
  });

  test('sin RESEND_API_KEY no se envía, y en el log no queda ningún dato del cliente', async () => {
    const clave = process.env.RESEND_API_KEY;
    delete require.cache[require.resolve('../utils/email')];
    delete process.env.RESEND_API_KEY;
    try {
      const simulado = require('../utils/email');
      const log = mock.method(console, 'log', () => {});
      await simulado.enviarConflictoReserva({
        email: 'ana@ejemplo.com',
        nombre: 'Ana',
        reserva: reserva()
      });
      assert.equal(enviar.mock.callCount(), 0);
      const escrito = log.mock.calls.map((c) => c.arguments.join(' ')).join('\n');
      assert.doesNotMatch(escrito, /ana@ejemplo\.com/);
    } finally {
      process.env.RESEND_API_KEY = clave;
      delete require.cache[require.resolve('../utils/email')];
    }
  });
});
