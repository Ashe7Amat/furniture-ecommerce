import { describe, it, expect } from 'vitest';
import { generales, especificasDe, primeraEspecifica, idDeCategoria, normalizarCodigo, errorDeCodigo, avisoCambioDeCodigo } from './categorias';

// En el orden de la API (por nombre): la primera específica ("Aparadores") es de la SEGUNDA general.
const CATEGORIAS = [
  { id: 11, nombre: 'Aparadores', categoria_padre_id: 1 },
  { id: 3, nombre: 'Coleccionismo', categoria_padre_id: null },
  { id: 31, nombre: 'Juguetes', categoria_padre_id: 3 },
  { id: 1, nombre: 'Mobiliario', categoria_padre_id: null },
  { id: 12, nombre: 'Sillas', categoria_padre_id: 1 }
];

describe('categorias.js', () => {
  it('generales: las que no tienen categoría padre, en el orden de la API', () => {
    expect(generales(CATEGORIAS).map(c => c.nombre)).toEqual(['Coleccionismo', 'Mobiliario']);
  });

  it('especificasDe: las que cuelgan de una general, en el orden de la API', () => {
    expect(especificasDe(CATEGORIAS, { id: 1 }).map(c => c.nombre)).toEqual(['Aparadores', 'Sillas']);
    expect(especificasDe(CATEGORIAS, { id: 999 })).toEqual([]);
  });

  it('primeraEspecifica: la primera con padre en el orden de la API, no la primera del desplegable', () => {
    expect(primeraEspecifica(CATEGORIAS).nombre).toBe('Aparadores');
    expect(primeraEspecifica(generales(CATEGORIAS))).toBeUndefined();
  });

  it('idDeCategoria: el id de la categoría con ese nombre exacto, o undefined', () => {
    expect(idDeCategoria(CATEGORIAS, 'Sillas')).toBe(12);
    expect(idDeCategoria(CATEGORIAS, 'sillas')).toBeUndefined();
    expect(idDeCategoria(CATEGORIAS, '')).toBeUndefined();
  });

  it('normalizarCodigo (A5): solo letras de la A a la Z, en mayúsculas y como mucho tres', () => {
    expect(normalizarCodigo('sil')).toBe('SIL');
    expect(normalizarCodigo(' s-1i l ')).toBe('SIL');
    expect(normalizarCodigo('Ñandú')).toBe('AND');
    expect(normalizarCodigo('SILLAS')).toBe('SIL');
    expect(normalizarCodigo('')).toBe('');
    expect(normalizarCodigo(undefined)).toBe('');
  });

  it('errorDeCodigo (A5): vacío vale; si no, 3 letras y que no lo use otra categoría', () => {
    const conCodigos = [
      { id: 12, nombre: 'Sillas', codigo: 'SIL' },
      { id: 13, nombre: 'Mesas', codigo: null }
    ];
    expect(errorDeCodigo('', conCodigos)).toBeNull();
    expect(errorDeCodigo(null, conCodigos)).toBeNull();
    expect(errorDeCodigo('MES', conCodigos)).toBeNull();
    expect(errorDeCodigo('SI', conCodigos)).toBe('El código tiene que ser de 3 letras (A-Z), por ejemplo SIL.');
    expect(errorDeCodigo('sil', conCodigos)).toBe('El código tiene que ser de 3 letras (A-Z), por ejemplo SIL.');
    expect(errorDeCodigo('SIL', conCodigos)).toBe('Ese código ya lo usa la categoría "Sillas".');
    // Al editar, el código de la propia categoría no cuenta como repetido.
    expect(errorDeCodigo('SIL', conCodigos, 12)).toBeNull();
    expect(errorDeCodigo('SIL', conCodigos, 13)).toBe('Ese código ya lo usa la categoría "Sillas".');
  });

  it('avisoCambioDeCodigo (bloque A): solo si cambia el código y la categoría ya tiene muebles con referencia', () => {
    const categorias = [
      { id: 20, nombre: 'Sillas', codigo: 'SIL' },
      { id: 21, nombre: 'Mesas', codigo: 'MES' },
      { id: 22, nombre: 'Taburetes', codigo: null }
    ];
    const muebles = [
      { id: 'a', categoria: 'Sillas', referencia: 'NAV-SIL-002' },
      { id: 'b', categoria: 'Sillas', referencia: 'NAV-SIL-015' },
      { id: 'c', categoria: 'Sillas', referencia: 'NAV-SIL-001' },
      { id: 'd', categoria: 'Sillas', referencia: null },
      { id: 'e', categoria: 'Mesas', referencia: 'NAV-MES-007' },
      { id: 'f', categoria: 'Taburetes', referencia: null }
    ];
    const resto = 'Los nuevos usarán el código nuevo, los antiguos conservarán el viejo. ¿Continuar?';

    // Cambia el código y hay muebles con referencia: avisa, con cuántos y de cuál a cuál.
    expect(avisoCambioDeCodigo({ ...categorias[0], codigo: 'ASI' }, categorias, muebles))
      .toBe(`Esta categoría tiene 3 muebles con referencias NAV-SIL-001 a NAV-SIL-015. ${resto}`);
    // Vaciarlo también es cambiarlo.
    expect(avisoCambioDeCodigo({ ...categorias[0], codigo: '' }, categorias, muebles)).not.toBeNull();
    // Con un solo mueble, en singular.
    expect(avisoCambioDeCodigo({ ...categorias[1], codigo: 'MSA' }, categorias, muebles))
      .toBe(`Esta categoría tiene 1 mueble con referencia NAV-MES-007. ${resto}`);
    // Se cuenta por el nombre de antes, aunque en el modal ya se haya cambiado.
    expect(avisoCambioDeCodigo({ ...categorias[0], nombre: 'Asientos', codigo: 'ASI' }, categorias, muebles)).toMatch(/^Esta categoría tiene 3 /);

    // No avisa: el código no cambia, la categoría no tiene muebles con referencia, o no se encuentra.
    expect(avisoCambioDeCodigo({ ...categorias[0], nombre: 'Otro nombre' }, categorias, muebles)).toBeNull();
    expect(avisoCambioDeCodigo({ ...categorias[2], codigo: 'TAB' }, categorias, muebles)).toBeNull();
    expect(avisoCambioDeCodigo({ ...categorias[2], codigo: '' }, categorias, muebles)).toBeNull();
    expect(avisoCambioDeCodigo({ id: 99, codigo: 'XYZ' }, categorias, muebles)).toBeNull();
  });
});
