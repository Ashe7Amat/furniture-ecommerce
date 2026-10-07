// Tests del diseño de los correos de contacto y de confirmación al comprador (utils/email.js):
// maqueta de tablas con estilos en línea, sin <style> ni <div>, con los datos del mensaje o del
// pedido, el botón cuando toca y una versión en texto plano. No comprueban el HTML entero (frágil).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.RESEND_FROM = 'Nave 5 Test <avisos@example.com>';

const { Resend } = require('resend');
const email = require('../utils/email');

const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);

let enviar;
const urlOriginal = process.env.CLIENT_URL;
beforeEach(() => {
  enviar = mock.method(clasePeticiones, 'send', async () => ({
    data: { id: 'email_1' },
    error: null
  }));
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
  process.env.CLIENT_URL = 'https://www.nave5barcelona.com/';
});
afterEach(() => {
  mock.restoreAll();
  if (urlOriginal === undefined) delete process.env.CLIENT_URL;
  else process.env.CLIENT_URL = urlOriginal;
});

const enviado = () => enviar.mock.calls[0].arguments[0];

// El logo de la cabecera, tal como se subió a Supabase Storage (server/scripts/logo-email.js).
const LOGO =
  'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5.png';
const LOGO_2X =
  'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5@2x.png';

// Comprobaciones de compatibilidad con clientes de correo, comunes a las dos plantillas.
const comprobarMaqueta = (html) => {
  assert.doesNotMatch(html, /<style/i, 'sin <style>: Gmail y Outlook lo ignoran');
  assert.doesNotMatch(html, /<div/i, 'maqueta de tablas, sin divs');
  assert.doesNotMatch(html, /display:\s*(flex|grid)/i);
  assert.match(html, /max-width: 600px/);
  // La única imagen es el logo de la cabecera, con "NAVE 5" de texto alternativo por si el
  // cliente de correo bloquea las imágenes.
  const imagenes = html.match(/<img\b[^>]*>/gi) || [];
  assert.equal(imagenes.length, 1, 'una sola imagen: el logo');
  const [logo] = imagenes;
  assert.match(logo, / alt="NAVE 5"/);
  assert.ok(logo.includes(`src="${LOGO}"`), 'el PNG de 240 px');
  assert.ok(logo.includes(`srcset="${LOGO_2X} 2x"`), 'y el de 480 px para alta densidad');
  assert.match(logo, / width="120"/);
  assert.match(logo, /style="display:block;border:0;outline:none;height:auto;max-width:120px;"/);
  assert.match(
    html,
    /<td style="background-color: #221B16;[^"]*color: #F5F2EC;">\s*<img\b/,
    'en la celda oscura de la cabecera, que da estilo al texto alternativo'
  );
  assert.match(
    html,
    /href="https:\/\/nave5barcelona\.com"[^>]*>nave5barcelona\.com<\/a>/,
    'pie con enlace a la web'
  );
};

describe('enviarMensajeContacto — plantilla', () => {
  const mensaje = {
    nombre: 'Lucía Pérez',
    email: 'lucia+web@correo.test',
    mensaje: '¿Sigue disponible\nla mesa?'
  };

  test('HTML de tablas con el nombre, el email como enlace mailto y el mensaje, sin <style>', async () => {
    await email.enviarMensajeContacto(mensaje);
    const { html } = enviado();

    comprobarMaqueta(html);
    assert.match(html, /Nuevo mensaje desde el formulario de contacto/);
    assert.match(html, /Lucía Pérez/);
    assert.match(
      html,
      /<a href="mailto:lucia%2Bweb@correo\.test\?subject=[^"]+"[^>]*>lucia\+web@correo\.test<\/a>/
    );
    assert.match(html, /¿Sigue disponible\nla mesa\?/);
  });

  test('botón "Responder al cliente" con el mailto y, debajo, la dirección en texto', async () => {
    await email.enviarMensajeContacto(mensaje);
    const { html } = enviado();

    assert.match(
      html,
      /<a href="mailto:lucia%2Bweb@correo\.test\?subject=Re%3A%20tu%20mensaje[^"]*"[^>]*>Responder al cliente<\/a>/
    );
    assert.match(html, /O escribe a lucia\+web@correo\.test/);
  });

  test('versión en texto plano con los mismos datos y el enlace para responder', async () => {
    await email.enviarMensajeContacto(mensaje);
    const { text } = enviado();

    assert.match(text, /Nombre: Lucía Pérez/);
    assert.match(text, /Email: lucia\+web@correo\.test/);
    assert.match(text, /¿Sigue disponible\nla mesa\?/);
    assert.match(text, /Responder al cliente: mailto:lucia%2Bweb@correo\.test/);
    assert.match(text, /nave5barcelona\.com/);
  });

  test('lo que escribe el visitante se escapa, también dentro del mailto', async () => {
    await email.enviarMensajeContacto({
      nombre: '<b>Ana</b>',
      email: 'ana"onmouseover="x@correo.test',
      mensaje: '<script>alert(1)</script>'
    });
    const { html } = enviado();

    assert.doesNotMatch(html, /<script>|<b>Ana/);
    assert.doesNotMatch(
      html,
      /"onmouseover=/,
      'las comillas del email no pueden cerrar el atributo'
    );
  });
});

describe('enviarConfirmacionCliente — plantilla', () => {
  const pedido = (cambios = {}) => ({
    id: 'a1b2c3d4-0000-5000-8000-000000000000',
    items: [
      {
        nombre: 'Silla Tolix',
        modalidad: 'compra',
        cantidad: 1,
        precio: 120,
        referencia: 'NAV-SIL-001'
      },
      { nombre: 'Butaca de cine', modalidad: 'alquiler', cantidad: 1, precio: 40, referencia: null }
    ],
    clienteInfo: { nombre: 'Ana', email: 'ana@correo.test', direccion: 'Calle Falsa 123' },
    total: 160,
    fecha: '2026-10-05T10:00:00Z',
    conCuenta: true,
    ...cambios
  });

  test('título, nombre del cliente, referencia del pedido, piezas con su referencia y total, sin <style>', async () => {
    await email.enviarConfirmacionCliente(pedido());
    const { html } = enviado();

    comprobarMaqueta(html);
    assert.match(html, /Tu pedido está confirmado/);
    assert.match(html, /¡Gracias por tu compra, Ana!/);
    assert.match(html, /#A1B2C3D4/, 'la misma referencia corta que en "Mis pedidos"');
    assert.match(html, /Silla Tolix/);
    assert.match(html, /Ref\. NAV-SIL-001/);
    assert.match(html, /Butaca de cine \(alquiler \/ día\)/);
    assert.match(html, /160\.00 €/);
    assert.match(html, /Calle Falsa 123/);
  });

  test('con cuenta y CLIENT_URL: botón "Ver mi pedido" a /cuenta?tab=pedidos, con la URL también en texto', async () => {
    await email.enviarConfirmacionCliente(pedido());
    const { html, text } = enviado();

    assert.match(
      html,
      /<a href="https:\/\/www\.nave5barcelona\.com\/cuenta\?tab=pedidos"[^>]*>Ver mi pedido<\/a>/
    );
    assert.match(
      html,
      /Si el botón no funciona, entra en https:\/\/www\.nave5barcelona\.com\/cuenta\?tab=pedidos/
    );
    assert.match(text, /Ver mi pedido: https:\/\/www\.nave5barcelona\.com\/cuenta\?tab=pedidos/);
  });

  test('sin cuenta (compra como invitado), no hay botón: "Mis pedidos" pide iniciar sesión', async () => {
    await email.enviarConfirmacionCliente(pedido({ conCuenta: false }));
    assert.doesNotMatch(enviado().html, /Ver mi pedido/);
    assert.doesNotMatch(enviado().text, /Ver mi pedido/);
  });

  test('sin CLIENT_URL (o sin http/https), no hay botón', async () => {
    delete process.env.CLIENT_URL;
    await email.enviarConfirmacionCliente(pedido());
    process.env.CLIENT_URL = 'javascript:alert(1)';
    await email.enviarConfirmacionCliente(pedido());

    for (const llamada of enviar.mock.calls) {
      assert.doesNotMatch(llamada.arguments[0].html, /Ver mi pedido/);
    }
  });

  test('sin id de pedido no sale la fila de referencia; las notas solo si hay', async () => {
    await email.enviarConfirmacionCliente(
      pedido({
        id: undefined,
        clienteInfo: { nombre: 'Ana', email: 'ana@correo.test', notas: 'Llamar antes' }
      })
    );
    const { html, text } = enviado();

    assert.doesNotMatch(html, />Pedido</);
    assert.match(html, /Llamar antes/);
    assert.match(html, /Dirección no provista/);
    assert.match(text, /Notas: Llamar antes/);
    assert.doesNotMatch(text, /Pedido: #/);
  });

  test('versión en texto plano con la referencia, las piezas y el total', async () => {
    await email.enviarConfirmacionCliente(pedido());
    const { text } = enviado();

    assert.match(text, /Tu pedido está confirmado/);
    assert.match(text, /Pedido: #A1B2C3D4/);
    assert.match(text, /- Silla Tolix \[Ref\. NAV-SIL-001\]: 1 x 120\.00 €/);
    assert.match(text, /- Butaca de cine \(alquiler \/ día\): 1 x 40\.00 €/);
    assert.match(text, /Total: 160\.00 €/);
    assert.match(text, /Envío a: Calle Falsa 123/);
  });
});
