import { describe, it, expect } from 'vitest';
import { formatPrice, textoPrecio, tienePrecio, TEXTO_SIN_PRECIO } from './format';

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

describe('textoPrecio y tienePrecio (fase C)', () => {
  it('venta primero; si no, alquiler por día; si no hay ninguno, "Consultar precio"', () => {
    expect(textoPrecio({ precio_venta: 1250, precio_alquiler_dia: 40 })).toBe('1250 €');
    expect(textoPrecio({ precio_venta: null, precio_alquiler_dia: 40 })).toBe('40 €/día');
    expect(textoPrecio({ precio_venta: null, precio_alquiler_dia: null })).toBe('Consultar precio');
    expect(textoPrecio({})).toBe(TEXTO_SIN_PRECIO);
    expect(textoPrecio(undefined)).toBe(TEXTO_SIN_PRECIO);
  });

  it('un precio 0 cuenta como "sin precio", igual que en el resto del catálogo', () => {
    expect(textoPrecio({ precio_venta: 0, precio_alquiler_dia: 0 })).toBe('Consultar precio');
    expect(tienePrecio({ precio_venta: 0, precio_alquiler_dia: 0 })).toBe(false);
  });

  it('tienePrecio: si tiene alguno de los dos', () => {
    expect(tienePrecio({ precio_venta: 10 })).toBe(true);
    expect(tienePrecio({ precio_alquiler_dia: 5 })).toBe(true);
    expect(tienePrecio({ precio_venta: null, precio_alquiler_dia: null })).toBe(false);
    expect(tienePrecio(null)).toBe(false);
  });
});
