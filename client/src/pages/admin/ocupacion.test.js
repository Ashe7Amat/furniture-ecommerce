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

describe('tramoDeRetraso', () => {
  it('desde que acaba su ocupación hasta hoy, hoy incluido', () => {
    expect(tramoDeRetraso(RETRASADA, HOY)).toEqual({ desde: '2026-11-08', hasta: '2026-11-11' });
  });

  it('una reserva que no está retrasada, o cuya ocupación aún llega a hoy, no tiene', () => {
    expect(tramoDeRetraso(reserva(), HOY)).toBeNull();
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

describe('tramosDeLaReserva (ventana de 10 días desde el 10)', () => {
  const tramos = (r, inicio = '2026-11-10', n = 10) => tramosDeLaReserva(r, inicio, n, HOY);

  it('en columnas: los días de reserva y los de margen, pegados', () => {
    expect(tramos(reserva())).toMatchObject({ reservado: [2, 5], margen: [5, 7], retraso: null });
  });

  it('se recorta por los dos lados y lo dice', () => {
    const larga = reserva({ fecha_inicio: '2026-11-05', fin_ocupacion: '2026-11-30', ocupada_hasta: '2026-12-02' });
    expect(tramos(larga)).toEqual({ reservado: [0, 10], margen: null, retraso: null, cortaIzq: true, cortaDer: true });
    expect(tramos(reserva()).cortaIzq).toBe(false);
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
    expect(tramosDeLaReserva(RETRASADA, '2026-11-05', 10, HOY)).toEqual({
      reservado: [0, 1],
      margen: [1, 3],
      retraso: [3, 6],
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
