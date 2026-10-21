import { describe, it, expect } from 'vitest';
import {
  formatoPrecio,
  leerPrecio,
  precioDe,
  redondear,
  precioAlquilerPara,
  textoResultadoAlquiler,
  textoPiezas
} from './precios';

describe('formatoPrecio', () => {
  it('sin decimales si es entero, con el punto de los miles a partir de 10.000 (como formatPrice)', () => {
    expect(formatoPrecio(40)).toBe('40');
    expect(formatoPrecio(1250)).toBe('1250');
    expect(formatoPrecio(12500)).toBe('12.500');
    expect(formatoPrecio('300')).toBe('300');
  });

  it('con dos decimales si no es entero', () => {
    expect(formatoPrecio(12.5)).toBe('12,50');
    expect(formatoPrecio(16.65)).toBe('16,65');
  });
});

describe('leerPrecio', () => {
  it('vacío o solo espacios es "sin precio"', () => {
    expect(leerPrecio('')).toEqual({ valor: null });
    expect(leerPrecio('   ')).toEqual({ valor: null });
    expect(leerPrecio(undefined)).toEqual({ valor: null });
  });

  it('lee el número, con punto o con coma, y lo deja en dos decimales', () => {
    expect(leerPrecio('45')).toEqual({ valor: 45 });
    expect(leerPrecio(' 12,5 ')).toEqual({ valor: 12.5 });
    expect(leerPrecio('10.456')).toEqual({ valor: 10.46 });
    expect(leerPrecio('0')).toEqual({ valor: 0 });
  });

  it('un negativo o algo que no es un número no vale', () => {
    expect(leerPrecio('-5')).toEqual({ error: 'Precio no válido' });
    expect(leerPrecio('abc')).toEqual({ error: 'Precio no válido' });
  });
});

describe('precioDe', () => {
  it('null, vacío y 0 cuentan como sin precio', () => {
    expect(precioDe(null)).toBeNull();
    expect(precioDe(undefined)).toBeNull();
    expect(precioDe('')).toBeNull();
    expect(precioDe(0)).toBeNull();
    expect(precioDe('12.5')).toBe(12.5);
  });
});

describe('redondear', () => {
  it('a euros enteros', () => {
    expect(redondear(16.65, 'entero')).toBe(17);
    expect(redondear(62.4, 'entero')).toBe(62);
    expect(redondear(125.5, 'entero')).toBe(126);
  });

  it('a 0,50 €', () => {
    expect(redondear(16.65, 'medio')).toBe(16.5);
    expect(redondear(16.8, 'medio')).toBe(17);
    expect(redondear(16.2, 'medio')).toBe(16);
    expect(redondear(125.5, 'medio')).toBe(125.5);
  });
});

describe('precioAlquilerPara', () => {
  it('precio fijo: el mismo para todas, tengan o no precio de venta', () => {
    expect(precioAlquilerPara({ precio_venta: 300 }, { modo: 'fijo', fijo: 30 })).toBe(30);
    expect(precioAlquilerPara({ precio_venta: null }, { modo: 'fijo', fijo: 30 })).toBe(30);
  });

  it('porcentaje: ese % del precio de venta, redondeado', () => {
    expect(precioAlquilerPara({ precio_venta: 1250 }, { modo: 'porcentaje', porcentaje: 10, redondeo: 'entero' })).toBe(125);
    expect(precioAlquilerPara({ precio_venta: 333 }, { modo: 'porcentaje', porcentaje: 5, redondeo: 'entero' })).toBe(17);
    expect(precioAlquilerPara({ precio_venta: 333 }, { modo: 'porcentaje', porcentaje: 5, redondeo: 'medio' })).toBe(16.5);
    expect(precioAlquilerPara({ precio_venta: '200' }, { modo: 'porcentaje', porcentaje: 7.5, redondeo: 'entero' })).toBe(15);
  });

  it('porcentaje sin precio de venta, o que redondeado se queda en 0: no hay precio', () => {
    expect(precioAlquilerPara({ precio_venta: null }, { modo: 'porcentaje', porcentaje: 10, redondeo: 'entero' })).toBeNull();
    expect(precioAlquilerPara({ precio_venta: 0 }, { modo: 'porcentaje', porcentaje: 10, redondeo: 'entero' })).toBeNull();
    expect(precioAlquilerPara({ precio_venta: 4 }, { modo: 'porcentaje', porcentaje: 5, redondeo: 'entero' })).toBeNull();
    expect(precioAlquilerPara({ precio_venta: 4 }, { modo: 'porcentaje', porcentaje: 5, redondeo: 'medio' })).toBeNull();
  });
});

describe('textos', () => {
  it('"X de Y piezas actualizadas", en singular con una sola pieza', () => {
    expect(textoResultadoAlquiler(3, 4)).toBe('3 de 4 piezas actualizadas');
    expect(textoResultadoAlquiler(0, 2)).toBe('0 de 2 piezas actualizadas');
    expect(textoResultadoAlquiler(1, 1)).toBe('1 de 1 pieza actualizada');
    expect(textoPiezas(1)).toBe('1 pieza');
    expect(textoPiezas(5)).toBe('5 piezas');
  });
});
