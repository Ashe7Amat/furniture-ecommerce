import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  reservasActivas,
  esFecha,
  sumarDias,
  diasEntre,
  mesDe,
  primerDiaDe,
  sumarMeses,
  diaDeLaSemana,
  semanasDelMes,
  nombreDelMes,
  fechaCorta,
  fechaLarga,
  textoDias,
  eurosDeCentimos,
  HORAS_TRAYECTO,
  estaOcupado,
  ultimoFinPosible
} from './reservas';

afterEach(() => vi.unstubAllEnvs());

describe('interruptor VITE_RESERVAS_ACTIVAS', () => {
  test('solo "true" lo enciende', () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    expect(reservasActivas()).toBe(true);
    for (const valor of ['', 'false', '1', 'TRUE', 'si']) {
      vi.stubEnv('VITE_RESERVAS_ACTIVAS', valor);
      expect(reservasActivas()).toBe(false);
    }
  });
});

describe('fechas como texto, sin zona horaria', () => {
  test('esFecha', () => {
    expect(esFecha('2026-11-02')).toBe(true);
    expect(esFecha('2026-11-2')).toBe(false);
    expect(esFecha(undefined)).toBe(false);
  });

  test('sumarDias cruza meses, años y los cambios de hora', () => {
    expect(sumarDias('2026-10-24', 2)).toBe('2026-10-26');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('diasEntre', () => {
    expect(diasEntre('2026-10-24', '2026-10-27')).toBe(3);
    expect(diasEntre('2026-10-27', '2026-10-24')).toBe(-3);
  });

  test('meses', () => {
    expect(mesDe('2026-11-02')).toBe('2026-11');
    expect(primerDiaDe('2026-11')).toBe('2026-11-01');
    expect(sumarMeses('2026-11', 2)).toBe('2027-01');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
    expect(nombreDelMes('2026-11')).toBe('noviembre de 2026');
  });

  test('día de la semana, empezando en lunes', () => {
    expect(diaDeLaSemana('2026-11-02')).toBe(0); // lunes
    expect(diaDeLaSemana('2026-11-08')).toBe(6); // domingo
  });

  test('semanasDelMes: rejilla de lunes a domingo con huecos', () => {
    // Noviembre de 2026 empieza en domingo y tiene 30 días.
    const semanas = semanasDelMes('2026-11');
    expect(semanas).toHaveLength(6);
    expect(semanas[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(semanas[1][0]).toBe('2026-11-02');
    expect(semanas[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
    // Febrero de 2027 empieza en lunes y tiene 28 días: 4 semanas justas.
    expect(semanasDelMes('2027-02')).toHaveLength(4);
  });

  test('textos', () => {
    expect(fechaCorta('2026-11-02')).toBe('02/11/2026');
    expect(fechaLarga('2026-11-02')).toBe('lunes, 2 de noviembre de 2026');
    expect(textoDias(1)).toBe('1 día');
    expect(textoDias(3)).toBe('3 días');
  });

  test('euros desde céntimos', () => {
    expect(eurosDeCentimos(7500)).toMatch(/^75,00\s€$/);
    expect(eurosDeCentimos(123450)).toMatch(/^1\.234,50\s€$/);
  });

  test('horas de entrega y recogida: de 9:00 a 20:00 cada media hora', () => {
    expect(HORAS_TRAYECTO[0]).toBe('09:00');
    expect(HORAS_TRAYECTO[1]).toBe('09:30');
    expect(HORAS_TRAYECTO.at(-1)).toBe('20:00');
  });
});

describe('lo ocupado', () => {
  const ocupado = [
    { desde: '2026-11-10', hasta: '2026-11-15', tipo: 'reservado' },
    { desde: '2026-12-01', hasta: null, tipo: 'vendido' }
  ];

  test('estaOcupado: [desde, hasta), y sin fin', () => {
    expect(estaOcupado('2026-11-09', ocupado)).toBe(false);
    expect(estaOcupado('2026-11-10', ocupado)).toBe(true);
    expect(estaOcupado('2026-11-14', ocupado)).toBe(true);
    expect(estaOcupado('2026-11-15', ocupado)).toBe(false);
    expect(estaOcupado('2030-01-01', ocupado)).toBe(true);
  });

  test('ultimoFinPosible: lo siguiente menos el margen de la reserva nueva', () => {
    expect(ultimoFinPosible('2026-11-02', ocupado, 2)).toBe('2026-11-08');
    expect(ultimoFinPosible('2026-11-15', ocupado, 2)).toBe('2026-11-29');
    expect(ultimoFinPosible('2026-11-02', [], 2)).toBe(null);
  });

  test('ultimoFinPosible: cuenta lo más cercano aunque los rangos no lleguen ordenados', () => {
    const desordenado = [
      { desde: '2026-12-01', hasta: '2026-12-05' },
      { desde: '2026-11-10', hasta: '2026-11-15' }
    ];
    expect(ultimoFinPosible('2026-11-02', desordenado, 2)).toBe('2026-11-08');
  });
});
