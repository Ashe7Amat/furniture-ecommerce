// Tests del modo "simulación" de utils/email.js (tarea 5): sin RESEND_API_KEY configurada, el
// módulo crea `resend = null` al cargarse, y cada función debe limitarse a loguear en vez de
// intentar enviar nada (ni lanzar). Archivo propio porque `resend` se decide UNA VEZ, al
// cargar el módulo -- tiene que quedar sin definir ANTES del primer require de email.js, y
// node --test aísla cada archivo en su propio proceso, así que esto no afecta a los demás tests
// (que sí necesitan RESEND_API_KEY presente).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

delete process.env.RESEND_API_KEY;
process.env.ADMIN_EMAIL = 'admin@example.com';

const email = require('../utils/email');

let logs;
beforeEach(() => {
  logs = [];
  mock.method(console, 'log', (...args) => logs.push(args.join(' ')));
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

describe('Sin RESEND_API_KEY, cada función solo simula (loguea) y no lanza', () => {
  test('enviarNotificacionVenta', async () => {
    await assert.doesNotReject(email.enviarNotificacionVenta({ items: [], clienteInfo: {}, total: 10 }));
    assert.ok(logs.some((l) => l.includes('SIMULACIÓN')));
  });

  test('enviarConfirmacionCliente (con email de cliente, para llegar al bloque de simulación)', async () => {
    await assert.doesNotReject(
      email.enviarConfirmacionCliente({ items: [], clienteInfo: { email: 'x@example.com' }, total: 10 })
    );
    assert.ok(logs.some((l) => l.includes('SIMULACIÓN')));
  });

  test('enviarEmailBienvenida', async () => {
    await assert.doesNotReject(email.enviarEmailBienvenida('x@example.com', 'Ana'));
    assert.ok(logs.some((l) => l.includes('SIMULACIÓN')));
  });

  test('enviarMensajeContacto devuelve true (se considera "enviado" en simulación)', async () => {
    const resultado = await email.enviarMensajeContacto({ nombre: 'Ana', email: 'a@example.com', mensaje: 'Hola' });
    assert.equal(resultado, true);
    assert.ok(logs.some((l) => l.includes('SIMULACIÓN')));
  });

  test('enviarAlertaAdmin', async () => {
    await assert.doesNotReject(email.enviarAlertaAdmin({ asunto: 'Prueba', detalles: ['x'] }));
    assert.ok(logs.some((l) => l.includes('SIMULACIÓN')));
  });
});
