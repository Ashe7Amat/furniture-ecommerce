// El formulario de las altas en el calendario sin pago web, montado solo: "Bloquear fechas" y
// "Registrar venta fuera de la web" (el alquiler fuera de la web se prueba desde la pestaña, en
// reservasPanel.test.jsx y panelReferencias.test.jsx).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AltaCalendarioModal from './AltaCalendarioModal';

const MUEBLES = [
  { id: 'm1', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' },
  { id: 'm2', nombre: 'Banco sin referencia', referencia: null }
];
const HOY = '2026-11-03';

const montar = (tipo, props = {}) => {
  const onEnviar = vi.fn();
  const onCerrar = vi.fn();
  render(
    <AltaCalendarioModal
      tipo={tipo}
      muebles={MUEBLES}
      hoy={HOY}
      enviando={false}
      error=""
      onEnviar={onEnviar}
      onCerrar={onCerrar}
      {...props}
    />
  );
  return { onEnviar, onCerrar };
};
const escribir = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const enviar = (boton) => fireEvent.click(screen.getByRole('button', { name: boton }));

describe('AltaCalendarioModal — bloquear fechas', () => {
  it('pide el motivo y manda pieza, fechas y motivo sin espacios', () => {
    const { onEnviar } = montar('bloqueo');
    expect(screen.getByRole('dialog', { name: 'Bloquear fechas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Banco sin referencia' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primer día bloqueado')).toHaveValue(HOY);
    expect(screen.getByLabelText('Libre de nuevo el')).toHaveAccessibleDescription(
      'El primer día que se puede volver a reservar.'
    );
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('placeholder', 'Mantenimiento, exposición…');

    escribir('Pieza', 'm1');
    escribir('Libre de nuevo el', '2026-11-06');
    enviar('Bloquear fechas');
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el motivo.');
    expect(onEnviar).not.toHaveBeenCalled();

    escribir('Motivo', '  Exposición  ');
    enviar('Bloquear fechas');
    expect(onEnviar).toHaveBeenCalledWith({
      mueble_id: 'm1',
      fecha_inicio: HOY,
      fecha_fin: '2026-11-06',
      motivo: 'Exposición'
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el error del servidor se enseña, y mientras envía el botón dice «Guardando…»', () => {
    montar('bloqueo', { error: 'Choca con NAV-SIL-001 del 4 al 5', enviando: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Choca con NAV-SIL-001 del 4 al 5');
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('«Volver» cierra', () => {
    const { onCerrar } = montar('bloqueo');
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onCerrar).toHaveBeenCalled();
  });
});

describe('AltaCalendarioModal — venta fuera de la web', () => {
  it('explica qué es, pide la fecha de la venta y manda solo pieza, fecha y motivo', () => {
    const { onEnviar } = montar('venta', { inicial: { mueble_id: 'm2' } });
    expect(screen.getByRole('dialog', { name: 'Registrar venta fuera de la web' })).toBeInTheDocument();
    expect(screen.getByText(/Para una venta en la tienda o por teléfono/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pieza')).toHaveValue('m2');
    expect(screen.queryByLabelText('Libre de nuevo el')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('placeholder', 'Venta en tienda, entrega diferida…');

    escribir('Fecha de la venta', '2026-11-10');
    escribir('Motivo', 'Venta en tienda');
    enviar('Registrar venta');
    expect(onEnviar).toHaveBeenCalledWith({
      mueble_id: 'm2',
      fecha_inicio: '2026-11-10',
      motivo: 'Venta en tienda'
    });
  });
});

describe('AltaCalendarioModal — alquiler fuera de la web', () => {
  it('la casilla «Ya está entregada» se marca y se manda', () => {
    const { onEnviar } = montar('alquiler', { inicial: { mueble_id: 'm1', nombre: 'Ana', direccion: 'C/ Mar 1' } });
    escribir('Día de recogida', '2026-11-05');
    fireEvent.click(screen.getByRole('checkbox', { name: /Ya está entregada/ }));
    enviar('Registrar alquiler');
    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({ ya_entregado: true, fecha_fin: '2026-11-05' }));
  });
});
