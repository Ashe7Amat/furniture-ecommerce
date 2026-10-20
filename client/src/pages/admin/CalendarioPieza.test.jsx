// El calendario de una pieza (CalendarioPieza.jsx). Su lista de mutantes está en
// scripts/mutantes/calendarios.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarioPieza from './CalendarioPieza';
import { getCalendarioReservasAdmin } from '../../services/api';

vi.mock('../../services/api');

const HOY = '2026-11-10';
const SOFA = { id: 'm1', nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' };
const MESA = { id: 'm2', nombre: 'Mesa de roble', referencia: 'NAV-MES-007' };
const LAMPARA = { id: 'm3', nombre: 'Lámpara antigua', referencia: null };
const MUEBLES = [SOFA, MESA, LAMPARA];

const ok = (data) => ({ data, error: null, status: 200 });
const falla = (error) => ({ data: null, error, status: 500 });
const diferida = () => {
  let resolver;
  const promesa = new Promise((r) => {
    resolver = r;
  });
  return { promesa, resolver };
};

// Un alquiler del 12 al 15 (se recoge el 15) con 2 días de margen: reservado 12, 13 y 14; margen 15 y 16.
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
const BLOQUEO = {
  ...ALQUILER,
  id: 'r3',
  referencia: 'C3D4E5F6',
  tipo: 'bloqueo',
  etiqueta: 'Bloqueo',
  cliente: null,
  motivo: 'Exposición en la tienda',
  fecha_inicio: '2026-11-18',
  fecha_fin: '2026-11-20',
  fin_ocupacion: '2026-11-20',
  dias_margen: 0,
  ocupada_hasta: '2026-11-20'
};
const VENTA = {
  ...BLOQUEO,
  id: 'r4',
  referencia: 'E5F6A7B8',
  tipo: 'venta',
  etiqueta: 'Venta',
  motivo: null,
  fecha_inicio: '2026-11-25',
  fecha_fin: null,
  fin_ocupacion: null,
  ocupada_hasta: null
};
const PENDIENTE = {
  ...ALQUILER,
  id: 'r5',
  referencia: '5A6B7C8D',
  estado: 'pendiente',
  etiqueta: 'Esperando pago',
  fecha_inicio: '2026-11-22',
  fecha_fin: '2026-11-23',
  fin_ocupacion: '2026-11-23',
  dias_margen: 0,
  ocupada_hasta: '2026-11-23'
};
// Entregada el 1, tenía que volver el 6 y su ocupación (con 2 días de margen) acabó el 8: la pieza sigue fuera.
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

const calendario = (reservas, cambios = {}) => ({
  hoy: HOY,
  desde: '2026-11-01',
  hasta: '2026-11-30',
  reservas,
  limitada: false,
  ...cambios
});

let onVer;

beforeEach(() => {
  vi.resetAllMocks();
  onVer = vi.fn();
  getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER])));
});

const montar = async (props = {}) => {
  const user = userEvent.setup();
  let vista;
  await act(async () => {
    vista = render(<CalendarioPieza muebles={MUEBLES} hoy={HOY} onVer={onVer} {...props} />);
  });
  return { user, ...vista };
};
// Elige la pieza (por el texto de su opción) y espera a que se pinte el mes.
const elegir = async (user, texto = 'Sofá Lumina (NAV-SOF-001)') => {
  await user.selectOptions(screen.getByLabelText('Pieza'), texto);
};
const dia = (n, mes = 'noviembre', anio = 2026) => {
  const nombres = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const fecha = new Date(Date.UTC(anio, ['octubre', 'noviembre', 'diciembre'].indexOf(mes) + 9, n));
  return new RegExp(`^${nombres[(fecha.getUTCDay() + 6) % 7]}, ${n} de ${mes} de ${anio}`);
};

describe('CalendarioPieza: elegir pieza', () => {
  it('sin pieza elegida, dice que elijas una y no lee nada', async () => {
    await montar();

    expect(screen.getByText('Elige una pieza para ver sus reservas mes a mes.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(getCalendarioReservasAdmin).not.toHaveBeenCalled();
  });

  it('las piezas salen por nombre, con su referencia si la tienen', async () => {
    await montar();
    const opciones = within(screen.getByLabelText('Pieza')).getAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual([
      'Elige una pieza',
      'Lámpara antigua',
      'Mesa de roble (NAV-MES-007)',
      'Sofá Lumina (NAV-SOF-001)'
    ]);
  });

  it('con el inventario aún vacío, solo la opción de elegir', async () => {
    await montar({ muebles: undefined });
    expect(within(screen.getByLabelText('Pieza')).getAllByRole('option')).toHaveLength(1);
  });

  it('al elegirla lee el mes de hoy completo, de esa pieza', async () => {
    const { user } = await montar();
    await elegir(user);

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
    expect(getCalendarioReservasAdmin).toHaveBeenCalledWith({ desde: '2026-11-01', hasta: '2026-11-30', muebleId: 'm1' });
    expect(screen.queryByText('Elige una pieza para ver sus reservas mes a mes.')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'noviembre de 2026' })).toBeInTheDocument();
  });

  it('otra pieza la lee de nuevo y deja el detalle cerrado', async () => {
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(13) }));
    expect(screen.getByRole('region', { name: /^Detalle del/ })).toBeInTheDocument();

    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([])));
    await elegir(user, 'Mesa de roble (NAV-MES-007)');

    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-01', hasta: '2026-11-30', muebleId: 'm2' });
    expect(screen.queryByRole('region', { name: /^Detalle del/ })).toBeNull();
  });

  it('volver a «Elige una pieza» vuelve al aviso', async () => {
    const { user } = await montar();
    await elegir(user);
    await elegir(user, 'Elige una pieza');
    expect(screen.getByText('Elige una pieza para ver sus reservas mes a mes.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('con `activo` apagado no lee nada, y al encenderse sí', async () => {
    const { user, rerender } = await montar({ activo: false });
    await elegir(user);
    expect(getCalendarioReservasAdmin).not.toHaveBeenCalled();

    await act(async () => rerender(<CalendarioPieza muebles={MUEBLES} hoy={HOY} onVer={onVer} activo />));
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('cuando sube `version` lee de nuevo', async () => {
    const { user, rerender } = await montar({ version: 0 });
    await elegir(user);
    await act(async () => rerender(<CalendarioPieza muebles={MUEBLES} hoy={HOY} onVer={onVer} version={1} />));
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(2);
  });
});

describe('CalendarioPieza: el mes', () => {
  it('una rejilla de lunes a domingo, con los días del mes y los huecos de antes y después', async () => {
    const { user } = await montar();
    await elegir(user);

    const tabla = screen.getByRole('table', { name: 'Calendario de Sofá Lumina, noviembre de 2026' });
    const cabeceras = within(tabla).getAllByRole('columnheader');
    expect(cabeceras.map((c) => c.textContent)).toEqual(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']);
    expect(cabeceras.map((c) => c.getAttribute('abbr'))).toEqual([
      'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'
    ]);
    // Noviembre de 2026 empieza en domingo: seis huecos antes del día 1 y seis después del 30.
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(6);
    expect(filas.map((f) => within(f).getAllByRole('cell').map((c) => c.textContent.replace(/[a-zñ].*$/i, '').trim()))).toEqual([
      ['', '', '', '', '', '', '1'],
      ['2', '3', '4', '5', '6', '7', '8'],
      ['9', '10', '11', '12', '13', '14', '15'],
      ['16', '17', '18', '19', '20', '21', '22'],
      ['23', '24', '25', '26', '27', '28', '29'],
      ['30', '', '', '', '', '', '']
    ]);
    expect(tabla.querySelectorAll('.ocupacion-dia--fuera')).toHaveLength(12);
  });

  it('un día libre es un texto, no un botón, y el lector de pantalla oye que está libre', async () => {
    const { user } = await montar();
    await elegir(user);

    expect(screen.getByText('miércoles, 11 de noviembre de 2026: libre')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: dia(11) })).toBeNull();
  });

  it('cada día de la reserva es un botón; el margen, también, y dice que es margen', async () => {
    const { user } = await montar();
    await elegir(user);

    expect(screen.getByRole('button', { name: dia(12) })).toHaveAccessibleName(
      'jueves, 12 de noviembre de 2026: alquiler A1B2C3D4 de Ana Pérez, confirmada'
    );
    expect(screen.getByRole('button', { name: dia(14) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: dia(15) })).toHaveAccessibleName(
      'domingo, 15 de noviembre de 2026: margen después de alquiler A1B2C3D4 de Ana Pérez, confirmada'
    );
    expect(screen.getByRole('button', { name: dia(16) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: dia(17) })).toBeNull();
    expect(screen.queryByRole('button', { name: dia(11) })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^[^,]+, \d+ de noviembre/ })).toHaveLength(5);
  });

  it('cada día lleva la clase de su aspecto: reserva, margen, y el de hoy', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, BLOQUEO, VENTA, PENDIENTE])));
    const { user } = await montar();
    await elegir(user);
    const celda = (n) => screen.getByRole('button', { name: dia(n) }).closest('td');

    expect(celda(13)).toHaveClass('ocupacion-dia--alquiler');
    expect(celda(13)).not.toHaveClass('ocupacion-dia--margen');
    expect(celda(16)).toHaveClass('ocupacion-dia--alquiler', 'ocupacion-dia--margen');
    expect(celda(18)).toHaveClass('ocupacion-dia--bloqueo');
    expect(celda(22)).toHaveClass('ocupacion-dia--pendiente');
    expect(celda(25)).toHaveClass('ocupacion-dia--venta');
    expect(celda(30)).toHaveClass('ocupacion-dia--venta');
    expect(screen.getByText('martes, 10 de noviembre de 2026: libre (hoy)').closest('td')).toHaveClass('ocupacion-dia--hoy');
    expect(screen.getByText('miércoles, 11 de noviembre de 2026: libre').closest('td')).not.toHaveClass('ocupacion-dia--hoy');
  });

  it('un día de reserva que es hoy lo dice y se marca', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([{ ...ALQUILER, fecha_inicio: '2026-11-09' }])));
    const { user } = await montar();
    await elegir(user);

    const hoy = screen.getByRole('button', { name: /^martes, 10 de noviembre de 2026.*\(hoy\)$/ });
    expect(hoy.closest('td')).toHaveClass('ocupacion-dia--hoy');
  });

  it('una retrasada deja marcados como «fuera» los días hasta hoy', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA])));
    const { user } = await montar();
    await elegir(user);

    // Reservado del 1 al 5, margen 6 y 7; la pieza sigue fuera desde el 8 hasta hoy, el 10.
    expect(screen.getByRole('button', { name: dia(9) })).toHaveAccessibleName(
      'lunes, 9 de noviembre de 2026: libre en el calendario, pero la pieza sigue fuera, ' +
        'alquiler B2C3D4E5 de Ana Pérez, retrasada'
    );
    expect(screen.getByRole('button', { name: dia(9) }).closest('td')).toHaveClass('ocupacion-dia--retrasada');
    expect(screen.getByRole('button', { name: /^martes, 10 de noviembre.*\(hoy\)$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: dia(11) })).toBeNull();
    expect(screen.getByRole('button', { name: dia(7) }).closest('td')).toHaveClass('ocupacion-dia--margen');
  });

  it('si otra reserva ya ocupa un día en que la retrasada sigue fuera, salen las dos y una marca', async () => {
    const siguiente = { ...ALQUILER, id: 'r6', referencia: '6A7B8C9D', fecha_inicio: '2026-11-09', fin_ocupacion: '2026-11-12', ocupada_hasta: '2026-11-14' };
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA, siguiente])));
    const { user } = await montar();
    await elegir(user);

    const boton = screen.getByRole('button', { name: dia(9) });
    expect(boton).toHaveAccessibleName(
      'lunes, 9 de noviembre de 2026: alquiler 6A7B8C9D de Ana Pérez, confirmada; ' +
        'la pieza sigue fuera de alquiler B2C3D4E5 de Ana Pérez, retrasada'
    );
    expect(boton.closest('td')).toHaveClass('ocupacion-dia--alquiler', 'ocupacion-dia--con-retraso');
    expect(within(boton).getByText('!')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: dia(8) })).queryByText('!')).toBeNull();
  });

  it('el resumen cuenta las reservas del mes, en singular y en plural', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, BLOQUEO, VENTA])));
    const { user } = await montar();
    await elegir(user);
    expect(screen.getByText('3 reservas en noviembre de 2026.')).toBeInTheDocument();

    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER])));
    await elegir(user, 'Mesa de roble (NAV-MES-007)');
    // El resumen cuenta solo las de la pieza elegida: el servidor devuelve la de otra pieza y no cuenta.
    expect(screen.getByText('Ninguna reserva en noviembre de 2026.')).toBeInTheDocument();

    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([{ ...ALQUILER, pieza: MESA }])));
    await elegir(user, 'Sofá Lumina (NAV-SOF-001)');
    await elegir(user, 'Mesa de roble (NAV-MES-007)');
    expect(screen.getByText('1 reserva en noviembre de 2026.')).toBeInTheDocument();
  });

  it('una reserva de otra pieza no se pinta aunque el servidor la mande', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([{ ...ALQUILER, pieza: MESA }])));
    const { user } = await montar();
    await elegir(user);
    expect(screen.queryByRole('button', { name: /^[^,]+, \d+ de noviembre/ })).toBeNull();
  });

  it('una venta ocupa desde su día hasta el final del mes', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([VENTA])));
    const { user } = await montar();
    await elegir(user);

    expect(screen.queryByRole('button', { name: dia(24) })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^[^,]+, \d+ de noviembre/ })).toHaveLength(6);
  });
});

describe('CalendarioPieza: ir de mes en mes', () => {
  it('«Mes siguiente» y «Mes anterior» leen el mes de al lado, entero', async () => {
    const { user } = await montar();
    await elegir(user);

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-12-01', hasta: '2026-12-31', muebleId: 'm1' });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('diciembre de 2026');

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-10-01', hasta: '2026-10-31', muebleId: 'm1' });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('octubre de 2026');
  });

  it('pasa de diciembre a enero y de enero a diciembre', async () => {
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2027-01-01', hasta: '2027-01-31', muebleId: 'm1' });
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-12-01', hasta: '2026-12-31', muebleId: 'm1' });
  });

  it('febrero acaba el 28, o el 29 si el año es bisiesto', async () => {
    const { user, unmount } = await montar({ hoy: '2027-02-10' });
    await elegir(user);
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2027-02-01', hasta: '2027-02-28', muebleId: 'm1' });
    unmount();

    const bisiesto = await montar({ hoy: '2028-02-10' });
    await elegir(bisiesto.user);
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2028-02-01', hasta: '2028-02-29', muebleId: 'm1' });
  });

  it('«Este mes» está apagado en el mes de hoy y vuelve a él desde otro', async () => {
    const { user } = await montar();
    await elegir(user);
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('noviembre de 2026');
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeDisabled();
  });

  it('cambiar de mes cierra el detalle', async () => {
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(13) }));
    expect(screen.getByRole('region', { name: /^Detalle del/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.queryByRole('region', { name: /^Detalle del/ })).toBeNull();
  });

  it('mientras llega el mes nuevo no se enseñan los días del anterior', async () => {
    const { user } = await montar();
    await elegir(user);
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(screen.getByText('Cargando el calendario…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    await act(async () => lectura.resolver(ok(calendario([], { desde: '2026-12-01', hasta: '2026-12-31' }))));
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();
    expect(screen.getByRole('table', { name: 'Calendario de Sofá Lumina, diciembre de 2026' })).toBeInTheDocument();
  });

  it('el mes de hoy sale del servidor si la pestaña llevaba abierta desde ayer', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([], { hoy: '2026-12-01' })));
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeEnabled();
  });
});

describe('CalendarioPieza: el detalle', () => {
  it('pulsar un día abre su reserva, con el día en el título', async () => {
    const { user } = await montar();
    await elegir(user);

    await user.click(screen.getByRole('button', { name: dia(13) }));

    const detalle = screen.getByRole('region', { name: 'Detalle del viernes, 13 de noviembre de 2026' });
    expect(within(detalle).getByRole('heading', { level: 4 })).toHaveTextContent('Confirmada Alquiler A1B2C3D4');
    expect(screen.getByRole('button', { name: dia(13) })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: dia(12) })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: dia(13) }).closest('td')).toHaveClass('is-seleccionado');
  });

  it('un día de margen abre la reserva a la que pertenece', async () => {
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(16) }));
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Alquiler A1B2C3D4');
  });

  it('otro día cambia el detalle; el mismo día lo cierra', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, BLOQUEO])));
    const { user } = await montar();
    await elegir(user);

    await user.click(screen.getByRole('button', { name: dia(13) }));
    await user.click(screen.getByRole('button', { name: dia(18) }));
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Bloqueo C3D4E5F6');
    expect(screen.getAllByRole('region', { name: /^Detalle del/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: dia(13) })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: dia(18) }));
    expect(screen.queryByRole('region', { name: /^Detalle del/ })).toBeNull();
  });

  it('un día con una reserva y una retrasada enseña las dos', async () => {
    const siguiente = { ...ALQUILER, id: 'r6', referencia: '6A7B8C9D', fecha_inicio: '2026-11-09', fin_ocupacion: '2026-11-12', ocupada_hasta: '2026-11-14' };
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA, siguiente])));
    const { user } = await montar();
    await elegir(user);

    await user.click(screen.getByRole('button', { name: dia(9) }));

    const detalle = screen.getByRole('region', { name: /^Detalle del/ });
    expect(within(detalle).getAllByRole('article')).toHaveLength(2);
    expect(within(detalle).getByRole('heading', { name: /Alquiler 6A7B8C9D/ })).toBeInTheDocument();
    expect(within(detalle).getByRole('heading', { name: /Alquiler B2C3D4E5/ })).toBeInTheDocument();
  });

  it('un día solo de la retrasada enseña la retrasada, una vez', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA])));
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(9) }));
    expect(within(screen.getByRole('region', { name: /^Detalle del/ })).getAllByRole('article')).toHaveLength(1);
  });

  it('«Ver reserva» manda la reserva al contenedor', async () => {
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(13) }));

    await user.click(screen.getByRole('button', { name: 'Ver reserva A1B2C3D4 (Sofá Lumina) en la lista' }));

    expect(onVer).toHaveBeenCalledWith(ALQUILER);
  });

  it('«Cerrar detalle» lo cierra y devuelve el foco al día que se pulsó', async () => {
    const { user } = await montar();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(13) }));
    expect(screen.getByRole('region', { name: /^Detalle del/ })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));

    expect(screen.queryByRole('region', { name: /^Detalle del/ })).toBeNull();
    expect(screen.getByRole('button', { name: dia(13) })).toHaveFocus();
  });

  it('si al releer ya no hay nada ese día, el detalle se va', async () => {
    const { user, rerender } = await montar({ version: 0 });
    await elegir(user);
    await user.click(screen.getByRole('button', { name: dia(13) }));
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([])));

    await act(async () => rerender(<CalendarioPieza muebles={MUEBLES} hoy={HOY} onVer={onVer} version={1} />));

    expect(screen.queryByRole('region', { name: /^Detalle del/ })).toBeNull();
  });
});

describe('CalendarioPieza: carga, errores y límites', () => {
  it('mientras lee dice que está cargando y no hay tabla', async () => {
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);
    const { user } = await montar();
    await elegir(user);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando el calendario…');
    expect(screen.queryByRole('table')).toBeNull();

    await act(async () => lectura.resolver(ok(calendario([ALQUILER]))));
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
  });

  it('al releer el mismo mes deja la tabla y la marca como ocupada', async () => {
    const { user, rerender } = await montar({ version: 0 });
    await elegir(user);
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await act(async () => rerender(<CalendarioPieza muebles={MUEBLES} hoy={HOY} onVer={onVer} version={1} />));

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();
    await act(async () => lectura.resolver(ok(calendario([ALQUILER]))));
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
  });

  it('si falla, enseña el mensaje y «Reintentar» lo pide otra vez', async () => {
    getCalendarioReservasAdmin.mockResolvedValueOnce(falla('Error interno al cargar el calendario de reservas.'));
    const { user } = await montar();
    await elegir(user);

    expect(screen.getByRole('alert')).toHaveTextContent('Error interno al cargar el calendario de reservas.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();

    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER])));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('si hay más reservas de las que caben, lo dice', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER], { limitada: true })));
    const { user } = await montar();
    await elegir(user);
    expect(screen.getByText('Hay más reservas de las que caben en el calendario: faltan algunas.')).toBeInTheDocument();
  });

  it('y si no, no', async () => {
    const { user } = await montar();
    await elegir(user);
    expect(screen.queryByText(/Hay más reservas de las que caben/)).toBeNull();
  });

  it('lleva la leyenda con todos los dibujos', async () => {
    const { user } = await montar();
    await elegir(user);
    const leyenda = screen.getByRole('list', { name: 'Leyenda del calendario' });
    expect(within(leyenda).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Alquiler',
      'Esperando pago',
      'Retrasada: la pieza sigue fuera',
      'Bloqueo',
      'Venta',
      'Margen: la pieza descansa'
    ]);
  });
});
