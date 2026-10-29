// Tests de los correos del resto del ciclo de la reserva (utils/email.js; R-e, paso 20): los
// recordatorios de entrega y devolución, el aviso de retraso, la cancelación y el reembolso. Misma
// maqueta que los demás correos al cliente, con todo lo que escribe el cliente escapado y una versión
// en texto plano. Resend es un mock: no se envía nada.
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
  modoEntrega: 'domicilio',
  modoRecogida: 'tienda',
  direccion: 'Calle Mayor 15 & 17, Barcelona',
  ...cambios
});
const datos = (cambios = {}, extra = {}) => ({
  email: 'ana@ejemplo.com',
  nombre: 'Ana <b>',
  reserva: reserva(cambios),
  ...extra
});

// Lo común a todos: destinatario, remitente, nombre y pieza escapados, referencia y texto plano.
const comprobarComun = ({ to, from, html, text }) => {
  assert.equal(to, 'ana@ejemplo.com');
  assert.equal(from, 'Nave 5 Test <avisos@example.com>');
  assert.ok(html.includes('Ana &lt;b&gt;'), 'el nombre va escapado');
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('Silla &lt;Thonet&gt;'), 'la pieza va escapada');
  assert.ok(!html.includes('<Thonet>'));
  assert.ok(html.includes('#A1B2C3D4'), 'la referencia de la reserva');
  assert.ok(text.startsWith('NAVE 5'));
  assert.ok(text.includes('Silla <Thonet>'));
  assert.ok(text.includes('Reserva: #A1B2C3D4'));
};

describe('recordatorio de entrega', () => {
  test('a domicilio: cuándo se lleva y a qué dirección, con la devolución', async () => {
    await email.enviarRecordatorioEntrega(datos());
    const correo = enviado();
    comprobarComun(correo);
    assert.equal(correo.subject, 'Recordatorio: Silla <Thonet>, el 02/11/2026 a las 10:00');
    assert.ok(
      correo.text.includes(
        'Te llevaremos Silla <Thonet> el 02/11/2026 a las 10:00 a la dirección que nos diste.'
      )
    );
    assert.ok(correo.text.includes('Entrega: 02/11/2026 a las 10:00, a domicilio'));
    assert.ok(correo.text.includes('Dirección: Calle Mayor 15 & 17, Barcelona'));
    assert.ok(correo.html.includes('Calle Mayor 15 &amp; 17'));
    assert.ok(correo.text.includes('Devolución: 05/11/2026 a las 18:30, en la tienda'));
  });

  test('en la tienda: le esperamos para recogerla, sin dirección', async () => {
    await email.enviarRecordatorioEntrega(datos({ modoEntrega: 'tienda', direccion: null }));
    const { text } = enviado();
    assert.ok(
      text.includes(
        'Te esperamos en la tienda el 02/11/2026 a las 10:00 para que recojas Silla <Thonet>.'
      )
    );
    assert.ok(text.includes('Entrega: 02/11/2026 a las 10:00, en la tienda'));
    assert.ok(!text.includes('Dirección:'));
  });

  test('sin pedido (un alta manual): sin la fila de la referencia', async () => {
    await email.enviarRecordatorioEntrega(datos({ pedidoId: null }));
    assert.ok(!enviado().text.includes('Reserva:'));
  });
});

describe('recordatorio de devolución', () => {
  test('en la tienda: cuándo hay que devolverla, y cómo alargar el alquiler', async () => {
    await email.enviarRecordatorioRecogida(datos());
    const correo = enviado();
    comprobarComun(correo);
    assert.equal(
      correo.subject,
      'Recordatorio: devolución de Silla <Thonet>, el 05/11/2026 a las 18:30'
    );
    assert.ok(
      correo.text.includes(
        'Te recordamos que tienes que devolver Silla <Thonet> en la tienda el 05/11/2026 a las 18:30.'
      )
    );
    assert.ok(correo.text.includes('Si quieres alargar el alquiler, escríbenos cuanto antes'));
  });

  test('a domicilio: pasamos a recogerla', async () => {
    await email.enviarRecordatorioRecogida(datos({ modoRecogida: 'domicilio' }));
    assert.ok(
      enviado().text.includes(
        'Pasaremos a recoger Silla <Thonet> el 05/11/2026 a las 18:30 en la dirección de la entrega.'
      )
    );
  });
});

describe('aviso de retraso', () => {
  test('cuándo terminaba, que nos escriba hoy, sin hablar de penalizaciones', async () => {
    await email.enviarAvisoRetraso(datos());
    const correo = enviado();
    comprobarComun(correo);
    assert.equal(correo.subject, 'Devolución pendiente: Silla <Thonet>');
    assert.ok(
      correo.text.includes(
        'El alquiler de Silla <Thonet> terminaba el 05/11/2026 a las 18:30 y todavía no nos consta la devolución.'
      )
    );
    assert.ok(correo.text.includes('Si ya la has devuelto, no hagas caso de este correo'));
    // La penalización por retraso no está confirmada por el cliente (8.5): el correo no la menciona.
    assert.ok(!/penaliz|recargo|fianza/i.test(correo.text));
  });
});

describe('cancelación', () => {
  test('con reembolso: cuánto y que avisaremos cuando esté hecho', async () => {
    await email.enviarCancelacionReserva(datos({}, { reembolso: 50.5 }));
    const correo = enviado();
    comprobarComun(correo);
    assert.equal(correo.subject, 'Reserva cancelada: Silla <Thonet>');
    assert.ok(correo.text.includes('Hemos cancelado tu reserva de Silla <Thonet>.'));
    assert.ok(
      correo.text.includes(
        'Te devolveremos 50,50 € en la misma tarjeta con la que pagaste. Te escribiremos cuando el reembolso esté hecho.'
      )
    );
    assert.ok(correo.text.includes('Fechas: del 02/11/2026 a las 10:00 al 05/11/2026 a las 18:30'));
  });

  test('sin reembolso: lo dice', async () => {
    await email.enviarCancelacionReserva(datos({}, { reembolso: 0 }));
    const { text } = enviado();
    assert.ok(text.includes('Esta cancelación no lleva reembolso.'));
    assert.ok(!text.includes('Te devolveremos'));
  });
});

describe('reembolso hecho', () => {
  test('el importe, la tarjeta y lo que tarda el banco', async () => {
    await email.enviarReembolsoReserva(datos({}, { reembolso: 120.5 }));
    const correo = enviado();
    comprobarComun(correo);
    assert.equal(correo.subject, 'Reembolso de tu reserva: Silla <Thonet>');
    assert.ok(
      correo.text.includes(
        'Ya hemos hecho el reembolso de 120,50 € de tu reserva de Silla <Thonet>, en la misma tarjeta con la que pagaste.'
      )
    );
    assert.ok(correo.text.includes('Importe devuelto: 120,50 €'));
    assert.ok(correo.text.includes('entre 5 y 10 días hábiles'));
  });
});

describe('fianza resuelta', () => {
  const fianza = (extra) => datos({}, { fianza: 30, ...extra });

  test('entera: lo devuelto y el plazo del banco, sin «Retenido»', async () => {
    await email.enviarDevolucionFianza(fianza({ devuelto: 30, retenido: 0, motivo: null }));
    const correo = enviado();
    comprobarComun(correo);
    assert.equal(correo.subject, 'Fianza de tu alquiler: Silla <Thonet>');
    assert.ok(
      correo.text.includes(
        'Te hemos devuelto la fianza entera, 30,00 €, en la misma tarjeta con la que pagaste.'
      )
    );
    assert.ok(correo.text.includes('Devuelto: 30,00 €'));
    assert.ok(!correo.text.includes('Retenido:'));
    assert.ok(correo.text.includes('entre 5 y 10 días hábiles'));
  });

  test('en parte: cuánto se devuelve, cuánto se retiene y el motivo escapado', async () => {
    await email.enviarDevolucionFianza(
      fianza({ devuelto: 17.5, retenido: 12.5, motivo: 'Arañazo <grande>' })
    );
    const { text, html } = enviado();
    assert.ok(
      text.includes(
        'Te hemos devuelto 17,50 € de la fianza en la misma tarjeta con la que pagaste, y nos quedamos con 12,50 €.'
      )
    );
    assert.ok(text.includes('Motivo: Arañazo <grande>'));
    assert.ok(html.includes('Arañazo &lt;grande&gt;'));
    assert.ok(text.includes('Retenido: 12,50 €'));
  });

  test('entera retenida: sin plazo del banco', async () => {
    await email.enviarDevolucionFianza(fianza({ devuelto: 0, retenido: 30, motivo: 'Pieza rota' }));
    const { text } = enviado();
    assert.ok(text.includes('Esta vez nos quedamos con la fianza entera (30,00 €).'));
    assert.ok(!text.includes('días hábiles'));
  });
});

describe('confirmación con fianza', () => {
  test('la fianza va en su fila y se explica cuándo se devuelve', async () => {
    await email.enviarConfirmacionReserva(
      datos({
        pedidoId: 'a1b2c3d4-0000-4000-8000-000000000000',
        dias: 3,
        fianza: 22.5,
        total: 97.5
      })
    );
    const { text } = enviado();
    assert.ok(text.includes('Fianza (reembolsable): 22,50 €'));
    assert.ok(text.includes('Total pagado: 97,50 € (IVA incluido)'));
    assert.ok(
      text.includes('La fianza te la devolvemos en la misma tarjeta después de la recogida')
    );
  });

  test('sin fianza: ni la fila ni la frase', async () => {
    await email.enviarConfirmacionReserva(datos({ dias: 3, fianza: 0, total: 75 }));
    const { text } = enviado();
    assert.ok(!text.includes('Fianza'));
    assert.ok(!text.includes('La fianza'));
  });
});

describe('fallos', () => {
  test('si Resend falla, no lanza (la acción o la tarea ya está hecha)', async () => {
    enviar.mock.mockImplementation(async () => {
      throw new Error('red caída');
    });
    for (const enviarCorreo of [
      email.enviarRecordatorioEntrega,
      email.enviarRecordatorioRecogida,
      email.enviarAvisoRetraso,
      email.enviarCancelacionReserva,
      email.enviarReembolsoReserva,
      email.enviarDevolucionFianza
    ]) {
      await assert.doesNotReject(enviarCorreo(datos({}, { reembolso: 10 })));
    }
  });
});
