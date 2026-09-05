import { describe, it, expect } from 'vitest';
import { getImagen, PLACEHOLDER_IMG } from './images';

describe('getImagen', () => {
  it('devuelve la imagen en la posición pedida cuando existe', () => {
    const imagenes = ['foto1.jpg', 'foto2.jpg'];
    expect(getImagen(imagenes, 0)).toBe('foto1.jpg');
    expect(getImagen(imagenes, 1)).toBe('foto2.jpg');
  });

  it('usa la posición 0 por defecto cuando no se indica índice', () => {
    expect(getImagen(['foto1.jpg'])).toBe('foto1.jpg');
  });

  it('devuelve el placeholder si el array está vacío', () => {
    expect(getImagen([])).toBe(PLACEHOLDER_IMG);
  });

  it('devuelve el placeholder si el índice pedido no existe', () => {
    expect(getImagen(['foto1.jpg'], 3)).toBe(PLACEHOLDER_IMG);
  });

  it('devuelve el placeholder si "imagenes" no es un array (null, undefined, string)', () => {
    expect(getImagen(null)).toBe(PLACEHOLDER_IMG);
    expect(getImagen(undefined)).toBe(PLACEHOLDER_IMG);
    expect(getImagen('no-es-un-array')).toBe(PLACEHOLDER_IMG);
  });
});
