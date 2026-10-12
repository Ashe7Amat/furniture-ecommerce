import { describe, it, expect, vi } from 'vitest';
import { ejecutarLote, textoLoteAMedias } from './lotes';

describe('ejecutarLote (H12)', () => {
  it('cuenta las que fueron bien y devuelve los ids de las que fallaron (null o excepción)', async () => {
    const accion = vi.fn(async (id) => {
      if (id === 'b') return null;
      if (id === 'c') throw new Error('red');
      return { success: true };
    });
    expect(await ejecutarLote(['a', 'b', 'c', 'd'], accion)).toEqual({ hechos: 2, fallidos: ['b', 'c'] });
    expect(accion).toHaveBeenCalledTimes(4);
  });

  it('sin fallos, fallidos vacío', async () => {
    expect(await ejecutarLote(['a'], async () => ({}))).toEqual({ hechos: 1, fallidos: [] });
  });
});

describe('textoLoteAMedias', () => {
  it('cuantifica en plural y en singular (texto de D-c)', () => {
    expect(textoLoteAMedias(3, 5)).toBe('3 de 5 completados. Los otros 2 no se pudieron procesar.');
    expect(textoLoteAMedias(4, 5)).toBe('4 de 5 completados. El otro no se pudo procesar.');
  });
});
