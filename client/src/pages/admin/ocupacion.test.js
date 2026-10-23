// Cómo ocupa cada reserva los días de una pieza (ocupacion.js). Su lista de mutantes está en
// scripts/mutantes/ocupacion.js.
import { describe, it, expect } from 'vitest';
import {
  claseDe,
  parteDelDia,
  tramoDeRetraso,
  diaDeLaPieza,
  describirReserva,
  textoDelDia,
  textoDeBarra,
  textoDeRetraso,
  filasDeDetalle,
  textoReservasDelMes,
  textoPiezasConReservas,
  tramosDeLaReserva,
  filasDeOcupacion,
  avisosDeOcupacion
} from './ocupacion';

const HOY = '2026-11-10';
const SOFA = { id: 'm1', nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' };
const MESA = { id: 'm2', nombre: 'Mesa de roble', referencia: 'NAV-MES-007' };
// Un alquiler del 12 al 15 (se recoge el 15) con 2 días de margen: reservado 12, 13 y 14; margen 15 y 16.
const reserva = (cambios = {}) => ({
  id: 'r1',
  referencia: 'A1B2C3D4',
  tipo: 'alquiler',
  estado: 'confirmada',
  etiqueta: 'Confirmada',
  retrasada: false,
  en_conflicto: false,
  pieza: SOFA,
  cliente: 'Ana Pérez',
  motivo: null,
  fecha_inicio: '2026-11-12',
  hora_entrega: '10:00',
  fecha_fin: '2026-11-15',
  hora_recogida: '18:30',
  fin_ocupacion: '2026-11-15',
  dias_margen: 2,
  ocupada_hasta: '2026-11-17',
  ...cambios
});
const VENTA = reserva({
  id: 'r3',
  referencia: 'E5F6A7B8',
  tipo: 'venta',
  etiqueta: 'Venta',
  cliente: null,
  fecha_inicio: '2026-11-20',
  fecha_fin: null,
  fin_ocupacion: null,
  dias_margen: 0,
  ocupada_hasta: null,
  hora_entrega: null,
  hora_recogida: null
});
const BLOQUEO = reserva({
  id: 'r4',
  referencia: 'C3D4E5F6',
  tipo: 'bloqueo',
  etiqueta: 'Bloqueo',
  cliente: null,
  motivo: 'Exposición en la tienda',
  fecha_inicio: '2026-11-18',
  fecha_fin: '2026-11-19',
  fin_ocupacion: '2026-11-19',
  dias_margen: 0,
  ocupada_hasta: '2026-11-19'
});
// Entregada el 1, tenía que volver el 6 y con 2 días de margen su ocupación acabó el 8: la pieza sigue fuera.
const RETRASADA = reserva({
  id: 'r2',
  referencia: 'B2C3D4E5',
  estado: 'en_curso',
  etiqueta: 'Retrasada',
  retrasada: true,
  pieza: MESA,
  fecha_inicio: '2026-11-01',
  fecha_fin: '2026-11-06',
  fin_ocupacion: '2026-11-06',
  ocupada_hasta: '2026-11-08'
});

describe('claseDe', () => {
  it('cada tipo y estado tiene su aspecto', () => {
    expect(claseDe(reserva())).toBe('alquiler');
    expect(claseDe(reserva({ estado: 'en_curso', etiqueta: 'Entregada' }))).toBe('alquiler');
    expect(claseDe(reserva({ estado: 'devuelta', etiqueta: 'Devuelta' }))).toBe('alquiler');
    expect(claseDe(reserva({ estado: 'pendiente', etiqueta: 'Esperando pago' }))).toBe('pendiente');
    expect(claseDe(RETRASADA)).toBe('retrasada');
    expect(claseDe(BLOQUEO)).toBe('bloqueo');
    expect(claseDe(VENTA)).toBe('venta');
  });

  it('una venta o un bloqueo manda sobre el resto, y una retrasada sobre esperar pago', () => {
    expect(claseDe({ ...VENTA, retrasada: true, estado: 'pendiente' })).toBe('venta');
    expect(claseDe({ ...BLOQUEO, retrasada: true })).toBe('bloqueo');
    expect(claseDe(reserva({ retrasada: true, estado: 'pendiente' }))).toBe('retrasada');
  });
});

describe('parteDelDia', () => {
  it('antes de empezar no es de la reserva; los días hasta la recogida son de reserva; luego, margen', () => {
    const r = reserva();
    expect(parteDelDia(r, '2026-11-11')).toBeNull();
    expect(parteDelDia(r, '2026-11-12')).toBe('reserva');
    expect(parteDelDia(r, '2026-11-14')).toBe('reserva');
    expect(parteDelDia(r, '2026-11-15')).toBe('margen');
    expect(parteDelDia(r, '2026-11-16')).toBe('margen');
    expect(parteDelDia(r, '2026-11-17')).toBeNull();
  });

  it('sin margen, el día de la recogida ya está libre', () => {
    const r = reserva({ dias_margen: 0, ocupada_hasta: '2026-11-15' });
    expect(parteDelDia(r, '2026-11-14')).toBe('reserva');
    expect(parteDelDia(r, '2026-11-15')).toBeNull();
  });

  it('una venta no tiene fin: de reserva desde su día para siempre', () => {
    expect(parteDelDia(VENTA, '2026-11-19')).toBeNull();
    expect(parteDelDia(VENTA, '2026-11-20')).toBe('reserva');
    expect(parteDelDia(VENTA, '2030-01-01')).toBe('reserva');
  });

  it('una recogida ampliada ocupa hasta su nueva fecha', () => {
    const r = reserva({ fin_ocupacion: '2026-11-18', ocupada_hasta: '2026-11-20' });
    expect(parteDelDia(r, '2026-11-15')).toBe('reserva');
    expect(parteDelDia(r, '2026-11-18')).toBe('margen');
    expect(parteDelDia(r, '2026-11-20')).toBeNull();
  });
});

describe('parteDelDia de una retrasada: la pieza sigue fuera, no descansa', () => {
  // Tenía que volver el 6 y con 3 días de margen su ocupación llega al 9; hoy es el 8, el 2.º día de retraso.
  const tardia = { ...RETRASADA, dias_margen: 3, ocupada_hasta: '2026-11-09' };
  const HOY_TARDIO = '2026-11-08';

  it('los días de margen que ya han llegado, hoy incluido, son de reserva', () => {
    expect(parteDelDia(tardia, '2026-11-05', HOY_TARDIO)).toBe('reserva');
    expect(parteDelDia(tardia, '2026-11-06', HOY_TARDIO)).toBe('reserva');
    expect(parteDelDia(tardia, '2026-11-07', HOY_TARDIO)).toBe('reserva');
    expect(parteDelDia(tardia, HOY_TARDIO, HOY_TARDIO)).toBe('reserva');
  });

  it('el margen que queda por delante sigue siendo margen, y luego, libre', () => {
    expect(parteDelDia(tardia, '2026-11-09', HOY_TARDIO)).toBeNull();
    expect(parteDelDia(tardia, '2026-11-08', '2026-11-07')).toBe('margen');
    expect(parteDelDia(tardia, '2026-11-07', '2026-11-07')).toBe('reserva');
  });

  it('sin hoy no se sabe que la pieza sigue fuera, y una no retrasada no cambia', () => {
    expect(parteDelDia(tardia, '2026-11-06')).toBe('margen');
    expect(parteDelDia({ ...tardia, retrasada: false }, '2026-11-06', HOY_TARDIO)).toBe('margen');
  });

  it('una venta marcada como retrasada por error (no existe) sigue sin fin', () => {
    expect(parteDelDia({ ...VENTA, retrasada: true }, '2030-01-01', HOY)).toBe('reserva');
  });

  it('si su ocupación ya llega más allá de hoy (una ampliación), nada cambia', () => {
    const ampliada = { ...tardia, fin_ocupacion: '2026-11-12', ocupada_hasta: '2026-11-15' };
    expect(parteDelDia(ampliada, '2026-11-11', HOY_TARDIO)).toBe('reserva');
    expect(parteDelDia(ampliada, '2026-11-12', HOY_TARDIO)).toBe('margen');
  });

  it('en el calendario de una pieza, el margen de una retrasada que ya ha llegado es de reserva', () => {
    const dia = diaDeLaPieza([tardia], '2026-11-07', HOY_TARDIO);
    expect(dia).toEqual({ reserva: tardia, parte: 'reserva', retraso: null });
  });
});

describe('tramoDeRetraso', () => {
  it('desde que acaba su ocupación hasta hoy, hoy incluido', () => {
    expect(tramoDeRetraso(RETRASADA, HOY)).toEqual({ desde: '2026-11-08', hasta: '2026-11-11' });
  });

  it('una reserva que no está retrasada, o cuya ocupación aún llega a hoy, no tiene', () => {
    expect(tramoDeRetraso(reserva(), HOY)).toBeNull();
    // Una reserva ya acabada (su ocupación acabó antes de hoy) tampoco: no es una retrasada.
    expect(tramoDeRetraso(reserva({ ocupada_hasta: '2026-11-08' }), HOY)).toBeNull();
    expect(tramoDeRetraso({ ...RETRASADA, ocupada_hasta: '2026-11-11' }, HOY)).toBeNull();
    expect(tramoDeRetraso({ ...RETRASADA, ocupada_hasta: HOY }, HOY)).toEqual({
      desde: HOY,
      hasta: '2026-11-11'
    });
  });

  it('una retrasada sin fin no tiene (no existe, pero no revienta)', () => {
    expect(tramoDeRetraso({ ...RETRASADA, ocupada_hasta: null }, HOY)).toBeNull();
  });
});

describe('diaDeLaPieza', () => {
  it('sin nada, libre', () => {
    expect(diaDeLaPieza([], '2026-11-12', HOY)).toEqual({ reserva: null, parte: null, retraso: null });
  });

  it('la reserva que ocupa el día y de qué parte', () => {
    const r = reserva();
    expect(diaDeLaPieza([r, VENTA], '2026-11-13', HOY)).toEqual({ reserva: r, parte: 'reserva', retraso: null });
    expect(diaDeLaPieza([r, VENTA], '2026-11-16', HOY)).toEqual({ reserva: r, parte: 'margen', retraso: null });
    expect(diaDeLaPieza([r, VENTA], '2026-11-25', HOY)).toEqual({ reserva: VENTA, parte: 'reserva', retraso: null });
  });

  it('una retrasada deja la pieza fuera los días entre el fin de su ocupación y hoy', () => {
    const libre = diaDeLaPieza([RETRASADA], '2026-11-09', HOY);
    expect(libre).toEqual({ reserva: null, parte: null, retraso: RETRASADA });
    expect(diaDeLaPieza([RETRASADA], '2026-11-11', HOY).retraso).toBeNull();
    expect(diaDeLaPieza([RETRASADA], HOY, HOY).retraso).toBe(RETRASADA);
    expect(diaDeLaPieza([RETRASADA], '2026-11-07', HOY).retraso).toBeNull();
    // El primer día en que la pieza está fuera es el que deja libre la ocupación.
    expect(diaDeLaPieza([RETRASADA], '2026-11-08', HOY).retraso).toBe(RETRASADA);
  });

  it('si la siguiente ya ocupa un día en que sigue fuera la retrasada, salen las dos', () => {
    const siguiente = reserva({ id: 'r5', pieza: MESA, fecha_inicio: '2026-11-09', fin_ocupacion: '2026-11-12', ocupada_hasta: '2026-11-14' });
    const dia = diaDeLaPieza([RETRASADA, siguiente], '2026-11-09', HOY);
    expect(dia.reserva).toBe(siguiente);
    expect(dia.retraso).toBe(RETRASADA);
  });
});

describe('textos', () => {
  it('describirReserva: un alquiler con su cliente y estado; un bloqueo con su motivo; una venta, sola', () => {
    expect(describirReserva(reserva())).toBe('alquiler A1B2C3D4 de Ana Pérez, confirmada');
    expect(describirReserva(reserva({ cliente: null, etiqueta: 'Esperando pago' }))).toBe(
      'alquiler A1B2C3D4, esperando pago'
    );
    expect(describirReserva(BLOQUEO)).toBe('bloqueo C3D4E5F6 (Exposición en la tienda)');
    expect(describirReserva({ ...BLOQUEO, motivo: null })).toBe('bloqueo C3D4E5F6');
    expect(describirReserva(VENTA)).toBe('venta E5F6A7B8');
  });

  it('textoDelDia: libre, de reserva, de margen, y con la pieza fuera', () => {
    const r = reserva();
    expect(textoDelDia('2026-11-11', { reserva: null, parte: null, retraso: null })).toBe(
      'miércoles, 11 de noviembre de 2026: libre'
    );
    expect(textoDelDia('2026-11-13', { reserva: r, parte: 'reserva', retraso: null })).toBe(
      'viernes, 13 de noviembre de 2026: alquiler A1B2C3D4 de Ana Pérez, confirmada'
    );
    expect(textoDelDia('2026-11-16', { reserva: r, parte: 'margen', retraso: null })).toBe(
      'lunes, 16 de noviembre de 2026: margen después de alquiler A1B2C3D4 de Ana Pérez, confirmada'
    );
    expect(textoDelDia('2026-11-09', { reserva: null, parte: null, retraso: RETRASADA })).toBe(
      'lunes, 9 de noviembre de 2026: libre en el calendario, pero la pieza sigue fuera, alquiler B2C3D4E5 de Ana Pérez, retrasada'
    );
    expect(textoDelDia('2026-11-09', { reserva: r, parte: 'reserva', retraso: RETRASADA })).toBe(
      'lunes, 9 de noviembre de 2026: alquiler A1B2C3D4 de Ana Pérez, confirmada; la pieza sigue fuera de alquiler B2C3D4E5 de Ana Pérez, retrasada'
    );
  });
});

describe('textos de los resúmenes', () => {
  it('textoReservasDelMes: ninguna, una o varias, con el mes', () => {
    expect(textoReservasDelMes(0, '2026-11')).toBe('Ninguna reserva en noviembre de 2026.');
    expect(textoReservasDelMes(1, '2026-11')).toBe('1 reserva en noviembre de 2026.');
    expect(textoReservasDelMes(3, '2026-12')).toBe('3 reservas en diciembre de 2026.');
  });

  it('textoPiezasConReservas: ninguna, una o varias, con los días que se ven', () => {
    expect(textoPiezasConReservas(0, 30)).toBe('Ninguna pieza tiene reservas en los 30 días que se ven.');
    expect(textoPiezasConReservas(1, 30)).toBe('1 pieza tiene reservas en los 30 días que se ven.');
    expect(textoPiezasConReservas(2, 60)).toBe('2 piezas tienen reservas en los 60 días que se ven.');
  });
});

describe('textos de las barras', () => {
  it('textoDeBarra: las fechas y el margen; una venta, sin fin', () => {
    expect(textoDeBarra(reserva())).toBe(
      'alquiler A1B2C3D4 de Ana Pérez, confirmada, del 12/11/2026 al 15/11/2026, con 2 días de margen'
    );
    expect(textoDeBarra(reserva({ dias_margen: 1 }))).toContain('con 1 día de margen');
    expect(textoDeBarra(reserva({ dias_margen: 0, ocupada_hasta: '2026-11-15' }))).toBe(
      'alquiler A1B2C3D4 de Ana Pérez, confirmada, del 12/11/2026 al 15/11/2026'
    );
    // Una recogida ampliada: la barra acaba cuando vuelve la pieza, no el día previsto.
    expect(textoDeBarra(reserva({ fin_ocupacion: '2026-11-17', ocupada_hasta: '2026-11-19' }))).toBe(
      'alquiler A1B2C3D4 de Ana Pérez, confirmada, del 12/11/2026 al 17/11/2026, con 2 días de margen'
    );
    expect(textoDeBarra(BLOQUEO)).toBe('bloqueo C3D4E5F6 (Exposición en la tienda), del 18/11/2026 al 19/11/2026');
    expect(textoDeBarra(VENTA)).toBe('venta E5F6A7B8, desde el 20/11/2026, sin fin');
  });

  it('textoDeRetraso: cuándo se tenía que recoger y que la pieza sigue fuera', () => {
    expect(textoDeRetraso(RETRASADA)).toBe(
      'alquiler B2C3D4E5 de Ana Pérez, retrasada: la recogida estaba prevista el 06/11/2026 y la pieza sigue fuera'
    );
  });
});

describe('filasDeDetalle', () => {
  const etiquetas = (r) => filasDeDetalle(r).map(([etiqueta]) => etiqueta);
  const valor = (r, etiqueta) => filasDeDetalle(r).find(([e]) => e === etiqueta)?.[1];

  it('un alquiler: cliente, entrega, recogida, margen y cuándo queda libre', () => {
    expect(filasDeDetalle(reserva())).toEqual([
      ['Cliente', 'Ana Pérez'],
      ['Entrega', '12/11/2026 a las 10:00'],
      ['Recogida', '15/11/2026 a las 18:30'],
      ['Margen', '2 días después de la recogida'],
      ['Libre de nuevo el', '17/11/2026']
    ]);
  });

  it('en singular con un día de margen, y sin la fila si no hay', () => {
    expect(valor(reserva({ dias_margen: 1, ocupada_hasta: '2026-11-16' }), 'Margen')).toBe('1 día después de la recogida');
    expect(etiquetas(reserva({ dias_margen: 0, ocupada_hasta: '2026-11-15' }))).not.toContain('Margen');
  });

  it('sin hora, solo la fecha; sin cliente, sin esa fila', () => {
    const r = reserva({ hora_entrega: null, hora_recogida: null, cliente: null });
    expect(valor(r, 'Entrega')).toBe('12/11/2026');
    expect(valor(r, 'Recogida')).toBe('15/11/2026');
    expect(etiquetas(r)).not.toContain('Cliente');
  });

  it('una ocupación ampliada lo dice; una devuelta no (ocupa hasta la devolución real)', () => {
    const ampliada = reserva({ fin_ocupacion: '2026-11-18', ocupada_hasta: '2026-11-20' });
    expect(valor(ampliada, 'Ocupación ampliada hasta')).toBe('18/11/2026');
    expect(valor({ ...ampliada, estado: 'devuelta' }, 'Ocupación ampliada hasta')).toBeUndefined();
    expect(etiquetas(reserva())).not.toContain('Ocupación ampliada hasta');
  });

  it('un alquiler sin fecha de recogida no tiene esa fila (y no revienta)', () => {
    const filas = filasDeDetalle(reserva({ fecha_fin: null, hora_recogida: null }));
    expect(filas.map(([etiqueta]) => etiqueta)).not.toContain('Recogida');
    expect(filas.map(([etiqueta]) => etiqueta)).toContain('Entrega');
  });

  it('un bloqueo: desde, cuándo queda libre y el motivo; una venta, solo desde', () => {
    expect(filasDeDetalle(BLOQUEO)).toEqual([
      ['Desde', '18/11/2026'],
      ['Libre de nuevo el', '19/11/2026'],
      ['Motivo', 'Exposición en la tienda']
    ]);
    expect(filasDeDetalle(VENTA)).toEqual([['Desde', '20/11/2026']]);
  });
});

describe('tramosDeLaReserva (ventana de 10 días desde el 10)', () => {
  const tramos = (r, inicio = '2026-11-10', n = 10) => tramosDeLaReserva(r, inicio, n, HOY);

  it('en columnas: los días de reserva y los de margen, pegados', () => {
    expect(tramos(reserva())).toMatchObject({ reservado: [2, 5], margen: [5, 7], retraso: null });
  });

  it('se recorta por los dos lados y lo dice', () => {
    const larga = reserva({ fecha_inicio: '2026-11-05', fin_ocupacion: '2026-11-30', ocupada_hasta: '2026-12-02' });
    expect(tramos(larga)).toEqual({ reservado: [0, 10], margen: null, retraso: null, cortaIzq: true, cortaDer: true });
    expect(tramos(reserva()).cortaIzq).toBe(false);
    // Empezar justo el primer día de la ventana no es empezar antes.
    expect(tramos(reserva({ fecha_inicio: '2026-11-10' })).cortaIzq).toBe(false);
    expect(tramos(reserva({ fecha_inicio: '2026-11-09' })).cortaIzq).toBe(true);
    expect(tramos(reserva()).cortaDer).toBe(false);
  });

  it('el margen que empieza dentro y acaba fuera sigue "cortado" por la derecha', () => {
    const r = reserva({ fecha_inicio: '2026-11-17', fin_ocupacion: '2026-11-19', ocupada_hasta: '2026-11-22' });
    expect(tramos(r)).toEqual({ reservado: [7, 9], margen: [9, 10], retraso: null, cortaIzq: false, cortaDer: true });
  });

  it('una reserva que acaba justo al borde de la ventana no está cortada por la derecha', () => {
    const r = reserva({ fecha_inicio: '2026-11-17', fin_ocupacion: '2026-11-18', ocupada_hasta: '2026-11-20' });
    expect(tramos(r).cortaDer).toBe(false);
  });

  it('una reserva que acaba antes de la ventana, o empieza después, no tiene tramos', () => {
    expect(tramos(reserva({ fecha_inicio: '2026-11-01', fin_ocupacion: '2026-11-05', ocupada_hasta: '2026-11-07' }))).toMatchObject({
      reservado: null,
      margen: null
    });
    expect(tramos(reserva({ fecha_inicio: '2026-11-25', fin_ocupacion: '2026-11-28', ocupada_hasta: '2026-11-30' }))).toMatchObject({
      reservado: null,
      margen: null
    });
  });

  it('solo el margen dentro de la ventana', () => {
    const r = reserva({ fecha_inicio: '2026-11-05', fin_ocupacion: '2026-11-10', ocupada_hasta: '2026-11-12' });
    expect(tramos(r)).toMatchObject({ reservado: null, margen: [0, 2], cortaIzq: true });
  });

  it('una venta ocupa desde su día hasta el final de la ventana, y no tiene margen', () => {
    const venta = { ...VENTA, fecha_inicio: '2026-11-14' };
    expect(tramos(venta)).toEqual({ reservado: [4, 10], margen: null, retraso: null, cortaIzq: false, cortaDer: true });
    expect(tramos(VENTA)).toMatchObject({ reservado: null, margen: null });
  });

  it('una retrasada enseña los días que lleva la pieza fuera hasta hoy', () => {
    // Su margen (del 6 al 8) ya ha pasado con la pieza fuera: es tiempo reservado, no de descanso.
    expect(tramosDeLaReserva(RETRASADA, '2026-11-05', 10, HOY)).toEqual({
      reservado: [0, 3],
      margen: null,
      retraso: [3, 6],
      cortaIzq: true,
      cortaDer: false
    });
  });

  it('una retrasada con margen por delante de hoy lo enseña como margen', () => {
    const tardia = { ...RETRASADA, dias_margen: 3, ocupada_hasta: '2026-11-09' };
    expect(tramosDeLaReserva(tardia, '2026-11-05', 10, '2026-11-07')).toEqual({
      reservado: [0, 3],
      margen: [3, 4],
      retraso: null,
      cortaIzq: true,
      cortaDer: false
    });
  });
});

describe('filasDeOcupacion', () => {
  it('una fila por pieza, por nombre, solo con las piezas que tienen algo en la ventana', () => {
    const otraSofa = reserva({ id: 'r6', referencia: 'D4E5F6A7', fecha_inicio: '2026-11-18', fin_ocupacion: '2026-11-20', ocupada_hasta: '2026-11-22' });
    const lejana = reserva({ id: 'r7', pieza: { id: 'm9', nombre: 'Aparador', referencia: 'NAV-APA-002' }, fecha_inicio: '2027-01-10', fin_ocupacion: '2027-01-12', ocupada_hasta: '2027-01-14' });
    const filas = filasDeOcupacion([otraSofa, RETRASADA, reserva(), lejana], '2026-11-10', 14, HOY);
    expect(filas.map((f) => f.pieza.nombre)).toEqual(['Mesa de roble', 'Sofá Lumina']);
    expect(filas[1].barras.map((b) => b.reserva.id)).toEqual(['r6', 'r1']);
  });

  it('una retrasada cuya ocupación ya acabó antes de la ventana sigue saliendo si la pieza sigue fuera', () => {
    const filas = filasDeOcupacion([RETRASADA], '2026-11-09', 7, HOY);
    expect(filas).toHaveLength(1);
    expect(filas[0].barras[0]).toMatchObject({ reserva: RETRASADA, reservado: null, margen: null, retraso: [0, 2] });
  });

  it('una pieza cuya reserva acabó antes de la ventana pero cuyo margen llega a ella sale', () => {
    const r = reserva({ fecha_inicio: '2026-11-05', fin_ocupacion: '2026-11-10', ocupada_hasta: '2026-11-12' });
    const filas = filasDeOcupacion([r], '2026-11-10', 7, HOY);
    expect(filas).toHaveLength(1);
    expect(filas[0].barras[0]).toMatchObject({ reservado: null, margen: [0, 2], retraso: null });
  });

  it('una venta de antes de la ventana no hace fila (no pasa nada en esos días); una de dentro, sí', () => {
    const vendida = (cambios) => ({ ...VENTA, pieza: MESA, ...cambios });
    expect(filasDeOcupacion([vendida({ fecha_inicio: '2026-11-09' })], '2026-11-10', 14, HOY)).toEqual([]);
    expect(filasDeOcupacion([vendida({ fecha_inicio: '2026-11-10' })], '2026-11-10', 14, HOY)).toHaveLength(1);
    expect(filasDeOcupacion([vendida({ fecha_inicio: '2026-11-15' })], '2026-11-10', 14, HOY)).toHaveLength(1);
    // Un alquiler que empezó antes de la ventana y sigue en ella sí sale: la pieza está ocupada.
    expect(filasDeOcupacion([reserva({ fecha_inicio: '2026-11-01', fin_ocupacion: '2026-11-12', ocupada_hasta: '2026-11-14' })], '2026-11-10', 14, HOY)).toHaveLength(1);
  });

  it('sin reservas, sin filas', () => {
    expect(filasDeOcupacion([], '2026-11-10', 14, HOY)).toEqual([]);
  });

  it('ordena como en español: la Á cuenta como A y la Ñ va después de la N', () => {
    const pieza = (id, nombre) => reserva({ id, pieza: { id, nombre, referencia: `NAV-${id}` } });
    const filas = filasDeOcupacion([pieza('a', 'Zapatero'), pieza('b', 'Árbol'), pieza('c', 'Armario'), pieza('d', 'Ñandú'), pieza('e', 'Nido')], '2026-11-10', 14, HOY);
    expect(filas.map((f) => f.pieza.nombre)).toEqual(['Árbol', 'Armario', 'Nido', 'Ñandú', 'Zapatero']);
  });
});

describe('avisosDeOcupacion', () => {
  const siguiente = (cambios) =>
    reserva({ id: 'r8', referencia: 'F6A7B8C9', pieza: MESA, fecha_inicio: '2026-11-12', fin_ocupacion: '2026-11-14', ocupada_hasta: '2026-11-16', ...cambios });

  it('avisa de la retrasada con la siguiente reserva de la misma pieza, y cuándo empieza', () => {
    const [aviso] = avisosDeOcupacion([RETRASADA, siguiente()], HOY);
    expect(aviso.clave).toBe('r2:r8');
    expect(aviso.texto).toBe(
      'Mesa de roble: la reserva B2C3D4E5 está retrasada y la siguiente, F6A7B8C9, empieza dentro de 2 días (el 12/11/2026).'
    );
  });

  it('hoy, mañana y ya pasado', () => {
    expect(avisosDeOcupacion([RETRASADA, siguiente({ fecha_inicio: HOY })], HOY)[0].texto).toContain('F6A7B8C9, empieza hoy.');
    expect(avisosDeOcupacion([RETRASADA, siguiente({ fecha_inicio: '2026-11-11' })], HOY)[0].texto).toContain('F6A7B8C9, empieza mañana.');
    expect(avisosDeOcupacion([RETRASADA, siguiente({ fecha_inicio: '2026-11-09' })], HOY)[0].texto).toContain(
      'F6A7B8C9, tenía que empezar el 09/11/2026.'
    );
  });

  it('a partir de pasado mañana, en días', () => {
    expect(avisosDeOcupacion([RETRASADA, siguiente({ fecha_inicio: '2026-11-12' })], HOY)[0].texto).toContain('dentro de 2 días');
  });

  it('solo cuenta las reservas de la misma pieza y posteriores al inicio de la retrasada', () => {
    const deOtraPieza = reserva({ id: 'r9', pieza: SOFA, fecha_inicio: '2026-11-12' });
    const anterior = siguiente({ id: 'r10', fecha_inicio: '2026-10-20', fin_ocupacion: '2026-10-25', ocupada_hasta: '2026-10-27' });
    expect(avisosDeOcupacion([RETRASADA, deOtraPieza, anterior], HOY)).toEqual([]);
  });

  it('con varias a continuación, la más cercana', () => {
    const lejos = siguiente({ id: 'r11', referencia: '0A1B2C3D', fecha_inicio: '2026-12-01', fin_ocupacion: '2026-12-03', ocupada_hasta: '2026-12-05' });
    const [aviso] = avisosDeOcupacion([RETRASADA, lejos, siguiente()], HOY);
    expect(aviso.clave).toBe('r2:r8');
  });

  it('sin retrasadas, o sin otra reserva después, no hay avisos', () => {
    expect(avisosDeOcupacion([reserva(), siguiente()], HOY)).toEqual([]);
    expect(avisosDeOcupacion([RETRASADA], HOY)).toEqual([]);
  });

  it('las más cercanas primero', () => {
    const otraRetrasada = reserva({
      id: 'r12', referencia: '1B2C3D4E', estado: 'en_curso', etiqueta: 'Retrasada', retrasada: true,
      fecha_inicio: '2026-11-02', fin_ocupacion: '2026-11-05', ocupada_hasta: '2026-11-07'
    });
    const despues = reserva({ id: 'r13', referencia: '2C3D4E5F', fecha_inicio: '2026-11-11', fin_ocupacion: '2026-11-13', ocupada_hasta: '2026-11-15' });
    const avisos = avisosDeOcupacion([RETRASADA, siguiente({ fecha_inicio: '2026-11-14', fin_ocupacion: '2026-11-16', ocupada_hasta: '2026-11-18' }), otraRetrasada, despues], HOY);
    expect(avisos.map((a) => a.clave)).toEqual(['r12:r13', 'r2:r8']);
  });
});

describe('avisosDeOcupacion: alquileres seguidos', () => {
  // r1 (sofá) deja la pieza libre el 17: la siguiente empieza ese día, sin un día de sobra.
  const seguida = (cambios) =>
    reserva({ id: 'r20', referencia: '3D4E5F6A', fecha_inicio: '2026-11-17', fin_ocupacion: '2026-11-19', ocupada_hasta: '2026-11-21', ...cambios });

  it('avisa de dos alquileres que van seguidos', () => {
    const [aviso] = avisosDeOcupacion([reserva(), seguida()], HOY);
    expect(aviso).toEqual({
      clave: 'r1:r20:justo',
      tipo: 'justo',
      dia: '2026-11-17',
      texto:
        'Sofá Lumina: las reservas A1B2C3D4 y 3D4E5F6A van seguidas, sin ningún día de sobra: la pieza queda libre el 17/11/2026 y 3D4E5F6A empieza ese día.'
    });
  });

  it('con un día de sobra, no', () => {
    expect(avisosDeOcupacion([reserva(), seguida({ fecha_inicio: '2026-11-18' })], HOY)).toEqual([]);
  });

  it('da igual el orden en que lleguen', () => {
    expect(avisosDeOcupacion([seguida(), reserva()], HOY)).toHaveLength(1);
  });

  it('solo entre alquileres: un bloqueo o una venta detrás no cuenta', () => {
    expect(avisosDeOcupacion([reserva(), seguida({ tipo: 'bloqueo' })], HOY)).toEqual([]);
    expect(avisosDeOcupacion([reserva({ tipo: 'bloqueo' }), seguida()], HOY)).toEqual([]);
  });

  it('no en piezas distintas', () => {
    expect(avisosDeOcupacion([reserva(), seguida({ pieza: MESA })], HOY)).toEqual([]);
  });

  it('no si la primera ya volvió, está retrasada (tiene su aviso) o la segunda ya empezó', () => {
    expect(avisosDeOcupacion([reserva({ estado: 'devuelta', etiqueta: 'Devuelta' }), seguida()], HOY)).toEqual([]);
    expect(
      avisosDeOcupacion([reserva({ retrasada: true, etiqueta: 'Retrasada' }), seguida()], HOY).map((a) => a.tipo)
    ).toEqual(['retraso']);
    expect(avisosDeOcupacion([reserva(), seguida()], '2026-11-18')).toEqual([]);
  });

  it('el día que empieza la segunda sigue valiendo (hoy)', () => {
    expect(avisosDeOcupacion([reserva(), seguida()], '2026-11-17')).toHaveLength(1);
  });

  it('dos que no se tocan, aunque sean de la misma pieza, no', () => {
    expect(avisosDeOcupacion([reserva(), seguida({ fecha_inicio: '2026-11-25', fin_ocupacion: '2026-11-27', ocupada_hasta: '2026-11-29' })], HOY)).toEqual([]);
  });
});

describe('avisosDeOcupacion: sin hora', () => {
  const textos = (reservas, hoy = HOY) => avisosDeOcupacion(reservas, hoy).map((a) => a.texto);

  it('un alquiler confirmado sin hora de entrega', () => {
    expect(textos([reserva({ hora_entrega: null })])).toEqual([
      'Sofá Lumina: la reserva A1B2C3D4 no tiene hora de entrega (el 12/11/2026).'
    ]);
  });

  it('y sin hora de recogida', () => {
    expect(textos([reserva({ hora_recogida: null })])).toEqual([
      'Sofá Lumina: la reserva A1B2C3D4 no tiene hora de recogida (el 15/11/2026).'
    ]);
  });

  it('sin las dos, un aviso por cada una, el más cercano primero', () => {
    const avisos = avisosDeOcupacion([reserva({ hora_entrega: null, hora_recogida: null })], HOY);
    expect(avisos.map((a) => a.clave)).toEqual(['r1:sin-hora-entrega', 'r1:sin-hora-recogida']);
    expect(avisos.map((a) => a.tipo)).toEqual(['sin_hora', 'sin_hora']);
    expect(avisos.map((a) => a.dia)).toEqual(['2026-11-12', '2026-11-15']);
  });

  it('una entrega que ya pasó no se avisa; la recogida de una entregada sí, mientras no pase', () => {
    expect(textos([reserva({ hora_entrega: null })], '2026-11-13')).toEqual([]);
    const entregada = reserva({ estado: 'en_curso', etiqueta: 'Entregada', hora_entrega: null, hora_recogida: null });
    expect(textos([entregada], '2026-11-13')).toEqual([
      'Sofá Lumina: la reserva A1B2C3D4 no tiene hora de recogida (el 15/11/2026).'
    ]);
    expect(textos([entregada], '2026-11-16')).toEqual([]);
  });

  it('el mismo día de la entrega todavía se avisa', () => {
    expect(textos([reserva({ hora_entrega: null })], '2026-11-12')).toHaveLength(1);
  });

  it('el mismo día de la recogida también', () => {
    expect(textos([reserva({ hora_recogida: null })], '2026-11-15')).toHaveLength(1);
    expect(textos([reserva({ hora_recogida: null })], '2026-11-16')).toHaveLength(0);
  });

  it('esperando pago y devueltas no (el cliente ya eligió la hora o ya acabó); bloqueos y ventas tampoco', () => {
    const sinHoras = { hora_entrega: null, hora_recogida: null };
    expect(textos([reserva({ ...sinHoras, estado: 'pendiente', etiqueta: 'Esperando pago' })])).toEqual([]);
    expect(textos([reserva({ ...sinHoras, estado: 'devuelta', etiqueta: 'Devuelta' })])).toEqual([]);
    expect(textos([BLOQUEO, VENTA])).toEqual([]);
    // Ni aunque lleguen «confirmados» y sin horas: no son entregas ni recogidas.
    const sinNada = { estado: 'confirmada', hora_entrega: null, hora_recogida: null };
    expect(textos([{ ...BLOQUEO, ...sinNada }, { ...VENTA, ...sinNada }])).toEqual([]);
  });

  it('una retrasada sin hora tiene el aviso de retraso, no este', () => {
    expect(textos([{ ...RETRASADA, hora_recogida: null }])).toEqual([]);
  });
});

