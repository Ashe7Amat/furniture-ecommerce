// Tests unitarios de procesarSesionPagada (utils/pagos.js): la lógica que comparten el webhook
// de Stripe y la ruta confirmar-sesion. Supabase y los emails están sustituidos por dobles,
// así que no se toca ningún servicio real.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = ''; // nunca enviar correos de verdad, pase lo que pase

const supabase = require('../data/supabase');
const email = require('../utils/email');
const {
  procesarSesionPagada,
  avisarPagoSinRegistrar,
  idPedidoDeSesion
} = require('../utils/pagos');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { MUEBLES_DE_PRUEBA, crearSesion } = require('./helpers/stripeFixtures');

let fake;
let correos;
let registroErrores;

const instalarDobles = (opciones = {}) => {
  fake = crearFakeSupabase({ muebles: MUEBLES_DE_PRUEBA(), ...opciones });
  mock.method(supabase, 'from', fake.from);
  correos = {
    venta: mock.method(email, 'enviarNotificacionVenta', async () => {}),
    cliente: mock.method(email, 'enviarConfirmacionCliente', async () => {}),
    alerta: mock.method(email, 'enviarAlertaAdmin', async () => {})
  };
  registroErrores = mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
};

const sesionConItems = (items, cambios = {}) => {
  const base = crearSesion();
  return { ...base, metadata: { ...base.metadata, items: JSON.stringify(items) }, ...cambios };
};

// Pedido de OTRO comprador que ya incluye el sofá (mueble-1) como compra.
const pedidoAnterior = (cambios = {}) => ({
  id: 'pedido-anterior',
  stripe_session_id: 'cs_anterior',
  estado: 'procesando',
  items: [
    { productId: 'mueble-1', nombre: 'Sofá Lumina', modalidad: 'compra', cantidad: 1, precio: 1250 }
  ],
  ...cambios
});

const vendido = (id) => (m) => (m.id === id ? { ...m, estado: 'vendido', disponible: false } : m);

beforeEach(() => instalarDobles());
afterEach(() => mock.restoreAll());

describe('procesarSesionPagada — compra normal', () => {
  test('marca la pieza como vendida, guarda el pedido con el total de Stripe y envía los dos emails', async () => {
    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(resultado.total, 1250);
    assert.deepEqual(resultado.conflictos, []);

    const sofa = fake.tablas.muebles.find((m) => m.id === 'mueble-1');
    assert.equal(sofa.estado, 'vendido');
    assert.equal(sofa.disponible, false);

    assert.equal(fake.tablas.pedidos.length, 1);
    const pedido = fake.tablas.pedidos[0];
    assert.equal(pedido.id, idPedidoDeSesion('cs_test_123'));
    assert.equal(pedido.stripe_session_id, 'cs_test_123');
    assert.equal(pedido.total, 1250);
    assert.equal(pedido.estado, 'procesando');
    assert.equal(pedido.metodo_entrega, 'domicilio');
    assert.equal(pedido.direccion_envio, 'Calle Falsa 123, Barcelona');
    assert.deepEqual(pedido.items, [
      {
        productId: 'mueble-1',
        nombre: 'Sofá Lumina',
        modalidad: 'compra',
        cantidad: 1,
        precio: 1250
      }
    ]);
    assert.equal(pedido.cliente_info.email, 'ana@example.com');
    assert.equal(pedido.cliente_info.metodoPago, 'Tarjeta (Stripe)');

    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(
      correos.alerta.mock.callCount(),
      0,
      'sin conflicto no se molesta al admin con alertas'
    );
    const enviado = correos.cliente.mock.calls[0].arguments[0];
    assert.equal(enviado.total, 1250);
    assert.equal(enviado.clienteInfo.email, 'ana@example.com');
    assert.equal(enviado.items.length, 1);
  });

  test('el total del pedido es lo que cobró Stripe, no la suma de los precios actuales del catálogo', async () => {
    await procesarSesionPagada(crearSesion({ amount_total: 99900 }));
    assert.equal(fake.tablas.pedidos[0].total, 999);
  });

  test('alquiler: la pieza queda como alquilada y la línea usa el precio por día', async () => {
    const sesion = sesionConItems([{ productId: 'mueble-2', modalidad: 'alquiler' }], {
      amount_total: 4000
    });
    await procesarSesionPagada(sesion);

    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-2').estado, 'alquilado');
    assert.deepEqual(fake.tablas.pedidos[0].items, [
      {
        productId: 'mueble-2',
        nombre: 'Butaca de cine',
        modalidad: 'alquiler',
        cantidad: 1,
        precio: 40
      }
    ]);
  });

  test('un carrito con varias piezas marca todas y guarda un solo pedido', async () => {
    const sesion = sesionConItems(
      [
        { productId: 'mueble-1', modalidad: 'compra' },
        { productId: 'mueble-3', modalidad: 'compra' }
      ],
      { amount_total: 185000 }
    );
    await procesarSesionPagada(sesion);

    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado, 'vendido');
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-3').estado, 'vendido');
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-2').estado, 'disponible');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(fake.tablas.pedidos[0].items.length, 2);
    assert.equal(correos.venta.mock.callCount(), 1);
  });

  test('una modalidad desconocida se trata como compra', async () => {
    await procesarSesionPagada(sesionConItems([{ productId: 'mueble-1', modalidad: 'regalo' }]));
    assert.equal(fake.tablas.pedidos[0].items[0].modalidad, 'compra');
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado, 'vendido');
  });
});

describe('procesarSesionPagada — id del pedido derivado de la sesión', () => {
  test('es un UUID válido, estable para la misma sesión y distinto entre sesiones', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    assert.match(idPedidoDeSesion('cs_test_123'), uuid);
    assert.equal(idPedidoDeSesion('cs_test_123'), idPedidoDeSesion('cs_test_123'));
    assert.notEqual(idPedidoDeSesion('cs_test_123'), idPedidoDeSesion('cs_test_124'));
  });
});

describe('procesarSesionPagada — idempotencia', () => {
  test('procesar dos veces la misma sesión no duplica el pedido ni los emails, ni da falsas alertas', async () => {
    const primera = await procesarSesionPagada(crearSesion());
    const segunda = await procesarSesionPagada(crearSesion());

    assert.equal(primera.estado, 'procesada');
    assert.equal(segunda.estado, 'ya_procesada');
    assert.deepEqual(segunda.conflictos, []);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(correos.alerta.mock.callCount(), 0);
    assert.equal(registroErrores.mock.callCount(), 0);
  });

  test('reprocesar una sesión ya registrada no toca las piezas: respeta lo que haya cambiado el admin', async () => {
    await procesarSesionPagada(crearSesion());
    fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado = 'disponible'; // el admin repone la pieza
    const escriturasAntes = fake.escrituras.length;

    const repetida = await procesarSesionPagada(crearSesion());

    assert.equal(repetida.estado, 'ya_procesada');
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado, 'disponible');
    assert.equal(fake.escrituras.length, escriturasAntes, 'no debe haber ninguna escritura nueva');
  });

  test('dos procesados simultáneos (webhook + respaldo) dejan un solo pedido y un solo juego de emails', async () => {
    const resultados = await Promise.all([
      procesarSesionPagada(crearSesion()),
      procesarSesionPagada(crearSesion())
    ]);

    assert.deepEqual(resultados.map((r) => r.estado).sort(), ['procesada', 'ya_procesada']);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(correos.alerta.mock.callCount(), 0, 'el gemelo del webhook no es una doble venta');
    assert.equal(fake.estado.unicidadRechazada, 1);
  });

  test('sin índice único en stripe_session_id, la carrera también se resuelve (lo garantiza la clave primaria)', async () => {
    instalarDobles({ indiceUnicoStripe: false });

    const resultados = await Promise.all([
      procesarSesionPagada(crearSesion()),
      procesarSesionPagada(crearSesion()),
      procesarSesionPagada(crearSesion())
    ]);

    assert.equal(resultados.filter((r) => r.estado === 'procesada').length, 1);
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(
      fake.estado.unicidadRechazada,
      2,
      'las otras dos inserciones chocan en la clave primaria'
    );
  });

  test('sesiones distintas generan pedidos distintos', async () => {
    await procesarSesionPagada(
      sesionConItems([{ productId: 'mueble-1', modalidad: 'compra' }], { id: 'cs_A' })
    );
    await procesarSesionPagada(
      sesionConItems([{ productId: 'mueble-3', modalidad: 'compra' }], {
        id: 'cs_B',
        amount_total: 60000
      })
    );

    assert.deepEqual(
      fake.tablas.pedidos.map((p) => p.stripe_session_id),
      ['cs_A', 'cs_B']
    );
    assert.equal(correos.venta.mock.callCount(), 2);
  });

  test('si ya hubiera pedidos duplicados de esa sesión (datos antiguos), la reconoce como procesada sin fallar', async () => {
    instalarDobles({
      indiceUnicoStripe: false,
      pedidos: [
        { id: 'p-1', stripe_session_id: 'cs_test_123' },
        { id: 'p-2', stripe_session_id: 'cs_test_123' }
      ]
    });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'ya_procesada');
    assert.equal(fake.tablas.pedidos.length, 2, 'no añade un tercero');
    assert.equal(correos.venta.mock.callCount(), 0);
  });
});

describe('procesarSesionPagada — marcado de piezas', () => {
  test('nunca pisa el estado de otra persona: un alquiler pagado sobre una pieza vendida la deja vendida', async () => {
    instalarDobles({ muebles: MUEBLES_DE_PRUEBA().map(vendido('mueble-2')) });

    const resultado = await procesarSesionPagada(
      sesionConItems([{ productId: 'mueble-2', modalidad: 'alquiler' }], { amount_total: 4000 })
    );

    assert.equal(
      resultado.estado,
      'procesada',
      'el cobro ya se hizo: el pedido se registra igualmente'
    );
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-2').estado, 'vendido');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(resultado.conflictos.length, 1, 'y como la pieza era de otro, se avisa');
    assert.match(resultado.conflictos[0].motivos[0], /"vendido"/);
  });

  test('la actualización es condicional (solo desde disponible), no un "leer y luego escribir"', async () => {
    await procesarSesionPagada(crearSesion());

    const actualizaciones = fake.escrituras.filter((e) => e.tabla === 'muebles');
    assert.equal(actualizaciones.length, 1);
    assert.deepEqual(actualizaciones[0].datos, { estado: 'vendido', disponible: false });
  });
});

describe('procesarSesionPagada — doble venta', () => {
  test('si otro pedido ya incluye la pieza como compra, registra igualmente el cobro y avisa al admin', async () => {
    instalarDobles({
      muebles: MUEBLES_DE_PRUEBA().map(vendido('mueble-1')),
      pedidos: [pedidoAnterior()]
    });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(
      fake.tablas.pedidos.length,
      2,
      'el dinero ya se cobró: el pedido no puede perderse'
    );
    assert.equal(resultado.conflictos.length, 1);
    assert.equal(resultado.conflictos[0].productId, 'mueble-1');
    assert.equal(resultado.conflictos[0].pedidoAnteriorId, 'pedido-anterior');
    assert.match(resultado.conflictos[0].motivos[0], /pedido-anterior/);

    assert.equal(correos.alerta.mock.callCount(), 1);
    const alerta = correos.alerta.mock.calls[0].arguments[0];
    assert.match(alerta.asunto, /doble venta/i);
    assert.ok(alerta.detalles.some((d) => d.includes('pedido-anterior')));
    assert.ok(alerta.detalles.some((d) => d.includes('cs_test_123')));
    assert.ok(registroErrores.mock.calls.some((c) => String(c.arguments[0]).includes('[ALERTA]')));

    assert.equal(
      correos.venta.mock.callCount(),
      1,
      'los emails normales del pedido salen igualmente'
    );
    assert.equal(correos.cliente.mock.callCount(), 1);
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado, 'vendido');
  });

  test('comprar una pieza que otra persona ha alquilado entretanto se detecta por el estado de la pieza', async () => {
    // Sin ningún pedido de compra previo: el comprador B abrió su sesión, un tercero alquiló
    // la pieza por un día y B paga después. La pieza sigue "alquilado" y el cobro es de compra.
    instalarDobles({
      muebles: MUEBLES_DE_PRUEBA().map((m) =>
        m.id === 'mueble-1' ? { ...m, estado: 'alquilado', disponible: false } : m
      )
    });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1, 'el cobro se registra igualmente');
    assert.equal(
      fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado,
      'alquilado',
      'no se pisa el estado del otro'
    );
    assert.equal(resultado.conflictos.length, 1);
    assert.equal(resultado.conflictos[0].pedidoAnteriorId, null);
    assert.match(resultado.conflictos[0].motivos[0], /"alquilado"/);
    assert.equal(correos.alerta.mock.callCount(), 1);
  });

  test('límite conocido: una pieza ya "vendida" sin ningún otro pedido de compra (p. ej. marcada a mano) no es conflicto', async () => {
    // Estado buscado = estado actual: es indistinguible de un reintento o del gemelo
    // webhook/respaldo, y avisar aquí produciría falsas alertas en cada compra simultánea.
    instalarDobles({ muebles: MUEBLES_DE_PRUEBA().map(vendido('mueble-1')) });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.deepEqual(resultado.conflictos, []);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('un pedido anterior cancelado no cuenta como venta', async () => {
    instalarDobles({ pedidos: [pedidoAnterior({ estado: 'cancelado' })] });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.deepEqual(resultado.conflictos, []);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('un pedido anterior de ALQUILER de la pieza no cuenta como venta', async () => {
    instalarDobles({
      pedidos: [
        pedidoAnterior({
          items: [
            {
              productId: 'mueble-1',
              nombre: 'Sofá Lumina',
              modalidad: 'alquiler',
              cantidad: 1,
              precio: 40
            }
          ]
        })
      ]
    });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.deepEqual(resultado.conflictos, []);
    assert.equal(correos.alerta.mock.callCount(), 0);
  });

  test('un pedido anterior con OTRAS piezas no cuenta', async () => {
    instalarDobles({
      pedidos: [
        pedidoAnterior({
          items: [
            {
              productId: 'mueble-3',
              nombre: 'Mesa de comedor',
              modalidad: 'compra',
              cantidad: 1,
              precio: 600
            }
          ]
        })
      ]
    });

    const resultado = await procesarSesionPagada(crearSesion());
    assert.deepEqual(resultado.conflictos, []);
  });

  test('tras un fallo parcial de la propia sesión, el reintento no da una falsa alerta de doble venta', async () => {
    fake.fallos['pedidos.insert'] = { code: '08006', message: 'connection failure' };
    await assert.rejects(procesarSesionPagada(crearSesion()), { message: 'connection failure' });
    assert.equal(
      fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado,
      'vendido',
      'la pieza ya se marcó en el primer intento'
    );

    delete fake.fallos['pedidos.insert'];
    const reintento = await procesarSesionPagada(crearSesion());

    assert.equal(reintento.estado, 'procesada');
    assert.deepEqual(reintento.conflictos, []);
    assert.equal(correos.alerta.mock.callCount(), 0);
    assert.equal(
      registroErrores.mock.calls.filter((c) => String(c.arguments[0]).includes('[ALERTA]')).length,
      0
    );
  });

  test('si falla la comprobación de doble venta, el pedido se guarda y se envía igualmente', async () => {
    fake.fallos['pedidos.select'] = (consulta) =>
      consulta.usa.has('contains') ? { code: '08006', message: 'connection failure' } : null;

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
  });
});

describe('procesarSesionPagada — fallos de base de datos', () => {
  test('si falla al guardar el pedido, lanza y no envía ningún email', async () => {
    fake.fallos['pedidos.insert'] = { code: '08006', message: 'connection failure' };

    await assert.rejects(procesarSesionPagada(crearSesion()), { message: 'connection failure' });
    assert.equal(fake.tablas.pedidos.length, 0);
    assert.equal(correos.venta.mock.callCount(), 0);
    assert.equal(correos.cliente.mock.callCount(), 0);
  });

  test('si falla al marcar la pieza, lanza sin guardar pedido; el reintento lo completa una sola vez', async () => {
    fake.fallos['muebles.update'] = { code: '08006', message: 'connection failure' };
    await assert.rejects(procesarSesionPagada(crearSesion()), { message: 'connection failure' });
    assert.equal(fake.tablas.pedidos.length, 0);
    assert.equal(correos.venta.mock.callCount(), 0);

    delete fake.fallos['muebles.update']; // la base de datos se recupera y Stripe reintenta
    const reintento = await procesarSesionPagada(crearSesion());

    assert.equal(reintento.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(fake.tablas.muebles.find((m) => m.id === 'mueble-1').estado, 'vendido');
    assert.equal(correos.venta.mock.callCount(), 1);
    assert.equal(correos.cliente.mock.callCount(), 1);
  });

  test('si falla la lectura del catálogo, lanza y no escribe nada', async () => {
    fake.fallos['muebles.select'] = { code: '08006', message: 'connection failure' };

    await assert.rejects(procesarSesionPagada(crearSesion()), { message: 'connection failure' });
    assert.equal(fake.escrituras.length, 0);
  });

  test('si falla la comprobación de si la sesión ya existe, lanza y no escribe nada', async () => {
    fake.fallos['pedidos.select'] = { code: '08006', message: 'connection failure' };

    await assert.rejects(procesarSesionPagada(crearSesion()), { message: 'connection failure' });
    assert.equal(fake.escrituras.length, 0);
  });
});

describe('procesarSesionPagada — casos límite', () => {
  test('pieza borrada del catálogo tras el pago: se guarda el pedido con una línea genérica', async () => {
    instalarDobles({ muebles: MUEBLES_DE_PRUEBA().filter((m) => m.id !== 'mueble-1') });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(fake.tablas.pedidos[0].items[0].nombre, '(pieza eliminada del catálogo)');
    assert.equal(fake.tablas.pedidos[0].items[0].precio, 0);
    assert.equal(fake.tablas.pedidos[0].total, 1250, 'el total sigue siendo el que cobró Stripe');
  });

  test('sesión sin piezas en la metadata: se ignora sin escribir ni enviar nada', async () => {
    const resultado = await procesarSesionPagada(
      crearSesion({ metadata: { clienteEmail: 'ana@example.com' } })
    );

    assert.equal(resultado.estado, 'ignorada');
    assert.equal(fake.escrituras.length, 0);
    assert.equal(correos.venta.mock.callCount(), 0);
  });

  test('metadata con JSON inválido o lista vacía: se ignora', async () => {
    const rota = await procesarSesionPagada(crearSesion({ metadata: { items: '{no es json' } }));
    const vacia = await procesarSesionPagada(crearSesion({ metadata: { items: '[]' } }));

    assert.equal(rota.estado, 'ignorada');
    assert.equal(vacia.estado, 'ignorada');
    assert.equal(fake.escrituras.length, 0);
  });

  test('metadata corrupta (elementos nulos o sin productId): se ignora en vez de fallar en bucle', async () => {
    for (const items of [
      '[null]',
      '[{}]',
      '[{"modalidad":"compra"}]',
      '[{"productId":5}]',
      '[{"productId":""}]',
      '["mueble-1"]',
      '{"productId":"mueble-1"}'
    ]) {
      const resultado = await procesarSesionPagada(crearSesion({ metadata: { items } }));
      assert.equal(resultado.estado, 'ignorada', `debe ignorar ${items}`);
    }
    assert.equal(fake.escrituras.length, 0);
  });

  test('los emails se esperan antes de terminar (en Vercel la función se congela al responder)', async () => {
    const terminados = [];
    const conRetraso = (nombre) => async () => {
      await new Promise((resolver) => setTimeout(resolver, 25));
      terminados.push(nombre);
    };
    correos.venta.mock.mockImplementation(conRetraso('venta'));
    correos.cliente.mock.mockImplementation(conRetraso('cliente'));

    await procesarSesionPagada(crearSesion());

    assert.deepEqual(
      terminados.sort(),
      ['cliente', 'venta'],
      'ambos envíos deben haber terminado al resolver'
    );
  });

  test(
    'si el proveedor de email se cuelga, no retiene la respuesta más de 8 s y el pedido queda igualmente registrado',
    { timeout: 5000 },
    async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      correos.venta.mock.mockImplementation(() => new Promise(() => {})); // no termina nunca

      const procesado = procesarSesionPagada(crearSesion());
      while (correos.venta.mock.callCount() === 0) {
        await new Promise((resolver) => setImmediate(resolver)); // deja avanzar el flujo hasta los emails
      }
      t.mock.timers.tick(8000);
      const resultado = await procesado;

      assert.equal(resultado.estado, 'procesada');
      assert.equal(fake.tablas.pedidos.length, 1);
    }
  );

  test('la alerta de doble venta también se espera antes de terminar', async () => {
    instalarDobles({
      muebles: MUEBLES_DE_PRUEBA().map(vendido('mueble-1')),
      pedidos: [pedidoAnterior()]
    });
    let terminada = false;
    correos.alerta.mock.mockImplementation(async () => {
      await new Promise((resolver) => setTimeout(resolver, 25));
      terminada = true;
    });

    await procesarSesionPagada(crearSesion());

    assert.equal(terminada, true);
  });

  test('si el envío de un email lanza, el pedido igualmente queda procesado', async () => {
    correos.venta.mock.mockImplementation(async () => {
      throw new Error('Resend caído');
    });

    const resultado = await procesarSesionPagada(crearSesion());

    assert.equal(resultado.estado, 'procesada');
    assert.equal(fake.tablas.pedidos.length, 1);
    assert.equal(
      correos.cliente.mock.callCount(),
      1,
      'el otro email se envía aunque el primero falle'
    );
  });
});

describe('avisarPagoSinRegistrar', () => {
  test('manda al admin los datos necesarios para registrar el pedido a mano', async () => {
    await avisarPagoSinRegistrar(crearSesion(), new Error('connection failure'));

    assert.equal(correos.alerta.mock.callCount(), 1);
    const { asunto, detalles } = correos.alerta.mock.calls[0].arguments[0];
    assert.match(asunto, /no se ha podido registrar/i);
    const texto = detalles.join('\n');
    assert.match(texto, /cs_test_123/);
    assert.match(texto, /1250\.00 €/);
    assert.match(texto, /ana@example\.com/);
    assert.match(texto, /Calle Falsa 123/);
    assert.match(texto, /mueble-1/);
    assert.match(texto, /connection failure/);
  });

  test('no lanza aunque el envío del email falle', async () => {
    correos.alerta.mock.mockImplementation(async () => {
      throw new Error('Resend caído');
    });
    await assert.doesNotReject(avisarPagoSinRegistrar(crearSesion(), new Error('x')));
  });

  test('espera a que el email termine de enviarse', async () => {
    let terminada = false;
    correos.alerta.mock.mockImplementation(async () => {
      await new Promise((resolver) => setTimeout(resolver, 25));
      terminada = true;
    });

    await avisarPagoSinRegistrar(crearSesion(), new Error('x'));

    assert.equal(terminada, true);
  });
});
