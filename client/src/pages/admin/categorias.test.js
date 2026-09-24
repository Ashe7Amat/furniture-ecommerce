import { describe, it, expect } from 'vitest';
import { generales, especificasDe, primeraEspecifica, idDeCategoria } from './categorias';

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
});
