import { describe, it, expect } from 'vitest';
import { formatPrice } from './format';

describe('formatPrice', () => {
  it('formatea un número entero al estilo español', () => {
    expect(formatPrice(1500)).toBe('1500');
    expect(formatPrice(1234567)).toBe('1.234.567');
  });

  it('redondea a 0 decimales', () => {
    expect(formatPrice(19.99)).toBe('20');
  });

  it('acepta números como string', () => {
    expect(formatPrice('110')).toBe('110');
  });

  it('devuelve null si el valor no es numérico', () => {
    expect(formatPrice('no-es-un-precio')).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
  });
});
