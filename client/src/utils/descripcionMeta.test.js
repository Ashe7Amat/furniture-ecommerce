import { describe, it, expect } from 'vitest';
import { descripcionParaMeta, MAX_DESCRIPCION_META } from './descripcionMeta';

describe('descripcionParaMeta', () => {
  it('una descripción corta va entera', () => {
    expect(descripcionParaMeta({ nombre: 'Silla', descripcion: 'Silla de haya restaurada.' })).toBe(
      'Silla de haya restaurada.'
    );
  });

  it('junta los saltos de línea y los espacios de más en uno', () => {
    expect(descripcionParaMeta({ nombre: 'Silla', descripcion: '  Silla de haya.\n\nRestaurada   a mano.  ' })).toBe(
      'Silla de haya. Restaurada a mano.'
    );
  });

  it('una descripción larga se corta en un espacio, sin pasar de 150 caracteres, y termina en "…"', () => {
    const larga =
      'Aparador de roble macizo de los años cincuenta, con tres cajones y dos puertas, restaurado en el ' +
      'taller con cera natural y herrajes originales de latón pulido, listo para el salón.';
    const resultado = descripcionParaMeta({ nombre: 'Aparador', descripcion: larga });

    expect(larga.length).toBeGreaterThan(MAX_DESCRIPCION_META);
    expect(resultado.length).toBeLessThanOrEqual(MAX_DESCRIPCION_META);
    expect(resultado.endsWith('…')).toBe(true);
    expect(larga.startsWith(resultado.slice(0, -1))).toBe(true);
    expect(larga[resultado.length - 1]).toBe(' '); // el corte cae justo antes de un espacio
  });

  it('no deja una coma o un punto justo antes de los puntos suspensivos', () => {
    const texto = `${'a'.repeat(140)}, ${'b'.repeat(20)}`;
    expect(descripcionParaMeta({ nombre: 'X', descripcion: texto })).toBe(`${'a'.repeat(140)}…`);
  });

  it('una sola palabra larguísima se corta igual', () => {
    const resultado = descripcionParaMeta({ nombre: 'X', descripcion: 'a'.repeat(300) });
    expect(resultado).toBe(`${'a'.repeat(MAX_DESCRIPCION_META - 1)}…`);
  });

  it('sin descripción (o solo espacios), una frase con el nombre de la pieza', () => {
    const esperado = 'Mesa de roble — pieza única disponible en Nave 5 Barcelona.';
    expect(descripcionParaMeta({ nombre: 'Mesa de roble', descripcion: null })).toBe(esperado);
    expect(descripcionParaMeta({ nombre: 'Mesa de roble', descripcion: '   ' })).toBe(esperado);
    expect(descripcionParaMeta({ nombre: 'Mesa de roble' })).toBe(esperado);
  });

  it('sin descripción ni nombre, la frase sin nombre', () => {
    expect(descripcionParaMeta({})).toBe('Pieza única disponible en Nave 5 Barcelona.');
    expect(descripcionParaMeta()).toBe('Pieza única disponible en Nave 5 Barcelona.');
  });
});
