// El detalle que se abre al pulsar un día o una barra de los calendarios (DetalleOcupacion.jsx). Su
// lista de mutantes está en scripts/mutantes/calendarios.js.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DetalleOcupacion from './DetalleOcupacion';

const SOFA = { id: 'm1', nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' };
const ALQUILER = {
  id: 'r1',
  referencia: 'A1B2C3D4',
  tipo: 'alquiler',
  estado: 'confirmada',
  etiqueta: 'Confirmada',
  retrasada: false,
  en_conflicto: false,
  pieza: SOFA,
  cliente: 'Ana Pérez',
  motivo: null,
  fecha_inicio: '2026-11-12',
  hora_entrega: '10:00',
  fecha_fin: '2026-11-15',
  hora_recogida: '18:30',
  fin_ocupacion: '2026-11-15',
  dias_margen: 2,
  ocupada_hasta: '2026-11-17'
};
const RETRASADA = {
  ...ALQUILER,
  id: 'r2',
  referencia: 'B2C3D4E5',
  estado: 'en_curso',
  etiqueta: 'Retrasada',
  retrasada: true,
  fecha_inicio: '2026-11-01',
  fecha_fin: '2026-11-06',
  fin_ocupacion: '2026-11-06',
  ocupada_hasta: '2026-11-08'
};
const BLOQUEO = {
  ...ALQUILER,
  id: 'r3',
  referencia: 'C3D4E5F6',
  tipo: 'bloqueo',
  etiqueta: 'Bloqueo',
  cliente: null,
  motivo: 'Exposición en la tienda',
  fecha_inicio: '2026-11-18',
  fecha_fin: '2026-11-19',
  fin_ocupacion: '2026-11-19',
  dias_margen: 0,
  ocupada_hasta: '2026-11-19'
};
const VENTA = {
  ...BLOQUEO,
  id: 'r4',
  referencia: 'E5F6A7B8',
  tipo: 'venta',
  etiqueta: 'Venta',
  motivo: null,
  fecha_inicio: '2026-11-20',
  fecha_fin: null,
  fin_ocupacion: null,
  ocupada_hasta: null
};

const montar = (props = {}) => {
  const onVer = vi.fn();
  const onCerrar = vi.fn();
  const vista = render(<DetalleOcupacion reservas={[ALQUILER]} onVer={onVer} onCerrar={onCerrar} {...props} />);
  return { onVer, onCerrar, ...vista };
};
const filas = (articulo) =>
  within(articulo)
    .getAllByRole('term')
    .map((dt) => [dt.textContent, dt.nextElementSibling.textContent]);

describe('DetalleOcupacion', () => {
  it('un alquiler: su etiqueta, su referencia, la pieza y las fechas de la tarjeta', () => {
    montar();
    const detalle = screen.getByRole('region', { name: 'Detalle de la reserva' });
    const articulo = within(detalle).getByRole('article');

    expect(within(articulo).getByRole('heading', { level: 4 })).toHaveTextContent('Confirmada Alquiler A1B2C3D4');
    expect(within(articulo).getByText('Sofá Lumina')).toBeInTheDocument();
    expect(within(articulo).getByText('NAV-SOF-001', { exact: false })).toBeInTheDocument();
    expect(filas(articulo)).toEqual([
      ['Cliente', 'Ana Pérez'],
      ['Entrega', '12/11/2026 a las 10:00'],
      ['Recogida', '15/11/2026 a las 18:30'],
      ['Margen', '2 días después de la recogida'],
      ['Libre de nuevo el', '17/11/2026']
    ]);
  });

  it('un bloqueo y una venta, con su tipo y sus datos', () => {
    montar({ reservas: [BLOQUEO, VENTA] });
    const [bloqueo, venta] = screen.getAllByRole('article');

    expect(within(bloqueo).getByRole('heading', { level: 4 })).toHaveTextContent('Bloqueo Bloqueo C3D4E5F6');
    expect(filas(bloqueo)).toEqual([
      ['Desde', '18/11/2026'],
      ['Libre de nuevo el', '19/11/2026'],
      ['Motivo', 'Exposición en la tienda']
    ]);
    expect(within(venta).getByRole('heading', { level: 4 })).toHaveTextContent('Venta Venta E5F6A7B8');
    expect(filas(venta)).toEqual([['Desde', '20/11/2026']]);
  });

  it('con un día, lo dice en su título y en el nombre de la región', () => {
    montar({ dia: '2026-11-13' });
    const detalle = screen.getByRole('region', { name: 'Detalle del viernes, 13 de noviembre de 2026' });
    expect(within(detalle).getByText('viernes, 13 de noviembre de 2026')).toBeInTheDocument();
  });

  it('sin día, no hay título de día', () => {
    montar();
    expect(screen.queryByText(/de noviembre de 2026$/)).toBeNull();
  });

  it('una reserva por tarjeta, cada una con su botón', () => {
    montar({ reservas: [ALQUILER, RETRASADA] });
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Ver reserva / })).toHaveLength(2);
  });

  it('una retrasada dice que la recogida pasó y que la pieza sigue fuera', () => {
    montar({ reservas: [RETRASADA] });
    expect(screen.getByText('La recogida estaba prevista el 06/11/2026 y la pieza sigue fuera.')).toBeInTheDocument();
    expect(screen.getByText('Retrasada', { selector: '.reserva-etiqueta' })).toHaveClass('is-aviso');
  });

  it('una pagada sin confirmar manda a «En conflicto»', () => {
    montar({ reservas: [{ ...ALQUILER, en_conflicto: true, etiqueta: 'No se pudo confirmar' }] });
    expect(
      screen.getByText('Esta reserva está pagada pero no se pudo confirmar: mírala en «En conflicto».')
    ).toBeInTheDocument();
    expect(screen.getByText('No se pudo confirmar', { selector: '.reserva-etiqueta' })).toHaveClass('is-aviso');
  });

  it('una reserva normal no lleva avisos ni la marca de aviso', () => {
    montar();
    expect(screen.queryByText(/sigue fuera/)).toBeNull();
    expect(screen.queryByText(/no se pudo confirmar/)).toBeNull();
    expect(screen.getByText('Confirmada', { selector: '.reserva-etiqueta' })).toHaveClass('estado-confirmada');
    expect(screen.getByText('Confirmada', { selector: '.reserva-etiqueta' })).not.toHaveClass('is-aviso');
  });

  it('cada reserva lleva la clase de su aspecto', () => {
    montar({ reservas: [ALQUILER, RETRASADA, BLOQUEO, VENTA] });
    expect(screen.getAllByRole('article').map((a) => a.className)).toEqual([
      'ocupacion-detalle-reserva ocupacion-detalle--alquiler',
      'ocupacion-detalle-reserva ocupacion-detalle--retrasada',
      'ocupacion-detalle-reserva ocupacion-detalle--bloqueo',
      'ocupacion-detalle-reserva ocupacion-detalle--venta'
    ]);
  });

  it('«Ver reserva» se describe con la pieza y manda la reserva pulsada', async () => {
    const user = userEvent.setup();
    const { onVer } = montar({ reservas: [ALQUILER, BLOQUEO] });

    await user.click(screen.getByRole('button', { name: 'Ver reserva C3D4E5F6 (Sofá Lumina) en la lista' }));

    expect(onVer).toHaveBeenCalledTimes(1);
    expect(onVer).toHaveBeenCalledWith(BLOQUEO);
  });

  it('«Cerrar detalle» avisa', async () => {
    const user = userEvent.setup();
    const { onCerrar } = montar();
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('al abrirse se lleva el foco, y vuelve a llevárselo cuando cambia lo que enseña', () => {
    const { rerender, onVer, onCerrar } = montar({ dia: '2026-11-13' });
    const detalle = screen.getByRole('region');
    expect(detalle).toHaveFocus();

    screen.getByRole('button', { name: 'Cerrar detalle' }).focus();
    rerender(<DetalleOcupacion reservas={[ALQUILER]} dia="2026-11-13" onVer={onVer} onCerrar={onCerrar} />);
    expect(screen.getByRole('button', { name: 'Cerrar detalle' })).toHaveFocus();

    rerender(<DetalleOcupacion reservas={[ALQUILER]} dia="2026-11-14" onVer={onVer} onCerrar={onCerrar} />);
    expect(screen.getByRole('region')).toHaveFocus();

    screen.getByRole('button', { name: 'Cerrar detalle' }).focus();
    rerender(<DetalleOcupacion reservas={[ALQUILER, RETRASADA]} dia="2026-11-14" onVer={onVer} onCerrar={onCerrar} />);
    expect(screen.getByRole('region')).toHaveFocus();
  });
});
