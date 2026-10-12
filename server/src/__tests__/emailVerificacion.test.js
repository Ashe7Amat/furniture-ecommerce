// Tests de los correos de la verificación del email (H18, docs/verificacion-email-diseno.md, parte
// 3): destinatario, asunto, enlace y textos clave, que el nombre se escapa, y que un fallo de Resend
// nunca lanza. Sin comprobar el HTML completo (frágil).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.RESEND_FROM = 'Nave 5 Test <avisos@example.com>';

const { Resend } = require('resend');
const email = require('../utils/email');

const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);
const URL_ENLACE = 'https://tienda.example.com/verificar-email?token=abc&x=1';
const XSS = '<script>alert(1)</script>';

let enviar;
let registroErrores;
beforeEach(() => {
  enviar = mock.method(clasePeticiones, 'send', async () => ({
    data: { id: 'email_1' },
    error: null
  }));
  mock.method(console, 'log', () => {});
  registroErrores = mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

const enviado = () => enviar.mock.calls[0].arguments[0];

describe('1. confirmar el email (registro)', () => {
  test('va al email de la cuenta, con el asunto del diseño y el enlace en el botón y en el texto', async () => {
    await email.enviarConfirmarRegistro({
      email: 'ana@example.com',
      nombre: 'Ana',
      url: URL_ENLACE
    });

    const { to, from, subject, html, text } = enviado();
    assert.equal(to, 'ana@example.com');
    assert.equal(from, 'Nave 5 Test <avisos@example.com>');
    assert.equal(subject, 'Confirma tu email y bienvenido a Nave 5 Barcelona');
    assert.ok(html.includes('href="https://tienda.example.com/verificar-email?token=abc&amp;x=1"'));
    assert.match(html, /Confirmar mi email/);
    assert.match(html, /caduca en 24 horas/);
    assert.match(
      text,
      /Confirmar mi email: https:\/\/tienda\.example\.com\/verificar-email\?token=abc&x=1/
    );
    assert.match(text, /Si no has creado tú esta cuenta, ignora este correo/);
  });

  test('escapa el nombre', async () => {
    await email.enviarConfirmarRegistro({ email: 'a@example.com', nombre: XSS, url: URL_ENLACE });
    assert.ok(!enviado().html.includes('<script>'));
  });
});

describe('2. cuenta activada', () => {
  test('es el de bienvenida con la última frase cambiada', async () => {
    await email.enviarCuentaActivada({ email: 'ana@example.com', nombre: 'Ana' });

    const { to, subject, html, text } = enviado();
    assert.equal(to, 'ana@example.com');
    assert.equal(subject, 'Tu cuenta de Nave 5 Barcelona ya está activa 🤎');
    assert.match(html, /Ya puedes ver tu historial de compras en Mi cuenta/);
    assert.ok(!html.includes('A partir de ahora tienes acceso'), 'la frase de antes no sale');
    assert.match(text, /Ya puedes ver tu historial de compras/);
  });
});

describe('3. confirmar el email nuevo', () => {
  test('va a la dirección nueva y dice que la cuenta sigue con la anterior', async () => {
    await email.enviarConfirmarCambioEmail({
      email: 'ana.nueva@example.com',
      nombre: 'Ana',
      url: URL_ENLACE
    });

    const { to, subject, html, text } = enviado();
    assert.equal(to, 'ana.nueva@example.com');
    assert.equal(subject, 'Confirma tu nuevo email en Nave 5 Barcelona');
    assert.match(html, /Confirmar el nuevo email/);
    assert.match(html, /sigue usando el email anterior/);
    assert.match(text, /Confirmar el nuevo email: https:/);
  });
});

describe('4. aviso al email antiguo', () => {
  test('va al antiguo, con el nuevo medio oculto', async () => {
    await email.enviarAvisoCambioEmail({
      email: 'ana@example.com',
      nombre: 'Ana',
      emailNuevo: 'alberto@gmail.com'
    });

    const { to, subject, html, text } = enviado();
    assert.equal(to, 'ana@example.com');
    assert.equal(subject, 'Se ha pedido cambiar el email de tu cuenta');
    assert.match(html, /a\*\*\*@gmail\.com/);
    assert.ok(!html.includes('alberto'), 'el email nuevo no sale entero');
    assert.match(text, /a\*\*\*@gmail\.com/);
  });

  test('ocultarEmail', () => {
    assert.equal(email.ocultarEmail('ana@gmail.com'), 'a***@gmail.com');
    assert.equal(email.ocultarEmail('x@y.z'), 'x***@y.z');
    assert.equal(email.ocultarEmail('sin-arroba'), '***');
    assert.equal(email.ocultarEmail('@solo-dominio'), '***');
    assert.equal(email.ocultarEmail(undefined), '***');
  });
});

describe('5. cuenta protegida', () => {
  test('explica que se anuló la contraseña y se cerraron las sesiones', async () => {
    await email.enviarCuentaProtegida({ email: 'ana@example.com', nombre: 'Ana' });

    const { to, subject, html, text } = enviado();
    assert.equal(to, 'ana@example.com');
    assert.equal(subject, 'Hemos protegido tu cuenta de Nave 5 Barcelona');
    assert.match(html, /hemos anulado esa contraseña y cerrado las demás sesiones/);
    assert.match(text, /A partir de ahora, entra con Google/);
    // No hay forma de pedir una contraseña nueva: el correo no lo promete, ni en texto ni en HTML.
    for (const cuerpo of [text, html]) {
      assert.doesNotMatch(cuerpo, /p[ií]de(la)?|contraseña nueva|nueva contraseña|restablec/i);
    }
  });
});

describe('si Resend falla, no lanza y lo deja en el log', () => {
  const casos = [
    () => email.enviarConfirmarRegistro({ email: 'a@example.com', nombre: 'A', url: URL_ENLACE }),
    () => email.enviarCuentaActivada({ email: 'a@example.com', nombre: 'A' }),
    () =>
      email.enviarConfirmarCambioEmail({ email: 'a@example.com', nombre: 'A', url: URL_ENLACE }),
    () =>
      email.enviarAvisoCambioEmail({ email: 'a@example.com', nombre: 'A', emailNuevo: 'b@c.d' }),
    () => email.enviarCuentaProtegida({ email: 'a@example.com', nombre: 'A' })
  ];

  test('Resend devuelve un error', async () => {
    enviar.mock.mockImplementation(async () => ({ data: null, error: { message: 'dominio' } }));
    for (const caso of casos) await assert.doesNotReject(caso());
    assert.equal(registroErrores.mock.callCount(), casos.length);
  });

  test('Resend lanza', async () => {
    enviar.mock.mockImplementation(async () => {
      throw new Error('red caída');
    });
    for (const caso of casos) await assert.doesNotReject(caso());
    assert.equal(registroErrores.mock.callCount(), casos.length);
    assert.ok(registroErrores.mock.calls.every((c) => c.arguments[1] === 'red caída'));
  });

  test('un error sin message también se registra', async () => {
    enviar.mock.mockImplementation(async () => {
      throw 'texto suelto'; // eslint-disable-line no-throw-literal
    });
    await assert.doesNotReject(casos[0]());
    assert.equal(registroErrores.mock.calls[0].arguments[1], 'texto suelto');
  });
});
