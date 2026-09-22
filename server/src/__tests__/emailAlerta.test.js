// Tests de enviarAlertaAdmin (utils/email.js) con Resend sustituido: se comprueba qué se
// enviaría, que el HTML va escapado (los avisos llevan textos escritos por el comprador) y
// que un fallo del proveedor nunca lanza. Este archivo corre en su propio proceso, y
// RESEND_API_KEY se define ANTES de cargar email.js porque el cliente se crea al importarlo.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.RESEND_FROM = 'Nave 5 Test <avisos@example.com>';

const { Resend } = require('resend');
const email = require('../utils/email');

// El cliente de Resend cuelga sus métodos de una instancia; se sustituye el prototipo de la
// clase que los implementa para no salir a la red bajo ningún concepto.
const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);

let enviar;

beforeEach(() => {
  enviar = mock.method(clasePeticiones, 'send', async () => ({ data: { id: 'email_1' }, error: null }));
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
});

afterEach(() => mock.restoreAll());

describe('enviarAlertaAdmin', () => {
  test('envía un solo correo al administrador con el asunto marcado como aviso', async () => {
    await email.enviarAlertaAdmin({ asunto: 'Posible doble venta', detalles: ['Pieza X', 'Sesión cs_1'] });

    assert.equal(enviar.mock.callCount(), 1);
    const envio = enviar.mock.calls[0].arguments[0];
    assert.equal(envio.to, 'admin@example.com');
    assert.equal(envio.from, 'Nave 5 Test <avisos@example.com>');
    assert.equal(envio.subject, '[Aviso] Posible doble venta');
    assert.match(envio.html, /<li[^>]*>Pieza X<\/li>/);
    assert.match(envio.html, /<li[^>]*>Sesión cs_1<\/li>/);
  });

  test('escapa el HTML de los detalles: lo que escribe el comprador no se interpreta como código', async () => {
    await email.enviarAlertaAdmin({
      asunto: 'Aviso <b>importante</b>',
      detalles: ['Comprador: <script>alert(1)</script> & "Cía" <img src=x onerror=alert(2)>']
    });

    const { html } = enviar.mock.calls[0].arguments[0];
    assert.ok(!html.includes('<script>'), 'no debe colarse ninguna etiqueta script');
    assert.ok(!html.includes('<img'), 'no debe colarse ninguna etiqueta img');
    assert.ok(!html.includes('<b>importante</b>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Cía&quot;'));
  });

  test('no lanza si Resend devuelve un error en la respuesta', async () => {
    enviar.mock.mockImplementation(async () => ({ data: null, error: { message: 'dominio no verificado' } }));

    await assert.doesNotReject(email.enviarAlertaAdmin({ asunto: 'Aviso', detalles: ['x'] }));
  });

  test('no lanza si Resend lanza una excepción', async () => {
    enviar.mock.mockImplementation(async () => { throw new Error('sin red'); });

    await assert.doesNotReject(email.enviarAlertaAdmin({ asunto: 'Aviso', detalles: ['x'] }));
  });

  test('acepta que no haya detalles', async () => {
    await email.enviarAlertaAdmin({ asunto: 'Solo asunto' });

    assert.equal(enviar.mock.callCount(), 1);
  });
});
