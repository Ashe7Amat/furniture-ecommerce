// Las reglas del calendario de la ficha (seleccionFechas.js): qué días se pueden elegir como entrega
// y como recogida, qué hace cada clic y qué meses se pueden ver.
import { describe, test, expect } from 'vitest';
import {
  esInicioPosible,
  esFinPosible,
  seleccionTrasElegir,
  diaElegible,
  mesesVisibles,
  motivoNoElegible,
  GRUPO_DE_MOTIVO
} from './seleccionFechas';

// Hoy es el lunes 2 de noviembre de 2026. Se puede empezar del 4 de noviembre al 2 de diciembre,
// de 1 a 30 días, con 2 días de margen entre reservas. Ocupado del 10 al 14 de noviembre (el 15 ya
// está libre) y vendida desde el 20 de diciembre.
const DISP = {
  hoy: '2026-11-02',
  primer_inicio_posible: '2026-11-04',
  ultimo_inicio_posible: '2026-12-02',
  reglas: { duracion_min_dias: 1, duracion_max_dias: 30, dias_margen: 2 },
  ocupado: [
    { desde: '2026-11-10', hasta: '2026-11-15', tipo: 'reservado' },
    { desde: '2026-12-20', hasta: null, tipo: 'vendido' }
  ]
};
const conReglas = (reglas) => ({ ...DISP, reglas: { ...DISP.reglas, ...reglas } });

describe('esInicioPosible', () => {
  test('solo dentro de la antelación permitida', () => {
    expect(esInicioPosible('2026-11-03', DISP)).toBe(false);
    expect(esInicioPosible('2026-11-04', DISP)).toBe(true);
    expect(esInicioPosible('2026-12-02', DISP)).toBe(true);
    expect(esInicioPosible('2026-12-03', DISP)).toBe(false);
  });

  test('un día ocupado no vale; el día en que acaba lo ocupado (exclusivo) sí', () => {
    expect(esInicioPosible('2026-11-10', DISP)).toBe(false);
    expect(esInicioPosible('2026-11-14', DISP)).toBe(false);
    expect(esInicioPosible('2026-11-15', DISP)).toBe(true);
  });

  test('tiene que caber la duración mínima, más el margen, antes de lo siguiente ocupado', () => {
    // Recogida como muy tarde el 8 (10 − 2 días de margen): empezar el 7 deja 1 día, el 8 ninguno.
    expect(esInicioPosible('2026-11-07', DISP)).toBe(true);
    expect(esInicioPosible('2026-11-08', DISP)).toBe(false);
    expect(esInicioPosible('2026-11-09', DISP)).toBe(false);
    const minimoTres = conReglas({ duracion_min_dias: 3 });
    expect(esInicioPosible('2026-11-05', minimoTres)).toBe(true);
    expect(esInicioPosible('2026-11-06', minimoTres)).toBe(false);
  });

  test('sin nada ocupado después, cualquier día libre de la antelación', () => {
    expect(esInicioPosible('2026-11-20', { ...DISP, ocupado: [] })).toBe(true);
  });
});

describe('esFinPosible', () => {
  test('la recogida es siempre posterior a la entrega, aunque la duración mínima sea 0', () => {
    expect(esFinPosible('2026-11-04', '2026-11-04', DISP)).toBe(false);
    expect(esFinPosible('2026-11-04', '2026-11-04', conReglas({ duracion_min_dias: 0 }))).toBe(false);
    expect(esFinPosible('2026-11-04', '2026-11-05', DISP)).toBe(true);
  });

  test('respeta la duración mínima y la máxima', () => {
    const minimoTres = conReglas({ duracion_min_dias: 3 });
    expect(esFinPosible('2026-11-15', '2026-11-17', minimoTres)).toBe(false);
    expect(esFinPosible('2026-11-15', '2026-11-18', minimoTres)).toBe(true);
    expect(esFinPosible('2026-11-15', '2026-12-15', DISP)).toBe(true); // 30 días
    expect(esFinPosible('2026-11-15', '2026-12-16', DISP)).toBe(false); // 31
  });

  test('la reserva más su margen no puede llegar a lo siguiente ocupado', () => {
    expect(esFinPosible('2026-11-04', '2026-11-08', DISP)).toBe(true);
    expect(esFinPosible('2026-11-04', '2026-11-09', DISP)).toBe(false);
    // Hasta la venta del 20 de diciembre, con un fin abierto
    expect(esFinPosible('2026-12-01', '2026-12-18', DISP)).toBe(true);
    expect(esFinPosible('2026-12-01', '2026-12-19', DISP)).toBe(false);
  });

  test('sin nada ocupado después, solo cuenta la duración', () => {
    expect(esFinPosible('2026-11-15', '2026-12-15', { ...DISP, ocupado: [] })).toBe(true);
  });

  test('lo que queda más allá de la ventana consultada no se sabe: el margen no puede salirse de ella', () => {
    // Ventana hasta el 2 de enero (exclusivo), margen de 2 días: la última recogida que se ofrece es el 31.
    const conVentana = { ...DISP, ocupado: [], hasta: '2027-01-02' };
    expect(esFinPosible('2026-12-02', '2026-12-31', conVentana)).toBe(true);
    expect(esFinPosible('2026-12-02', '2027-01-01', conVentana)).toBe(false);
    expect(esFinPosible('2026-12-02', '2027-01-01', { ...conVentana, hasta: '2027-01-03' })).toBe(true);
  });
});

describe('seleccionTrasElegir', () => {
  test('sin nada elegido, el día es la entrega', () => {
    expect(seleccionTrasElegir({ inicio: null, fin: null }, '2026-11-04')).toEqual({ inicio: '2026-11-04', fin: null });
  });

  test('con la entrega elegida, un día posterior es la recogida', () => {
    expect(seleccionTrasElegir({ inicio: '2026-11-04', fin: null }, '2026-11-07')).toEqual({
      inicio: '2026-11-04',
      fin: '2026-11-07'
    });
  });

  test('con la entrega elegida, un día anterior empieza otra selección y la misma la deshace', () => {
    expect(seleccionTrasElegir({ inicio: '2026-11-06', fin: null }, '2026-11-04')).toEqual({ inicio: '2026-11-04', fin: null });
    expect(seleccionTrasElegir({ inicio: '2026-11-06', fin: null }, '2026-11-06')).toEqual({ inicio: null, fin: null });
  });

  test('con las dos fechas elegidas, otro clic empieza de nuevo', () => {
    expect(seleccionTrasElegir({ inicio: '2026-11-04', fin: '2026-11-07' }, '2026-11-20')).toEqual({
      inicio: '2026-11-20',
      fin: null
    });
  });
});

describe('diaElegible', () => {
  test('sin entrega, o con las dos fechas, se puede pulsar cualquier entrega posible', () => {
    expect(diaElegible({ inicio: null, fin: null }, '2026-11-04', DISP)).toBe(true);
    expect(diaElegible({ inicio: null, fin: null }, '2026-11-12', DISP)).toBe(false);
    expect(diaElegible({ inicio: '2026-11-04', fin: '2026-11-06' }, '2026-11-20', DISP)).toBe(true);
  });

  test('eligiendo la recogida: los días posteriores según las reglas de la recogida', () => {
    const eligiendo = { inicio: '2026-11-04', fin: null };
    expect(diaElegible(eligiendo, '2026-11-08', DISP)).toBe(true);
    expect(diaElegible(eligiendo, '2026-11-09', DISP)).toBe(false);
    // Un día posterior al hueco ocupado es una entrega posible, pero no una recogida
    expect(diaElegible(eligiendo, '2026-11-20', DISP)).toBe(false);
  });

  test('eligiendo la recogida: la propia entrega y los días anteriores, como entregas', () => {
    expect(diaElegible({ inicio: '2026-11-06', fin: null }, '2026-11-06', DISP)).toBe(true);
    expect(diaElegible({ inicio: '2026-11-06', fin: null }, '2026-11-04', DISP)).toBe(true);
    expect(diaElegible({ inicio: '2026-11-06', fin: null }, '2026-11-03', DISP)).toBe(false);
  });
});

describe('mesesVisibles', () => {
  test('del mes de hoy al de la última recogida posible', () => {
    // 2 de diciembre + 30 días = 1 de enero de 2027
    expect(mesesVisibles(DISP)).toEqual({ primero: '2026-11', ultimo: '2027-01' });
    expect(mesesVisibles(conReglas({ duracion_max_dias: 29 }))).toEqual({ primero: '2026-11', ultimo: '2026-12' });
  });
});

describe('motivoNoElegible', () => {
  const SIN_FECHAS = { inicio: null, fin: null };

  test('un día que se puede pulsar no tiene motivo', () => {
    expect(motivoNoElegible(SIN_FECHAS, '2026-11-04', DISP)).toBeNull();
    expect(motivoNoElegible({ inicio: '2026-11-04', fin: null }, '2026-11-08', DISP)).toBeNull();
  });

  test('eligiendo la entrega: pasado, sin antelación, demasiado lejos, ocupado o sin hueco', () => {
    expect(motivoNoElegible(SIN_FECHAS, '2026-11-01', DISP)).toBe('pasado');
    // Hoy (el 2) y mañana no se pueden: hace falta la antelación mínima, pero no ha pasado.
    expect(motivoNoElegible(SIN_FECHAS, '2026-11-02', DISP)).toBe('antelacion');
    expect(motivoNoElegible(SIN_FECHAS, '2026-11-03', DISP)).toBe('antelacion');
    expect(motivoNoElegible(SIN_FECHAS, '2026-12-03', DISP)).toBe('lejos');
    expect(motivoNoElegible(SIN_FECHAS, '2026-11-12', DISP)).toBe('ocupado');
    // Libre, pero no cabe un día entero antes de lo ocupado (más los 2 de margen)
    expect(motivoNoElegible(SIN_FECHAS, '2026-11-08', DISP)).toBe('sin_hueco');
  });

  test('con las dos fechas elegidas, otro clic se valora como una entrega nueva', () => {
    const elegidas = { inicio: '2026-11-04', fin: '2026-11-06' };
    expect(motivoNoElegible(elegidas, '2026-11-12', DISP)).toBe('ocupado');
    expect(motivoNoElegible(elegidas, '2026-11-01', DISP)).toBe('pasado');
  });

  test('eligiendo la recogida: lo ocupado manda sobre la duración, y después la duración máxima', () => {
    const eligiendo = { inicio: '2026-11-04', fin: null };
    expect(motivoNoElegible(eligiendo, '2026-11-09', DISP)).toBe('ocupado');
    expect(motivoNoElegible(eligiendo, '2026-11-20', DISP)).toBe('ocupado');
    const corta = conReglas({ duracion_max_dias: 3 });
    expect(motivoNoElegible(eligiendo, '2026-11-08', corta)).toBe('duracion_max');
    // Sin nada ocupado después, pasarse de la duración máxima es lo único que impide recoger
    const libre = { ...conReglas({ duracion_max_dias: 3 }), ocupado: [] };
    expect(motivoNoElegible(eligiendo, '2026-11-08', libre)).toBe('duracion_max');
  });

  test('eligiendo la recogida: la duración mínima y el final de lo consultado', () => {
    const eligiendo = { inicio: '2026-11-04', fin: null };
    const larga = { ...conReglas({ duracion_min_dias: 3 }), ocupado: [] };
    expect(motivoNoElegible(eligiendo, '2026-11-05', larga)).toBe('duracion_min');
    expect(motivoNoElegible(eligiendo, '2026-11-07', larga)).toBeNull();
    // Más allá de la ventana que se ha consultado (con el margen) no se sabe si está libre
    const ventana = { ...DISP, ocupado: [], hasta: '2026-11-10' };
    expect(motivoNoElegible(eligiendo, '2026-11-09', ventana)).toBe('lejos');
  });

  test('cada motivo se pinta como ocupado (rayado) o como fuera de plazo (apagado)', () => {
    expect(GRUPO_DE_MOTIVO).toEqual({
      ocupado: 'ocupado',
      sin_hueco: 'ocupado',
      pasado: 'fuera',
      antelacion: 'fuera',
      lejos: 'fuera',
      duracion_min: 'fuera',
      duracion_max: 'fuera'
    });
  });
});
