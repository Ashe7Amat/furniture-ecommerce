// Los textos de los plazos del calendario y del motivo de un día no elegible (textosReserva.js).
import { describe, test, expect } from 'vitest';
import { textoPlazos, textoMotivo } from './textosReserva';

describe('textoPlazos', () => {
  test('la antelación y el margen, con el singular donde toca', () => {
    expect(textoPlazos({ antelacion_min_dias: 2, antelacion_max_meses: 6, dias_margen: 2 })).toBe(
      'Se reserva con 2 días de antelación como mínimo y hasta 6 meses vista. ' +
        'Después de cada recogida dejamos 2 días libres antes de la siguiente reserva.'
    );
    expect(textoPlazos({ antelacion_min_dias: 1, antelacion_max_meses: 1, dias_margen: 1 })).toBe(
      'Se reserva con 1 día de antelación como mínimo y hasta 1 mes vista. ' +
        'Después de cada recogida dejamos 1 día libre antes de la siguiente reserva.'
    );
  });

  test('sin antelación mínima se puede reservar desde hoy; sin margen no se dice nada del margen', () => {
    expect(textoPlazos({ antelacion_min_dias: 0, antelacion_max_meses: 3, dias_margen: 0 })).toBe(
      'Se puede reservar desde hoy y hasta 3 meses vista.'
    );
  });

  test('solo dice lo que ha mandado el servidor', () => {
    expect(textoPlazos({})).toBe('');
    expect(textoPlazos({ antelacion_min_dias: 2, antelacion_max_meses: 6, dias_max_hasta_recogida: 165 })).toBe(
      'Se reserva con 2 días de antelación como mínimo, y la recogida tiene que ser, como muy tarde, dentro de 165 días.'
    );
    expect(textoPlazos({ antelacion_min_dias: 0, dias_max_hasta_recogida: 165 })).toBe(
      'Se puede reservar desde hoy, y la recogida tiene que ser, como muy tarde, dentro de 165 días.'
    );
    expect(textoPlazos({ dias_margen: 2 })).toBe('Después de cada recogida dejamos 2 días libres antes de la siguiente reserva.');
    expect(textoPlazos({ antelacion_min_dias: 2 })).toBe('');
  });
});

describe('textoMotivo', () => {
  const reglas = {
    antelacion_min_dias: 1,
    antelacion_max_meses: 1,
    duracion_min_dias: 3,
    duracion_max_dias: 1
  };

  test('cada motivo, con el singular donde toca', () => {
    expect(textoMotivo('pasado', reglas)).toBe('ya ha pasado');
    expect(textoMotivo('antelacion', reglas)).toBe('se reserva con 1 día de antelación');
    expect(textoMotivo('lejos', reglas)).toBe('se reserva hasta 1 mes vista');
    expect(textoMotivo('sin_hueco', reglas)).toBe('no cabe un alquiler antes de la siguiente reserva');
    expect(textoMotivo('duracion_min', reglas)).toBe('el alquiler mínimo es de 3 días');
    expect(textoMotivo('duracion_max', reglas)).toBe('el alquiler máximo es de 1 día');
    expect(textoMotivo('recogida_tope', { dias_max_hasta_recogida: 165 })).toBe(
      'la recogida tiene que ser dentro de 165 días como mucho'
    );
    expect(textoMotivo('recogida_tope', {})).toBe('la recogida queda demasiado lejos');
    expect(textoMotivo('ocupado', reglas)).toBe('ocupado');
  });

  test('sin los números del servidor, un texto que sigue valiendo', () => {
    expect(textoMotivo('antelacion')).toBe('falta antelación');
    expect(textoMotivo('lejos')).toBe('todavía no se puede reservar');
    expect(textoMotivo('duracion_min')).toBe('el alquiler mínimo es de 1 día');
    expect(textoMotivo('duracion_max')).toBe('el alquiler es demasiado largo');
  });
});
