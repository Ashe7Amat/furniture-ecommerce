import { describe, it, expect } from 'vitest';
import {
  formatearImporte,
  textoPiezas,
  tooltipVentas,
  tooltipCategorias,
  etiquetaMes,
  hayVentas,
  hayCategorias
} from './dashboard';

describe('formatearImporte', () => {
  it('escribe los euros a la española, con hasta dos decimales', () => {
    expect(formatearImporte(125)).toBe('125 €');
    expect(formatearImporte(99.5)).toBe('99,5 €');
    expect(formatearImporte(12500.5)).toBe('12.500,5 €');
    expect(formatearImporte(10.256)).toBe('10,26 €');
    expect(formatearImporte(0)).toBe('0 €');
  });

  it('un valor que no es un número da un guion largo, no "NaN"', () => {
    expect(formatearImporte(undefined)).toBe('—');
    expect(formatearImporte('abc')).toBe('—');
    expect(formatearImporte(Infinity)).toBe('—');
  });
});

describe('textos de los tooltips (en castellano)', () => {
  it('textoPiezas pone el singular para una y el plural para el resto', () => {
    expect(textoPiezas(1)).toBe('1 pieza');
    expect(textoPiezas(0)).toBe('0 piezas');
    expect(textoPiezas(12)).toBe('12 piezas');
  });

  it('el tooltip de ventas da el importe y la serie "Ventas"', () => {
    expect(tooltipVentas(300)).toEqual(['300 €', 'Ventas']);
  });

  it('el tooltip de categorías da las piezas y la serie "Vendidas"', () => {
    expect(tooltipCategorias(3)).toEqual(['3 piezas', 'Vendidas']);
    expect(tooltipCategorias(1)).toEqual(['1 pieza', 'Vendidas']);
  });

  it('el título del tooltip de ventas es el mes', () => {
    expect(etiquetaMes('Oct')).toBe('Mes: Oct');
  });
});

describe('hayVentas / hayCategorias', () => {
  it('hay ventas si algún mes vende algo', () => {
    expect(hayVentas([{ mes: 'Sep', total: 0 }, { mes: 'Oct', total: 10 }])).toBe(true);
  });

  it('sin ventas en ningún mes, o sin lista, no hay ventas', () => {
    expect(hayVentas([{ mes: 'Sep', total: 0 }])).toBe(false);
    expect(hayVentas([])).toBe(false);
    expect(hayVentas(undefined)).toBe(false);
  });

  it('hay categorías si la lista trae alguna', () => {
    expect(hayCategorias([{ categoria: 'Sillas', cantidad: 2 }])).toBe(true);
    expect(hayCategorias([])).toBe(false);
    expect(hayCategorias(null)).toBe(false);
  });
});
