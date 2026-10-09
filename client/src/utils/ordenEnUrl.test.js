import { describe, it, expect } from 'vitest';
import { conOrdenDeLaUrl } from './ordenEnUrl';

const params = (q) => new URLSearchParams(q);

describe('conOrdenDeLaUrl', () => {
  it('sin ?orden= en la URL actual, la ruta no cambia', () => {
    expect(conOrdenDeLaUrl('/catalogo?categoria=Mobiliario', params(''))).toBe('/catalogo?categoria=Mobiliario');
    expect(conOrdenDeLaUrl('/catalogo', params('categoria=Espejos'))).toBe('/catalogo');
    expect(conOrdenDeLaUrl('/catalogo', undefined)).toBe('/catalogo');
  });

  it('añade el orden con & si la ruta ya tiene query, y con ? si no', () => {
    expect(conOrdenDeLaUrl('/catalogo?categoria=Mobiliario', params('orden=referencia_asc'))).toBe(
      '/catalogo?categoria=Mobiliario&orden=referencia_asc'
    );
    expect(conOrdenDeLaUrl('/catalogo', params('categoria=Espejos&orden=referencia_desc'))).toBe(
      '/catalogo?orden=referencia_desc'
    );
  });

  it('codifica el valor (lo que llegue en la URL no rompe la ruta nueva)', () => {
    expect(conOrdenDeLaUrl('/catalogo', params('orden=a%26b%3Dc'))).toBe('/catalogo?orden=a%26b%3Dc');
  });
});
