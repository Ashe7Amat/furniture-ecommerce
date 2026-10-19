// Panel de reservas: las altas en el calendario sin pago web (docs/reservas-diseno.md, 8.3; bloque
// R-d, commit 14): POST /api/admin/reservas/bloqueos, /alquileres y /ventas. Cada una pasa por el
// mismo camino que el resto (limpieza de caducadas, inserción y, si choca, un 409 que dice con qué,
// sin datos del otro cliente), y mantiene muebles.estado mientras no lo derive el calendario (3.3).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { DIAS_ATRAS_VENTA } = require('../utils/adminReservas');
const { idPedidoDeSesion } = require('../utils/pagos');
const { REGLAS_ALQUILER } = require('../utils/reglasAlquiler');
const { hoyEnMadrid, sumarDias, fechaLegible } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const LUIS = uuid(901);
const PEDIDO_LUIS = 'c0ffee00-0000-4000-8000-000000000002';

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const MUEBLES = (estado = 'disponible') => [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado }
];
const CONTACTO_LUIS = {
  nombre: 'Luis Pérez',
  email: 'luis@ejemplo.com',
  telefono: '611222333',
  direccion: 'Avinguda Diagonal 1, Barcelona'
};
// La referencia con la que el cliente y el administrador conocen la compra web de venta(): la de su
// pedido, como en los emails.
const PEDIDO_VENTA = idPedidoDeSesion('cs_otra').slice(0, 8).toUpperCase();
// Un alquiler web de otro cliente, ya en el calendario.
const alquilerWeb = (cambios = {}) => ({
  id: uuid(102),
  mueble_id: SOFA,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(10),
  hora_entrega: '10:00:00',
  fecha_fin: dia(13),
  hora_recogida: '10:00:00',
  fin_ocupacion: dia(13),
  dias_margen: 2,
  cliente_id: LUIS,
  pedido_id: PEDIDO_LUIS,
  datos_contacto: CONTACTO_LUIS,
  direccion_entrega: CONTACTO_LUIS.direccion,
  historial: [],
  ...cambios
});
const bloqueo = (cambios = {}) => ({
  id: 'b10c0000-0000-4000-8000-000000000001',
  mueble_id: SOFA,
  tipo: 'bloqueo',
  estado: 'confirmada',
  origen: 'manual',
  fecha_inicio: dia(20),
  fecha_fin: dia(25),
  fin_ocupacion: dia(25),
  dias_margen: 0,
  historial: [],
  ...cambios
});
const venta = (cambios = {}) => ({
  id: 'fe0da000-0000-4000-8000-000000000001',
  mueble_id: SOFA,
  tipo: 'venta',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(-3),
  dias_margen: 0,
  stripe_session_id: 'cs_otra',
  historial: [],
  ...cambios
});

let fake;
const instalar = ({ reservas = [], muebles = MUEBLES() } = {}) => {
  fake = crearFakeSupabase({ muebles, reservas });
  mock.method(supabase, 'from', fake.from);
};

let registroErrores;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  registroErrores = mock.method(console, 'error', () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

const alta = (tipo, cuerpo) =>
  request(app)
    .post(`/api/admin/reservas/${tipo}`)
    .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
    .send(cuerpo);
const insertadas = () =>
  fake.escrituras.filter((e) => e.tabla === 'reservas' && e.accion === 'insert');
const estadoPieza = () => fake.tablas.muebles.find((m) => m.id === SOFA).estado;
const sinDatosDeLuis = (texto) => {
  for (const dato of ['Luis', CONTACTO_LUIS.email, CONTACTO_LUIS.telefono, 'Diagonal']) {
    assert.ok(!texto.includes(dato), `el mensaje no debe llevar "${dato}": ${texto}`);
  }
  assert.ok(!/reservas_sin_solape|conflicting key|Key \(/.test(texto), texto);
};

describe('POST /api/admin/reservas/bloqueos', () => {
  const datos = (cambios = {}) => ({
    mueble_id: SOFA,
    fecha_inicio: dia(3),
    fecha_fin: dia(6),
    motivo: '  Mantenimiento  ',
    ...cambios
  });

  test('201 con el bloqueo: sin margen, fin_ocupacion = fecha_fin, origen manual y su línea', async () => {
    const res = await alta('bloqueos', datos());

    assert.equal(res.status, 201);
    const { reserva } = res.body;
    assert.equal(reserva.tipo, 'bloqueo');
    assert.equal(reserva.estado, 'confirmada');
    assert.equal(reserva.origen, 'manual');
    assert.equal(reserva.etiqueta, 'Bloqueo');
    assert.deepEqual(reserva.acciones, ['levantar-bloqueo']);
    assert.equal(reserva.fecha_inicio, dia(3));
    assert.equal(reserva.fecha_fin, dia(6));
    assert.equal(reserva.fin_ocupacion, dia(6));
    assert.equal(reserva.dias_margen, 0);
    assert.equal(reserva.motivo, 'Mantenimiento');
    assert.equal(reserva.contacto, null);
    assert.deepEqual(reserva.pieza, { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' });

    const [{ enviado, fila }] = insertadas();
    assert.equal(enviado.hora_entrega, undefined);
    assert.equal(enviado.cliente_id, undefined);
    assert.equal(fila.rango_ocupado, `[${dia(3)},${dia(6)})`);
    assert.equal(fila.historial.length, 1);
    assert.equal(fila.historial[0].tipo, 'creada');
    assert.equal(fila.historial[0].detalle, 'Bloqueo: Mantenimiento');
    assert.equal(fila.historial[0].por, 'admin');
    assert.ok(!Number.isNaN(Date.parse(fila.historial[0].fecha)));
    assert.equal(estadoPieza(), 'disponible', 'un bloqueo no toca la pieza');
  });

  test('antes de insertar, se limpian las provisionales caducadas de la pieza (4.6)', async () => {
    instalar({
      reservas: [
        alquilerWeb({
          estado: 'pendiente',
          pedido_id: null,
          fecha_inicio: dia(3),
          expira_en: new Date(Date.now() - 60_000).toISOString()
        })
      ]
    });
    const res = await alta('bloqueos', datos());
    assert.equal(res.status, 201);
    assert.equal(fake.tablas.reservas.find((r) => r.id === uuid(102)).estado, 'expirada');
    const orden = fake.escrituras.map((e) => `${e.tabla}.${e.accion}`);
    assert.deepEqual(orden, ['reservas.update', 'reservas.insert']);
  });

  test('hoy vale; antes de hoy no (400)', async () => {
    assert.equal((await alta('bloqueos', datos({ fecha_inicio: hoy }))).status, 201);
    const res = await alta('bloqueos', datos({ fecha_inicio: dia(-1) }));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Un bloqueo no puede empezar antes de hoy.' });
  });

  test('la forma: 400 con su mensaje y sin escribir nada', async () => {
    const casos = [
      [{ mueble_id: 'sofa' }, 'Elige la pieza.'],
      [{ mueble_id: undefined }, 'Elige la pieza.'],
      [{ fecha_inicio: '13/10/2026' }, 'Elige una fecha de inicio válida (AAAA-MM-DD).'],
      [{ fecha_fin: undefined }, 'Elige una fecha de fin válida (AAAA-MM-DD).'],
      [{ fecha_fin: dia(3) }, 'La fecha de fin tiene que ser posterior a la de inicio.'],
      [{ fecha_fin: dia(2) }, 'La fecha de fin tiene que ser posterior a la de inicio.'],
      [{ motivo: '  ' }, 'Escribe el motivo del bloqueo.'],
      [{ motivo: 'x'.repeat(501) }, 'El motivo es demasiado largo (máximo 500 caracteres).']
    ];
    for (const [cambios, mensaje] of casos) {
      const res = await alta('bloqueos', datos(cambios));
      assert.equal(res.status, 400, JSON.stringify(cambios));
      assert.deepEqual(res.body, { error: mensaje });
    }
    assert.equal(fake.escrituras.length, 0);
  });

  test('un cuerpo JSON que no es un objeto: 400 en castellano en las tres altas', async () => {
    for (const tipo of ['bloqueos', 'alquileres', 'ventas']) {
      const res = await request(app)
        .post(`/api/admin/reservas/${tipo}`)
        .set('Authorization', `Bearer ${TOKEN_ADMIN}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify([datos()]));
      assert.equal(res.status, 400, tipo);
      assert.deepEqual(res.body, { error: 'Los datos tienen que ir en un objeto JSON.' });
    }
    assert.equal(fake.escrituras.length, 0);
  });

  test('una pieza que no existe: 404 sin escribir nada', async () => {
    const res = await alta('bloqueos', datos({ mueble_id: uuid(77) }));
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Mueble no encontrado.' });
    assert.equal(fake.escrituras.length, 0);
  });

  test('si la pieza se borra entre la lectura y la inserción (23503): 404', async () => {
    fake.fallos['reservas.insert'] = { code: '23503', message: 'violates foreign key constraint' };
    const res = await alta('bloqueos', datos());
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Mueble no encontrado.' });
  });

  test('contra un alquiler web: 409 con su referencia, fechas y margen, sin datos del cliente', async () => {
    instalar({ reservas: [alquilerWeb()] });

    const res = await alta('bloqueos', datos({ fecha_inicio: dia(12), fecha_fin: dia(14) }));

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `Esas fechas chocan con el alquiler #C0FFEE00 (del ${fechaLegible(dia(10))} al ` +
        `${fechaLegible(dia(13))}, más 2 días de margen).`
    });
    sinDatosDeLuis(res.body.error);
    assert.equal(insertadas().length, 0);
  });

  test('en el margen del alquiler también choca', async () => {
    instalar({ reservas: [alquilerWeb()] });
    const res = await alta('bloqueos', datos({ fecha_inicio: dia(14), fecha_fin: dia(16) }));
    assert.equal(res.status, 409);
    assert.ok((await alta('bloqueos', datos({ fecha_inicio: dia(15), fecha_fin: dia(16) }))).ok);
  });

  test('contra otro bloqueo o una venta: 409 que lo dice', async () => {
    instalar({ reservas: [bloqueo()] });
    assert.deepEqual(
      (await alta('bloqueos', datos({ fecha_inicio: dia(24), fecha_fin: dia(27) }))).body,
      {
        error: `Esas fechas chocan con el bloqueo #B10C0000 (del ${fechaLegible(dia(20))} al ${fechaLegible(dia(25))}).`
      }
    );
    instalar({ reservas: [venta({ fecha_inicio: dia(30) })] });
    assert.deepEqual(
      (await alta('bloqueos', datos({ fecha_inicio: dia(29), fecha_fin: dia(31) }))).body,
      {
        error: `Esas fechas chocan con la venta #${PEDIDO_VENTA} (desde el ${fechaLegible(dia(30))}).`
      }
    );
  });

  test('con varias, nombra la primera', async () => {
    instalar({ reservas: [bloqueo(), alquilerWeb()] });
    const res = await alta('bloqueos', datos({ fecha_inicio: dia(5), fecha_fin: dia(30) }));
    assert.match(res.body.error, /^Esas fechas chocan con el alquiler #C0FFEE00/);
  });

  test('una cancelada o una provisional caducada no chocan', async () => {
    instalar({
      reservas: [
        alquilerWeb({ estado: 'cancelada' }),
        bloqueo({
          fecha_inicio: dia(10),
          fecha_fin: dia(12),
          fin_ocupacion: dia(12),
          estado: 'cancelada'
        })
      ]
    });
    assert.equal(
      (await alta('bloqueos', datos({ fecha_inicio: dia(10), fecha_fin: dia(12) }))).status,
      201
    );
  });

  test('si la fila que chocaba ya no está cuando se busca: 409 que pide volver a intentarlo', async () => {
    fake.fallos['reservas.insert'] = { code: '23P01', message: 'conflicting key value' };
    const res = await alta('bloqueos', datos());
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        'Esas fechas chocaban con otra reserva de la pieza que acaba de cambiar. Vuelve a intentarlo.'
    });
  });

  test('un interbloqueo de Postgres (40P01) se trata como un choque', async () => {
    instalar({ reservas: [alquilerWeb()] });
    fake.fallos['reservas.insert'] = { code: '40P01', message: 'deadlock detected' };
    const res = await alta('bloqueos', datos({ fecha_inicio: dia(12), fecha_fin: dia(14) }));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /^Esas fechas chocan con el alquiler #C0FFEE00/);
  });

  test('si falla la base de datos: 500 genérico', async () => {
    fake.fallos['reservas.insert'] = { message: 'conexión perdida' };
    const res = await alta('bloqueos', datos());
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      error: 'Error interno al guardar. Recarga la lista de reservas para ver cómo ha quedado.'
    });
    assert.ok(registroErrores.mock.calls.length > 0);
  });
});

describe('POST /api/admin/reservas/alquileres', () => {
  const datos = (cambios = {}) => ({
    mueble_id: SOFA,
    fecha_inicio: dia(3),
    hora_entrega: '09:30',
    fecha_fin: dia(6),
    hora_recogida: '19:00',
    modo_entrega: 'domicilio',
    modo_devolucion: 'tienda',
    contacto: {
      nombre: ' Marta Soler ',
      email: 'marta@ejemplo.com',
      telefono: '622333444',
      direccion: 'Carrer de Sants 10, Barcelona',
      notas: ''
    },
    importe_total_centimos: 18050,
    origen: 'manual',
    ...cambios
  });

  test('un alquiler pactado fuera de la web: confirmado, con el margen de las reglas, y la pieza sin tocar', async () => {
    const res = await alta('alquileres', datos());

    assert.equal(res.status, 201);
    const { reserva } = res.body;
    assert.equal(reserva.tipo, 'alquiler');
    assert.equal(reserva.estado, 'confirmada');
    assert.equal(reserva.origen, 'manual');
    assert.equal(reserva.etiqueta, 'Confirmada');
    assert.deepEqual(reserva.acciones, ['entregar', 'cancelar']);
    assert.equal(reserva.hora_entrega, '09:30');
    assert.equal(reserva.hora_recogida, '19:00');
    assert.equal(reserva.fin_ocupacion, dia(6));
    assert.equal(reserva.dias_margen, REGLAS_ALQUILER.diasMargen);
    assert.equal(reserva.direccion_entrega, 'Carrer de Sants 10, Barcelona');
    assert.deepEqual(reserva.contacto, {
      nombre: 'Marta Soler',
      email: 'marta@ejemplo.com',
      telefono: '622333444',
      direccion: 'Carrer de Sants 10, Barcelona',
      notas: null
    });
    assert.equal(reserva.importe_total, 180.5);
    assert.equal(reserva.pagado, false);
    assert.equal(reserva.entregada_en, null);

    const [{ enviado, fila }] = insertadas();
    assert.equal(enviado.cliente_id, undefined, 'no es de ninguna cuenta de la web');
    assert.equal(enviado.stripe_payment_intent_id, undefined);
    assert.equal(fila.rango_ocupado, `[${dia(3)},${dia(8)})`);
    assert.equal(fila.historial[0].detalle, 'Alquiler pactado fuera de la web.');
    assert.equal(fila.historial[0].por, 'admin');
    assert.equal(estadoPieza(), 'disponible');
    assert.equal(fake.escrituras.filter((e) => e.tabla === 'muebles').length, 0);
  });

  test('ya entregado: en curso desde ahora, y la pieza pasa a alquilada', async () => {
    const res = await alta(
      'alquileres',
      datos({ fecha_inicio: dia(-5), fecha_fin: dia(2), ya_entregado: true })
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.estado, 'en_curso');
    assert.equal(res.body.reserva.etiqueta, 'Entregada');
    assert.ok(res.body.reserva.entregada_en);
    assert.equal(
      insertadas()[0].fila.historial[0].detalle,
      'Alquiler pactado fuera de la web. Ya estaba entregado.'
    );
    assert.equal(estadoPieza(), 'alquilado');
  });

  test('ya entregado no puede empezar después de hoy: 400, y nada se escribe (empezar hoy sí)', async () => {
    const res = await alta(
      'alquileres',
      datos({ fecha_inicio: dia(1), fecha_fin: dia(4), ya_entregado: true })
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Un alquiler ya entregado no puede empezar después de hoy.');
    assert.equal(insertadas().length, 0);
    assert.equal(estadoPieza(), 'disponible');

    const hoyMismo = await alta(
      'alquileres',
      datos({ fecha_inicio: dia(0), fecha_fin: dia(4), ya_entregado: true })
    );
    assert.equal(hoyMismo.status, 201);
    // Sin entregar sí puede ser futuro
    assert.equal(
      (await alta('alquileres', datos({ fecha_inicio: dia(20), fecha_fin: dia(23) }))).status,
      201
    );
  });

  test('ya entregado nunca pisa un estado puesto a mano: una pieza alquilada a mano no se toca', async () => {
    instalar({ muebles: MUEBLES('alquilado') });
    assert.equal(
      (await alta('alquileres', datos({ fecha_inicio: dia(0), ya_entregado: true }))).status,
      201
    );
    assert.equal(estadoPieza(), 'alquilado');
  });

  test('un contrato antiguo puede haber empezado hace tiempo, y si ya pasó la recogida sale retrasado', async () => {
    const res = await alta(
      'alquileres',
      datos({ origen: 'legacy', fecha_inicio: dia(-200), fecha_fin: dia(-2), ya_entregado: true })
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.origen, 'legacy');
    assert.equal(res.body.reserva.etiqueta, 'Retrasada');
    assert.equal(res.body.reserva.retrasada, true);
    assert.equal(
      insertadas()[0].fila.historial[0].detalle,
      'Contrato antiguo dado de alta desde el panel. Ya estaba entregado.'
    );
  });

  test('ya entregado con la recogida pactada ya pasada: sigue ocupando el calendario desde hoy', async () => {
    const res = await alta(
      'alquileres',
      datos({ origen: 'legacy', fecha_inicio: dia(-30), fecha_fin: dia(-5), ya_entregado: true })
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.fecha_fin, dia(-5));
    assert.equal(res.body.reserva.fin_ocupacion, hoy);
    assert.equal(res.body.reserva.etiqueta, 'Retrasada');
    const [{ enviado, fila }] = insertadas();
    assert.equal(enviado.fin_ocupacion, hoy);
    assert.equal(fila.rango_ocupado, `[${dia(-30)},${dia(2)})`);

    // La pieza sigue fuera: no se puede bloquear desde hoy, solo pasado su margen.
    const bloqueoHoy = await alta('bloqueos', {
      mueble_id: SOFA,
      fecha_inicio: hoy,
      fecha_fin: dia(3),
      motivo: 'Exposición'
    });
    assert.equal(bloqueoHoy.status, 409);
    assert.match(bloqueoHoy.body.error, /^Esas fechas chocan con el alquiler #/);
  });

  test('ya entregado con la recogida por llegar: fin_ocupacion es la recogida pactada', async () => {
    const res = await alta('alquileres', datos({ fecha_inicio: dia(-2), ya_entregado: true }));
    assert.equal(res.status, 201);
    assert.equal(insertadas()[0].enviado.fin_ocupacion, dia(6));
  });

  test('un contrato antiguo sin entregar también puede empezar antes de hoy', async () => {
    const res = await alta('alquileres', datos({ origen: 'legacy', fecha_inicio: dia(-3) }));
    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.estado, 'confirmada');
  });

  test('uno manual que todavía hay que entregar no puede empezar antes de hoy (400)', async () => {
    const res = await alta('alquileres', datos({ fecha_inicio: dia(-1) }));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error: 'Un alquiler que todavía no se ha entregado no puede empezar antes de hoy.'
    });
    assert.equal((await alta('alquileres', datos({ fecha_inicio: hoy }))).status, 201);
  });

  test('todo en la tienda: sin dirección de entrega aunque haya dirección de contacto', async () => {
    const res = await alta(
      'alquileres',
      datos({ modo_entrega: 'tienda', modo_devolucion: 'tienda' })
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.direccion_entrega, null);
    assert.equal(res.body.reserva.contacto.direccion, 'Carrer de Sants 10, Barcelona');
  });

  test('con algún trayecto a domicilio hace falta la dirección (400)', async () => {
    const res = await alta(
      'alquileres',
      datos({ modo_entrega: 'tienda', modo_devolucion: 'domicilio', contacto: { nombre: 'Marta' } })
    );
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error: 'Escribe la dirección para la entrega o la recogida a domicilio.'
    });
  });

  test('sin importe ni más datos que el nombre: importe null y el resto del contacto null', async () => {
    const res = await alta(
      'alquileres',
      datos({
        modo_entrega: 'tienda',
        modo_devolucion: 'tienda',
        contacto: { nombre: 'Marta', email: '', telefono: null },
        importe_total_centimos: undefined
      })
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.reserva.importe_total, null);
    assert.deepEqual(res.body.reserva.contacto, {
      nombre: 'Marta',
      email: null,
      telefono: null,
      direccion: null,
      notas: null
    });
  });

  test('la forma: 400 con su mensaje y sin escribir nada', async () => {
    const casos = [
      [{ hora_entrega: '9:30' }, 'Elige la hora de entrega (HH:MM).'],
      [{ hora_recogida: '24:00' }, 'Elige la hora de recogida (HH:MM).'],
      [{ fecha_inicio: undefined }, 'Elige una fecha de entrega válida (AAAA-MM-DD).'],
      [{ fecha_fin: '2026-13-01' }, 'Elige una fecha de recogida válida (AAAA-MM-DD).'],
      [{ fecha_fin: dia(3) }, 'La fecha de fin tiene que ser posterior a la de inicio.'],
      [{ modo_entrega: 'mensajero' }, 'Elige cómo se entrega: a domicilio o en la tienda.'],
      [{ modo_devolucion: undefined }, 'Elige cómo se devuelve: a domicilio o en la tienda.'],
      [{ contacto: undefined }, 'Faltan los datos del cliente.'],
      [{ contacto: { nombre: ' ' } }, 'Escribe el nombre del cliente.'],
      [
        { contacto: { nombre: 'Marta', email: 'marta', direccion: 'x' } },
        'El email del cliente no es válido.'
      ],
      [
        { contacto: { nombre: 'Marta', direccion: 'x', telefono: '6'.repeat(31) } },
        'El teléfono es demasiado largo (máximo 30 caracteres).'
      ],
      [{ importe_total_centimos: 10.5 }, 'El importe tiene que ser un número entero de céntimos.'],
      [{ importe_total_centimos: -1 }, 'El importe no puede ser negativo.'],
      [
        { importe_total_centimos: '100' },
        'El importe tiene que ir en céntimos (12050 son 120,50 €).'
      ],
      [{ origen: 'web' }, 'Indica si es un alquiler fuera de la web o un contrato antiguo.'],
      [{ origen: undefined }, 'Indica si es un alquiler fuera de la web o un contrato antiguo.'],
      [{ ya_entregado: 'no' }, 'Indica si ya está entregado (true o false).']
    ];
    for (const [cambios, mensaje] of casos) {
      const res = await alta('alquileres', datos(cambios));
      assert.equal(res.status, 400, JSON.stringify(cambios));
      assert.deepEqual(res.body, { error: mensaje });
    }
    assert.equal(fake.escrituras.length, 0);
  });

  test('una pieza vendida no se alquila (400); una que no existe, 404', async () => {
    instalar({ muebles: MUEBLES('vendido') });
    assert.deepEqual((await alta('alquileres', datos())).body, {
      error: 'Esta pieza está vendida: no se puede alquilar.'
    });
    instalar();
    const res = await alta('alquileres', datos({ mueble_id: uuid(77) }));
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Mueble no encontrado.' });
    assert.equal(fake.escrituras.length, 0);
  });

  test('contra una reserva web: 409 que dice con cuál, sin datos de ese cliente', async () => {
    instalar({ reservas: [alquilerWeb()] });
    const res = await alta('alquileres', datos({ fecha_inicio: dia(11), fecha_fin: dia(12) }));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /^Esas fechas chocan con el alquiler #C0FFEE00 \(del /);
    sinDatosDeLuis(res.body.error);
  });

  test('su propio margen también cuenta: acabar dos días antes de un bloqueo choca', async () => {
    instalar({
      reservas: [bloqueo({ fecha_inicio: dia(7), fecha_fin: dia(9), fin_ocupacion: dia(9) })]
    });
    const res = await alta('alquileres', datos({ fecha_inicio: dia(3), fecha_fin: dia(6) }));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /^Esas fechas chocan con el bloqueo #B10C0000/);
    assert.equal(
      (await alta('alquileres', datos({ fecha_inicio: dia(3), fecha_fin: dia(5) }))).status,
      201
    );
  });
});

describe('POST /api/admin/reservas/ventas', () => {
  const datos = (cambios = {}) => ({
    mueble_id: SOFA,
    fecha_inicio: hoy,
    motivo: 'Vendida en la tienda',
    ...cambios
  });

  test('una venta de hoy: sin fin, origen manual, y la pieza pasa a vendida', async () => {
    const res = await alta('ventas', datos());

    assert.equal(res.status, 201);
    const { reserva } = res.body;
    assert.equal(reserva.tipo, 'venta');
    assert.equal(reserva.estado, 'confirmada');
    assert.equal(reserva.origen, 'manual');
    assert.equal(reserva.etiqueta, 'Venta');
    assert.deepEqual(reserva.acciones, ['cancelar']);
    assert.equal(reserva.fecha_fin, null);
    assert.equal(reserva.fin_ocupacion, null);
    assert.equal(reserva.motivo, 'Vendida en la tienda');
    const [{ fila }] = insertadas();
    assert.equal(fila.rango_ocupado, `[${hoy},)`);
    assert.equal(fila.historial[0].detalle, 'Venta fuera de la web: Vendida en la tienda');
    assert.equal(estadoPieza(), 'vendido');
  });

  test('marcarla vendida manda sobre un alquilado puesto a mano (3.3: vendida antes que alquilada)', async () => {
    instalar({ muebles: MUEBLES('alquilado') });
    assert.equal((await alta('ventas', datos())).status, 201);
    assert.equal(estadoPieza(), 'vendido');
  });

  test(`una venta ya hecha, de hasta ${DIAS_ATRAS_VENTA} días atrás, también la marca vendida`, async () => {
    const res = await alta('ventas', datos({ fecha_inicio: dia(-DIAS_ATRAS_VENTA) }));
    assert.equal(res.status, 201);
    assert.equal(estadoPieza(), 'vendido');
  });

  test('más atrás no (400)', async () => {
    const res = await alta('ventas', datos({ fecha_inicio: dia(-DIAS_ATRAS_VENTA - 1) }));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error:
        `Una venta ya hecha se puede registrar con fecha de hasta ${DIAS_ATRAS_VENTA} días atrás ` +
        `(desde el ${fechaLegible(dia(-DIAS_ATRAS_VENTA))}).`
    });
    assert.equal(fake.escrituras.length, 0);
  });

  test('con entrega diferida (empieza más adelante): la pieza sigue disponible hasta entonces', async () => {
    const res = await alta('ventas', datos({ fecha_inicio: dia(15) }));
    assert.equal(res.status, 201);
    assert.equal(estadoPieza(), 'disponible');
    assert.equal(fake.escrituras.filter((e) => e.tabla === 'muebles').length, 0);
  });

  test('contra reservas futuras: 409 con la última y el primer día en que puede empezar', async () => {
    instalar({ reservas: [alquilerWeb(), bloqueo()] });

    const res = await alta('ventas', datos());

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error:
        `La venta choca con el bloqueo #B10C0000 (del ${fechaLegible(dia(20))} al ` +
        `${fechaLegible(dia(25))}). Puede empezar, como pronto, el ${fechaLegible(dia(25))}.`
    });
    assert.equal(estadoPieza(), 'disponible');
    // Con esa fecha entra (la entrega diferida del 6.7).
    assert.equal((await alta('ventas', datos({ fecha_inicio: dia(25) }))).status, 201);
  });

  test('contra un alquiler, el primer día libre cuenta su margen', async () => {
    instalar({ reservas: [alquilerWeb()] });
    const res = await alta('ventas', datos());
    assert.equal(
      res.body.error,
      `La venta choca con el alquiler #C0FFEE00 (del ${fechaLegible(dia(10))} al ` +
        `${fechaLegible(dia(13))}, más 2 días de margen). Puede empezar, como pronto, el ` +
        `${fechaLegible(dia(15))}.`
    );
    sinDatosDeLuis(res.body.error);
  });

  test('una venta del panel (sin pedido) se nombra por su propia referencia', async () => {
    instalar({ reservas: [venta({ origen: 'manual', stripe_session_id: null })] });
    const res = await alta('ventas', datos({ fecha_inicio: dia(40) }));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /^La venta choca con la venta #FE0DA000 /);
  });

  test('contra otra venta: 409 que la nombra, sin día posible', async () => {
    instalar({ reservas: [venta()], muebles: MUEBLES('vendido') });
    const res = await alta('ventas', datos({ fecha_inicio: dia(40) }));
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: `La venta choca con la venta #${PEDIDO_VENTA} (desde el ${fechaLegible(dia(-3))}).`
    });
  });

  test('la forma: 400; una pieza que no existe, 404', async () => {
    assert.deepEqual((await alta('ventas', datos({ motivo: '' }))).body, {
      error: 'Escribe el motivo o una nota de la venta.'
    });
    assert.deepEqual((await alta('ventas', datos({ fecha_inicio: 'hoy' }))).body, {
      error: 'Elige una fecha válida para la venta (AAAA-MM-DD).'
    });
    const res = await alta('ventas', datos({ mueble_id: uuid(77) }));
    assert.equal(res.status, 404);
    assert.equal(fake.escrituras.length, 0);
  });
});
