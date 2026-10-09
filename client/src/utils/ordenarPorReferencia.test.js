import { describe, it, expect } from 'vitest';
import ordenarPorReferenciaPorDefecto, {
  ordenarPorReferencia,
  compararPorReferencia,
  SENTIDO_ASC,
  SENTIDO_DESC
} from './ordenarPorReferencia';

const pieza = (id, referencia) => ({ id, nombre: `Pieza ${id}`, referencia });
const ids = (lista) => lista.map((m) => m.id);

describe('ordenarPorReferencia', () => {
  it('ascendente por defecto: por familia y luego por número', () => {
    const muebles = [pieza('a', 'NAV-SIL-002'), pieza('b', 'NAV-MES-010'), pieza('c', 'NAV-SIL-001'), pieza('d', 'NAV-MES-002')];

    expect(ids(ordenarPorReferencia(muebles))).toEqual(['d', 'b', 'c', 'a']);
    expect(ids(ordenarPorReferencia(muebles, SENTIDO_ASC))).toEqual(['d', 'b', 'c', 'a']);
  });

  it('descendente: al revés que el ascendente', () => {
    const muebles = [pieza('a', 'NAV-SIL-002'), pieza('b', 'NAV-MES-010'), pieza('c', 'NAV-SIL-001'), pieza('d', 'NAV-MES-002')];

    expect(ids(ordenarPorReferencia(muebles, SENTIDO_DESC))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('orden natural: los números se comparan como números, con o sin relleno de ceros', () => {
    // Comparando texto letra a letra, NAV-SIL-10 iría antes que NAV-SIL-2.
    const sinRelleno = [pieza('diez', 'NAV-SIL-10'), pieza('dos', 'NAV-SIL-2'), pieza('uno', 'NAV-SIL-1')];
    expect(ids(ordenarPorReferencia(sinRelleno))).toEqual(['uno', 'dos', 'diez']);

    const mezcla = [pieza('diez', 'NAV-SIL-010'), pieza('dos', 'NAV-SIL-2'), pieza('cien', 'NAV-SIL-100')];
    expect(ids(ordenarPorReferencia(mezcla))).toEqual(['dos', 'diez', 'cien']);
    expect(ids(ordenarPorReferencia(mezcla, SENTIDO_DESC))).toEqual(['cien', 'diez', 'dos']);
  });

  it('no distingue mayúsculas: dos referencias iguales salvo eso empatan y conservan su orden', () => {
    const muebles = [pieza('b', 'nav-sil-001'), pieza('z', 'NAV-SIL-000'), pieza('a', 'NAV-SIL-001')];

    expect(ids(ordenarPorReferencia(muebles))).toEqual(['z', 'b', 'a']);
    expect(compararPorReferencia(pieza('x', 'nav-sil-001'), pieza('y', 'NAV-SIL-001'))).toBe(0);
    expect(compararPorReferencia(pieza('x', 'nav-sil-001'), pieza('y', 'NAV-SIL-001'), SENTIDO_DESC)).toBe(0);
  });

  it('las piezas sin referencia (null, undefined, vacía o solo espacios) van al final en los dos sentidos', () => {
    const muebles = [
      pieza('nula', null),
      pieza('b', 'NAV-SIL-002'),
      pieza('indefinida', undefined),
      pieza('a', 'NAV-SIL-001'),
      pieza('vacia', ''),
      pieza('espacios', '   '),
      { id: 'sinCampo', nombre: 'Sin campo' }
    ];
    const sinReferencia = ['nula', 'indefinida', 'vacia', 'espacios', 'sinCampo'];

    expect(ids(ordenarPorReferencia(muebles))).toEqual(['a', 'b', ...sinReferencia]);
    expect(ids(ordenarPorReferencia(muebles, SENTIDO_DESC))).toEqual(['b', 'a', ...sinReferencia]);
  });

  it('entre las piezas sin referencia se conserva el orden de entrada (orden estable)', () => {
    const muebles = [pieza('s3', null), pieza('s1', ''), pieza('r', 'NAV-MES-001'), pieza('s2', undefined)];

    expect(ids(ordenarPorReferencia(muebles))).toEqual(['r', 's3', 's1', 's2']);
    expect(ids(ordenarPorReferencia(muebles, SENTIDO_DESC))).toEqual(['r', 's3', 's1', 's2']);
  });

  it('el comparador: negativo si va antes, positivo si va después, 0 si empatan', () => {
    const uno = pieza('1', 'NAV-SIL-001');
    const dos = pieza('2', 'NAV-SIL-002');
    const sinRef = pieza('3', null);

    expect(compararPorReferencia(uno, dos)).toBeLessThan(0);
    expect(compararPorReferencia(dos, uno)).toBeGreaterThan(0);
    expect(compararPorReferencia(uno, dos, SENTIDO_DESC)).toBeGreaterThan(0);
    expect(compararPorReferencia(uno, uno)).toBe(0);
    // Sin referencia, siempre detrás, sea cual sea el sentido.
    expect(compararPorReferencia(sinRef, uno)).toBeGreaterThan(0);
    expect(compararPorReferencia(sinRef, uno, SENTIDO_DESC)).toBeGreaterThan(0);
    expect(compararPorReferencia(uno, sinRef, SENTIDO_DESC)).toBeLessThan(0);
    expect(compararPorReferencia(sinRef, pieza('4', ''))).toBe(0);
  });

  it('un sentido desconocido se trata como ascendente', () => {
    const muebles = [pieza('b', 'NAV-SIL-002'), pieza('a', 'NAV-SIL-001')];

    expect(ids(ordenarPorReferencia(muebles, 'patata'))).toEqual(['a', 'b']);
  });

  it('devuelve una lista nueva sin tocar la de entrada, y aguanta una lista vacía o que no llega', () => {
    const muebles = [pieza('b', 'NAV-SIL-002'), pieza('a', 'NAV-SIL-001')];

    const ordenada = ordenarPorReferencia(muebles);

    expect(ordenada).not.toBe(muebles);
    expect(ids(muebles)).toEqual(['b', 'a']);
    expect(ordenarPorReferencia([])).toEqual([]);
    expect(ordenarPorReferencia(undefined)).toEqual([]);
  });

  it('también se exporta por defecto', () => {
    expect(ordenarPorReferenciaPorDefecto).toBe(ordenarPorReferencia);
  });
});
