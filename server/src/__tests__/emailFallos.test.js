// Tests de utils/email.js: qué pasa cuando Resend falla en los correos del pedido y en el de
// bienvenida. Ninguno debe lanzar nunca (un fallo del correo no puede romper el pago ni el
// registro): se registra en el log y se sigue. La alerta al admin y el contacto ya tienen sus
// propios tests de fallos (emailAlerta.test.js y emailCamposYDestinatarios.test.js).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_clave_de_prueba';
process.env.ADMIN_EMAIL = 'admin@example.com';

const { Resend } = require('resend');
const email = require('../utils/email');

const clasePeticiones = Object.getPrototypeOf(new Resend('re_clave_de_prueba').emails);
const PEDIDO = {
  items: [{ nombre: 'Silla', modalidad: 'compra', cantidad: 1, precio: 50 }],
  clienteInfo: { nombre: 'Ana', email: 'ana@example.com' },
  total: 50
};

let registroErrores;
let registroInfo;
beforeEach(() => {
  registroErrores = mock.method(console, 'error', () => {});
  registroInfo = mock.method(console, 'log', () => {});
  mock.method(console, 'warn', () => {});
});
afterEach(() => mock.restoreAll());

const casos = [
  ['enviarNotificacionVenta', () => email.enviarNotificacionVenta(PEDIDO), /notificación de venta/],
  [
    'enviarConfirmacionCliente',
    () => email.enviarConfirmacionCliente(PEDIDO),
    /confirmación al cliente/
  ],
  [
    'enviarEmailBienvenida',
    () => email.enviarEmailBienvenida('ana@example.com', 'Ana'),
    /bienvenida/
  ]
];

for (const [nombre, enviarCorreo, textoDelLog] of casos) {
  describe(`${nombre} — si Resend falla, no lanza y lo deja en el log`, () => {
    test('Resend responde con un error (no lanza: lo devuelve en la respuesta)', async () => {
      mock.method(clasePeticiones, 'send', async () => ({
        data: null,
        error: { message: 'dominio no verificado' }
      }));

      await assert.doesNotReject(enviarCorreo());

      assert.equal(registroErrores.mock.callCount(), 1);
      assert.match(registroErrores.mock.calls[0].arguments[0], textoDelLog);
      assert.deepEqual(registroErrores.mock.calls[0].arguments[1], {
        message: 'dominio no verificado'
      });
      assert.equal(registroInfo.mock.callCount(), 0, 'no dice que se ha enviado');
    });

    test('Resend lanza (p. ej. sin red)', async () => {
      mock.method(clasePeticiones, 'send', async () => {
        throw new Error('sin red');
      });

      await assert.doesNotReject(enviarCorreo());

      assert.equal(registroErrores.mock.callCount(), 1);
      assert.match(registroErrores.mock.calls[0].arguments[0], textoDelLog);
      assert.equal(registroErrores.mock.calls[0].arguments[1], 'sin red');
    });

    test('si va bien, deja en el log el id que da Resend', async () => {
      mock.method(clasePeticiones, 'send', async () => ({ data: { id: 'email_42' }, error: null }));

      await enviarCorreo();

      assert.equal(registroErrores.mock.callCount(), 0);
      assert.equal(registroInfo.mock.calls.at(-1).arguments[1], 'email_42');
    });
  });
}
