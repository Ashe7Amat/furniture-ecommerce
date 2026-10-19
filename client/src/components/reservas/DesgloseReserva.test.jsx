// El desglose del precio de una reserva (DesgloseReserva.jsx): enseña lo que calcula el servidor, sin
// calcular nada.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DesgloseReserva from './DesgloseReserva';
import { eurosDeCentimos } from '../../utils/reservas';

const PRESUPUESTO = {
  dias: 4,
  precio_dia_centimos: 2500,
  subtotal_alquiler_centimos: 10000,
  tramo: null,
  descuento_centimos: 0,
  entrega: { modo: 'domicilio', importe_centimos: 3000 },
  recogida: { modo: 'tienda', importe_centimos: 0 },
  importe_total_centimos: 13000
};

const filas = () =>
  [...document.querySelectorAll('.reserva-desglose-fila')].map((fila) => [
    fila.querySelector('dt').textContent,
    fila.querySelector('dd').textContent
  ]);

describe('DesgloseReserva', () => {
  it('días × precio por día, entrega, recogida (gratis si no cuesta nada) y total con IVA incluido', () => {
    render(<DesgloseReserva presupuesto={PRESUPUESTO} />);

    expect(filas()).toEqual([
      [`4 días × ${eurosDeCentimos(2500)}`, eurosDeCentimos(10000)],
      ['Entrega a domicilio', eurosDeCentimos(3000)],
      ['Recogida en la tienda', 'Gratis'],
      ['Total', `${eurosDeCentimos(13000)} IVA incluido`]
    ]);
    expect(screen.getByText('IVA incluido')).toHaveClass('reserva-desglose-iva');
  });

  it('con un descuento por duración, su porcentaje y desde cuántos días, en negativo', () => {
    render(
      <DesgloseReserva
        presupuesto={{
          ...PRESUPUESTO,
          dias: 1,
          subtotal_alquiler_centimos: 2500,
          tramo: { desde_dias: 1, porcentaje: 10 },
          descuento_centimos: 250,
          entrega: { modo: 'tienda', importe_centimos: 0 },
          recogida: { modo: 'domicilio', importe_centimos: 3000 },
          importe_total_centimos: 5250
        }}
      />
    );

    expect(filas()).toEqual([
      [`1 día × ${eurosDeCentimos(2500)}`, eurosDeCentimos(2500)],
      ['Descuento del 10 % (1 día o más)', `−${eurosDeCentimos(250)}`],
      ['Entrega en la tienda', 'Gratis'],
      ['Recogida a domicilio', eurosDeCentimos(3000)],
      ['Total', `${eurosDeCentimos(5250)} IVA incluido`]
    ]);
  });

  it('un descuento sin tramo dice solo "Descuento"', () => {
    render(<DesgloseReserva presupuesto={{ ...PRESUPUESTO, descuento_centimos: 500, importe_total_centimos: 12500 }} />);
    expect(filas()[1]).toEqual(['Descuento', `−${eurosDeCentimos(500)}`]);
  });
});
