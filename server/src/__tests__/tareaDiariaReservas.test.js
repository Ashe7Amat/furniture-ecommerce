// La tarea diaria de las reservas, GET /api/cron/reservas (docs/reservas-diseno.md, 8.5; bloque R-e,
// paso 19): el interruptor y el secreto de Vercel Cron, los recordatorios de entrega y devolución, la
// ampliación de los retrasados con su choque y el aviso de retraso, cada correo una sola vez.
// Supabase es el doble en memoria (con la restricción de solape de R2) y los correos, mocks: no se
// envía nada de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const app = require('../index');
const supabase = require('../data/supabase');
const email = require('../utils/email');
const { ejecutarTareaDiaria } = require('../utils/tareaDiariaReservas');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { hoyEnMadrid, sumarDias, fechaLegible } = require('../utils/fechasMadrid');

const SECRETO = 'secreto-de-cron-para-los-tests';
const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const SILLA = uuid(2);

const MUEBLES = [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'alquilado' },
  { id: SILLA, nombre: 'Silla Thonet', referencia: 'NAV-SIL-001', estado: 'disponible' }
];

const alquiler = (n, cambios = {}) => ({
  id: uuid(100 + n),
  mueble_id: SOFA,
  pedido_id: `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, '0')}`,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(2),
  hora_entrega: '10:00:00',
  fecha_fin: dia(5),
  hora_recogida: '18:30:00',
  fin_ocupacion: dia(5),
  dias_margen: 1,
  cliente_id: uuid(900),
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: 'Calle Mayor 15, Barcelona',
  datos_contacto: { nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456' },
  historial: [{ fecha: '2026-10-01T10:00:00.000Z', tipo: 'creada', por: 'cliente' }],
  ...cambios
});
// Entregado hace unos días y con la devolución pactada para `fin`.
const enCurso = (n, fin, cambios = {}) =>
  alquiler(n, {
    estado: 'en_curso',
    fecha_inicio: dia(-10),
    fecha_fin: fin,
    fin_ocupacion: fin,
    entregada_en: '2026-10-01T10:00:00.000Z',
    ...cambios
  });

let fake;
const instalar = (reservas = [], muebles = MUEBLES) => {
  fake = crearFakeSupabase({ muebles, reservas });
  mock.method(supabase, 'from', fake.from);
};
const fila = (id) => fake.tablas.reservas.find((r) => r.id === id);
const lineas = (id, tipo) => fila(id).historial.filter((l) => l.tipo === tipo);

let correos;
beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  process.env.CRON_SECRET = SECRETO;
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
  correos = {};
  for (const nombre of [
    'enviarRecordatorioEntrega',
    'enviarRecordatorioRecogida',
    'enviarAvisoRetraso',
    'enviarAlertaAdmin'
  ]) {
    correos[nombre] = mock.method(email, nombre, async () => {});
  }
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
  delete process.env.CRON_SECRET;
});

const lanzar = (autorizacion = `Bearer ${SECRETO}`) => {
  const peticion = request(app).get('/api/cron/reservas');
  return autorizacion === null ? peticion : peticion.set('Authorization', autorizacion);
};
const enviadosA = (nombre) => correos[nombre].mock.calls.map((c) => c.arguments[0]);

describe('la ruta: interruptor y secreto', () => {
  test('con RESERVAS_ACTIVAS apagado: 404, sin mirar el secreto ni la base de datos', async () => {
    delete process.env.RESERVAS_ACTIVAS;
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    for (const autorizacion of [`Bearer ${SECRETO}`, null]) {
      const res = await lanzar(autorizacion);
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: 'Ruta no encontrada.' });
    }
    assert.equal(from.mock.callCount(), 0);
  });

  test('RESERVAS_ACTIVAS con otro valor que "true" también cuenta como apagado', async () => {
    process.env.RESERVAS_ACTIVAS = '1';
    const res = await lanzar();
    assert.equal(res.status, 404);
  });

  test('sin CRON_SECRET en el servidor: 503, no se deja la tarea abierta', async () => {
    delete process.env.CRON_SECRET;
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    const res = await lanzar('Bearer ');
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: 'La tarea diaria no está configurada.' });
    assert.equal(from.mock.callCount(), 0);
  });

  test('sin cabecera, con otro secreto o sin "Bearer": 401 sin tocar nada', async () => {
    const from = mock.method(supabase, 'from', () => {
      throw new Error('no debería tocar la base de datos');
    });
    for (const autorizacion of [
      null,
      'Bearer otro',
      SECRETO,
      `Bearer ${SECRETO}x`,
      `bearer ${SECRETO}`
    ]) {
      const res = await lanzar(autorizacion);
      assert.equal(res.status, 401, String(autorizacion));
      assert.deepEqual(res.body, { error: 'No autorizado.' });
    }
    assert.equal(from.mock.callCount(), 0);
  });

  test('con el secreto: 200 con el resumen, sin datos personales', async () => {
    instalar([alquiler(1)]);
    const res = await lanzar();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      hoy,
      recordatoriosEntrega: { enviados: 1, errores: 0 },
      recordatoriosDevolucion: { enviados: 0, errores: 0 },
      retrasos: { total: 0, ampliados: 0, choques: 0, avisos: 0, errores: 0 }
    });
    assert.ok(!JSON.stringify(res.body).includes('ana@ejemplo.com'));
  });

  test('si falla la lectura de la base de datos: 500 genérico', async () => {
    fake = crearFakeSupabase({
      muebles: MUEBLES,
      reservas: [],
      fallos: { 'reservas.select': { message: 'connection reset' } }
    });
    mock.method(supabase, 'from', fake.from);
    const res = await lanzar();
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error al ejecutar la tarea diaria.' });
  });
});

describe('recordatorio de entrega', () => {
  test('a los alquileres confirmados que empiezan mañana o pasado, con los datos del correo', async () => {
    instalar([
      alquiler(1, { fecha_inicio: dia(2) }),
      alquiler(2, {
        fecha_inicio: dia(1),
        mueble_id: SILLA,
        fecha_fin: dia(3),
        fin_ocupacion: dia(3)
      }),
      alquiler(3, {
        fecha_inicio: dia(3),
        fecha_fin: dia(20),
        fin_ocupacion: dia(20),
        mueble_id: uuid(3)
      }),
      alquiler(4, {
        fecha_inicio: hoy,
        fecha_fin: dia(1),
        fin_ocupacion: dia(1),
        mueble_id: uuid(4)
      })
    ]);
    await ejecutarTareaDiaria();
    const enviados = enviadosA('enviarRecordatorioEntrega');
    assert.equal(enviados.length, 2);
    assert.deepEqual(enviados[0], {
      email: 'ana@ejemplo.com',
      nombre: 'Ana Martínez',
      reserva: {
        pedidoId: 'a1b2c3d4-0000-4000-8000-000000000001',
        pieza: 'Sofá Lumina',
        fechaInicio: dia(2),
        horaEntrega: '10:00',
        fechaFin: dia(5),
        horaRecogida: '18:30',
        modoEntrega: 'domicilio',
        modoRecogida: 'tienda',
        direccion: 'Calle Mayor 15, Barcelona'
      }
    });
    assert.equal(enviados[1].reserva.pieza, 'Silla Thonet');
    // Queda apuntado en el historial de las dos, por el sistema; las otras dos no se tocan.
    for (const n of [1, 2]) {
      const [linea] = lineas(uuid(100 + n), 'recordatorio_entrega');
      assert.equal(linea.por, 'sistema');
      assert.equal(linea.detalle, 'Recordatorio de entrega enviado al cliente.');
    }
    assert.equal(lineas(uuid(103), 'recordatorio_entrega').length, 0);
    assert.equal(lineas(uuid(104), 'recordatorio_entrega').length, 0);
  });

  test('una sola vez: la segunda ejecución (u otro día dentro del plazo) no lo repite', async () => {
    instalar([alquiler(1, { fecha_inicio: dia(2) })]);
    await ejecutarTareaDiaria();
    await ejecutarTareaDiaria();
    assert.equal(correos.enviarRecordatorioEntrega.mock.callCount(), 1);
    assert.equal(lineas(uuid(101), 'recordatorio_entrega').length, 1);
  });

  test('dos ejecuciones a la vez: un solo correo', async () => {
    instalar([alquiler(1, { fecha_inicio: dia(2) })]);
    await Promise.all([ejecutarTareaDiaria(), ejecutarTareaDiaria()]);
    assert.equal(correos.enviarRecordatorioEntrega.mock.callCount(), 1);
    assert.equal(lineas(uuid(101), 'recordatorio_entrega').length, 1);
  });

  test('ni a las provisionales, canceladas, bloqueos o ventas, ni a los contratos antiguos ni sin email', async () => {
    instalar([
      alquiler(1, { estado: 'pendiente', expira_en: '2099-01-01T00:00:00.000Z' }),
      alquiler(2, { estado: 'cancelada' }),
      alquiler(3, { tipo: 'bloqueo', datos_contacto: null, mueble_id: SILLA }),
      alquiler(4, { origen: 'legacy', mueble_id: uuid(3) }),
      alquiler(5, { datos_contacto: { nombre: 'Sin email' }, mueble_id: uuid(4) })
    ]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(correos.enviarRecordatorioEntrega.mock.callCount(), 0);
    assert.deepEqual(resumen.recordatoriosEntrega, { enviados: 0, errores: 0 });
  });

  test('un alta manual con email sí lo recibe', async () => {
    instalar([alquiler(1, { origen: 'manual' })]);
    await ejecutarTareaDiaria();
    assert.equal(correos.enviarRecordatorioEntrega.mock.callCount(), 1);
  });

  test('una pieza borrada del catálogo: el correo dice "tu pieza"', async () => {
    instalar([alquiler(1)], []);
    await ejecutarTareaDiaria();
    assert.equal(enviadosA('enviarRecordatorioEntrega')[0].reserva.pieza, 'tu pieza');
  });

  test('si no se puede apuntar en una reserva, no se envía, se cuenta el error y sigue con las demás', async () => {
    instalar([alquiler(1), alquiler(2, { mueble_id: SILLA })]);
    // Falla el primer UPDATE que llegue (el de la primera reserva).
    let primero = true;
    fake.fallos['reservas.update'] = () => {
      if (!primero) return null;
      primero = false;
      return { message: 'timeout' };
    };
    const resumen = await ejecutarTareaDiaria();
    assert.deepEqual(resumen.recordatoriosEntrega, { enviados: 1, errores: 1 });
    assert.equal(correos.enviarRecordatorioEntrega.mock.callCount(), 1);
  });
});

describe('recordatorio de devolución', () => {
  test('a los entregados que terminan mañana o pasado, no a los demás', async () => {
    instalar([
      enCurso(1, dia(1)),
      enCurso(2, dia(2), { mueble_id: SILLA }),
      enCurso(3, dia(3), { mueble_id: uuid(3) }),
      enCurso(4, hoy, { mueble_id: uuid(4) })
    ]);
    const resumen = await ejecutarTareaDiaria();
    const enviados = enviadosA('enviarRecordatorioRecogida');
    assert.deepEqual(
      enviados.map((e) => e.reserva.fechaFin),
      [dia(1), dia(2)]
    );
    assert.deepEqual(resumen.recordatoriosDevolucion, { enviados: 2, errores: 0 });
    assert.equal(lineas(uuid(101), 'recordatorio_recogida')[0].por, 'sistema');
    // Uno que termina hoy no está retrasado todavía: ni recordatorio ni aviso.
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 0);
    assert.equal(correos.enviarRecordatorioEntrega.mock.callCount(), 0);
  });

  test('una sola vez', async () => {
    instalar([enCurso(1, dia(2))]);
    await ejecutarTareaDiaria();
    await ejecutarTareaDiaria();
    assert.equal(correos.enviarRecordatorioRecogida.mock.callCount(), 1);
  });
});

describe('retrasados', () => {
  test('amplía la ocupación hasta mañana y avisa al cliente una vez', async () => {
    instalar([enCurso(1, dia(-2))]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(1));
    // La fecha pactada no cambia: es el rastro del 8.5.
    assert.equal(fila(uuid(101)).fecha_fin, dia(-2));
    assert.equal(fila(uuid(101)).estado, 'en_curso');
    const [ampliada] = lineas(uuid(101), 'ampliada');
    assert.equal(ampliada.por, 'sistema');
    assert.equal(
      ampliada.detalle,
      `Sin devolver: la pieza sigue ocupada hasta el ${fechaLegible(dia(1))} (antes, el ${fechaLegible(dia(-2))}).`
    );
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 1);
    assert.equal(enviadosA('enviarAvisoRetraso')[0].reserva.fechaFin, dia(-2));
    assert.deepEqual(resumen.retrasos, {
      total: 1,
      ampliados: 1,
      choques: 0,
      avisos: 1,
      errores: 0
    });
    assert.equal(correos.enviarAlertaAdmin.mock.callCount(), 0);
  });

  test('al día siguiente vuelve a ampliar, pero no repite el aviso al cliente', async () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    instalar([enCurso(1, dia(-3))]);
    await ejecutarTareaDiaria({ ahora: ayer });
    assert.equal(fila(uuid(101)).fin_ocupacion, hoy);
    await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(1));
    assert.equal(lineas(uuid(101), 'ampliada').length, 2);
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 1);
  });

  test('si ya llega a mañana (ampliado a mano desde el panel), no se toca, y el aviso sale igual', async () => {
    instalar([enCurso(1, dia(-1), { fin_ocupacion: dia(4) })]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(4));
    assert.equal(lineas(uuid(101), 'ampliada').length, 0);
    assert.deepEqual(resumen.retrasos, {
      total: 1,
      ampliados: 0,
      choques: 0,
      avisos: 1,
      errores: 0
    });
  });

  test('si la ampliación choca con la reserva siguiente: no cambia nada y avisa al administrador', async () => {
    instalar([
      enCurso(1, dia(-1), { dias_margen: 1 }),
      // Otro cliente la tiene desde mañana: [mañana, ...) se solapa con [.., mañana + 1 de margen).
      alquiler(2, {
        fecha_inicio: dia(1),
        fecha_fin: dia(4),
        fin_ocupacion: dia(4),
        pedido_id: 'beefcafe-0000-4000-8000-000000000002',
        datos_contacto: { nombre: 'Luis Pérez', email: 'luis@ejemplo.com', telefono: '611222333' }
      })
    ]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(-1));
    assert.equal(lineas(uuid(101), 'ampliada').length, 0);
    assert.equal(resumen.retrasos.choques, 1);
    assert.equal(resumen.retrasos.ampliados, 0);
    const [alerta] = enviadosA('enviarAlertaAdmin');
    assert.equal(alerta.asunto, 'Alquiler sin devolver que choca con la reserva siguiente');
    const texto = alerta.detalles.join('\n');
    assert.match(texto, /Pieza: Sofá Lumina/);
    assert.match(texto, /Ana Martínez <ana@ejemplo.com>/);
    assert.match(texto, /Choca con el alquiler #BEEFCAFE/);
    // Del otro cliente, solo la referencia: nada de sus datos.
    for (const dato of ['Luis', 'luis@ejemplo.com', '611222333']) {
      assert.ok(!texto.includes(dato), dato);
    }
    // Al cliente retrasado se le avisa igual.
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 1);
  });

  test('el choque se avisa cada día que siga (no se apunta como hecho)', async () => {
    instalar([
      enCurso(1, dia(-1), { dias_margen: 1 }),
      alquiler(2, { fecha_inicio: dia(1), fecha_fin: dia(4), fin_ocupacion: dia(4) })
    ]);
    await ejecutarTareaDiaria();
    await ejecutarTareaDiaria();
    assert.equal(correos.enviarAlertaAdmin.mock.callCount(), 2);
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 1);
  });

  test('dos ejecuciones a la vez: amplía una sola vez y avisa una sola vez', async () => {
    instalar([enCurso(1, dia(-2))]);
    const resumenes = await Promise.all([ejecutarTareaDiaria(), ejecutarTareaDiaria()]);
    assert.equal(
      resumenes.reduce((total, r) => total + r.retrasos.ampliados, 0),
      1
    );
    assert.equal(lineas(uuid(101), 'ampliada').length, 1);
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 1);
  });

  test('si la ampliación falla en la base de datos: se cuenta el error y el aviso sale igual', async () => {
    instalar([enCurso(1, dia(-2))]);
    fake.fallos['reservas.update'] = (consulta) =>
      consulta.datos.fin_ocupacion ? { message: 'timeout' } : null;
    const resumen = await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(-2));
    assert.deepEqual(resumen.retrasos, {
      total: 1,
      ampliados: 0,
      choques: 0,
      avisos: 1,
      errores: 1
    });
  });

  test('los de contratos antiguos no se tocan: los lleva el administrador', async () => {
    instalar([enCurso(1, dia(-2), { origen: 'legacy' })]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(-2));
    assert.equal(resumen.retrasos.total, 0);
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 0);
  });

  test('un retrasado sin email se amplía igual, sin aviso', async () => {
    instalar([enCurso(1, dia(-2), { datos_contacto: { nombre: 'Sin email' } })]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(fila(uuid(101)).fin_ocupacion, dia(1));
    assert.deepEqual(resumen.retrasos, {
      total: 1,
      ampliados: 1,
      choques: 0,
      avisos: 0,
      errores: 0
    });
  });

  test('ya devuelto o cancelado: no es un retraso', async () => {
    instalar([
      enCurso(1, dia(-2), { estado: 'devuelta', devuelta_en: '2026-10-01T10:00:00.000Z' }),
      enCurso(2, dia(-2), { estado: 'cancelada', mueble_id: SILLA })
    ]);
    const resumen = await ejecutarTareaDiaria();
    assert.equal(resumen.retrasos.total, 0);
    assert.equal(correos.enviarAvisoRetraso.mock.callCount(), 0);
  });
});
