import { describe, it, expect } from 'vitest';
import { descripcionParaMeta, MAX_DESCRIPCION_META, MIN_DESCRIPCION_SOLA } from './descripcionMeta';
import { BRAND } from '../theme/brand.config';

describe('descripcionParaMeta', () => {
  const DE_80 =
    'Silla de haya restaurada a mano en el taller, con el asiento de enea nuevo y barniz.';

  it('una descripción de 80 caracteres o más que cabe va entera', () => {
    expect(DE_80.length).toBeGreaterThanOrEqual(MIN_DESCRIPCION_SOLA);
    expect(descripcionParaMeta({ nombre: 'Silla', descripcion: DE_80 })).toBe(DE_80);
  });

  it('junta los saltos de línea y los espacios de más en uno', () => {
    expect(
      descripcionParaMeta({ nombre: 'Silla', descripcion: `  Silla de haya.\n\n${DE_80.slice(16)}   ` })
    ).toBe(`Silla de haya. ${DE_80.slice(16)}`);
  });

  it('una descripción corta va con el nombre delante y la tienda detrás', () => {
    expect(descripcionParaMeta({ nombre: 'Colgante', descripcion: 'Colgante en forma de cruz' })).toBe(
      `Colgante. Colgante en forma de cruz. Pieza única en ${BRAND.nombre}.`
    );
    expect(
      descripcionParaMeta({ nombre: 'Radio antigua (1954)', descripcion: 'Radio de 1954. Funciona.' })
    ).toBe(`Radio antigua (1954). Radio de 1954. Funciona. Pieza única en ${BRAND.nombre}.`);
  });

  it('una descripción corta sin nombre va sola', () => {
    expect(descripcionParaMeta({ descripcion: 'Colgante en forma de cruz' })).toBe('Colgante en forma de cruz');
  });

  it('una descripción sin letras (como «.») cuenta como vacía', () => {
    expect(descripcionParaMeta({ nombre: 'Mesa', descripcion: '.' })).toBe(
      `Mesa — pieza única en ${BRAND.nombre}, ${BRAND.tipoNegocio} en ${BRAND.contacto.ciudad}.`
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
    const esperado =
      `Mesa de roble — pieza única en ${BRAND.nombre}, ${BRAND.tipoNegocio} en ${BRAND.contacto.ciudad}.`;
    expect(descripcionParaMeta({ nombre: 'Mesa de roble', descripcion: null })).toBe(esperado);
    expect(descripcionParaMeta({ nombre: 'Mesa de roble', descripcion: '   ' })).toBe(esperado);
    expect(descripcionParaMeta({ nombre: 'Mesa de roble' })).toBe(esperado);
  });

  it('sin descripción ni nombre, la frase sin nombre', () => {
    const esperado = `Pieza única en ${BRAND.nombre}, ${BRAND.tipoNegocio} en ${BRAND.contacto.ciudad}.`;
    expect(descripcionParaMeta({})).toBe(esperado);
    expect(descripcionParaMeta()).toBe(esperado);
  });
});
