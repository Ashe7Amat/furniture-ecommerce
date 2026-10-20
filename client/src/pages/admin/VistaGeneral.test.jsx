// La vista general de ocupación (VistaGeneral.jsx). Su lista de mutantes está en
// scripts/mutantes/vistaGeneral.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VistaGeneral from './VistaGeneral';
import { getCalendarioReservasAdmin } from '../../services/api';

vi.mock('../../services/api');

const HOY = '2026-11-10';
const SOFA = { id: 'm1', nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001' };
const MESA = { id: 'm2', nombre: 'Mesa de roble', referencia: 'NAV-MES-007' };
const LAMPARA = { id: 'm3', nombre: 'Lámpara antigua', referencia: null };
const APARADOR = { id: 'm4', nombre: 'Aparador', referencia: 'NAV-APA-002' };

const ok = (data) => ({ data, error: null, status: 200 });
const falla = (error) => ({ data: null, error, status: 500 });
const diferida = () => {
  let resolver;
  const promesa = new Promise((r) => {
    resolver = r;
  });
  return { promesa, resolver };
};

// Reservado 12, 13 y 14; margen 15 y 16.
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
// Entregada el 1, tenía que volver el 6; su ocupación acabó el 8 y la pieza sigue fuera.
const RETRASADA = {
  ...ALQUILER,
  id: 'r2',
  referencia: 'B2C3D4E5',
  estado: 'en_curso',
  etiqueta: 'Retrasada',
  retrasada: true,
  pieza: MESA,
  fecha_inicio: '2026-11-01',
  fecha_fin: '2026-11-06',
  fin_ocupacion: '2026-11-06',
  ocupada_hasta: '2026-11-08'
};
// La siguiente reserva de la misma mesa: la que corre peligro.
const SIGUIENTE = {
  ...ALQUILER,
  id: 'r6',
  referencia: '6A7B8C9D',
  pieza: MESA,
  cliente: 'Luis Gómez',
  fecha_inicio: '2026-11-12',
  fecha_fin: '2026-11-14',
  fin_ocupacion: '2026-11-14',
  ocupada_hasta: '2026-11-16'
};
const BLOQUEO = {
  ...ALQUILER,
  id: 'r3',
  referencia: 'C3D4E5F6',
  tipo: 'bloqueo',
  etiqueta: 'Bloqueo',
  pieza: LAMPARA,
  cliente: null,
  motivo: 'Exposición en la tienda',
  fecha_inicio: '2026-11-18',
  hora_entrega: null,
  fecha_fin: '2026-11-20',
  hora_recogida: null,
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
  pieza: APARADOR,
  motivo: null,
  fecha_inicio: '2026-11-25',
  fecha_fin: null,
  fin_ocupacion: null,
  ocupada_hasta: null
};

const calendario = (reservas, cambios = {}) => ({
  hoy: HOY,
  desde: '2026-11-10',
  hasta: '2026-12-09',
  reservas,
  limitada: false,
  ...cambios
});

let onVer;

beforeEach(() => {
  vi.resetAllMocks();
  onVer = vi.fn();
  getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, BLOQUEO, VENTA])));
});

const montar = async (props = {}) => {
  const user = userEvent.setup();
  let vista;
  await act(async () => {
    vista = render(<VistaGeneral hoy={HOY} onVer={onVer} {...props} />);
  });
  return { user, ...vista };
};
const fila = (pieza) => within(screen.getByRole('group', { name: `Reservas de ${pieza}` }));
const barra = (pieza, nombre) => fila(pieza).getByRole('button', { name: nombre });

describe('VistaGeneral: la ventana', () => {
  it('lee 30 días desde hoy, de todas las piezas', async () => {
    await montar();

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
    expect(getCalendarioReservasAdmin).toHaveBeenCalledWith({ desde: '2026-11-10', hasta: '2026-12-09', muebleId: undefined });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Del 10/11/2026 al 09/12/2026');
  });

  it('«60 días» lee el doble y queda marcado; «30 días» vuelve', async () => {
    const { user } = await montar();
    const grupo = within(screen.getByRole('group', { name: 'Cuántos días ver' }));
    expect(grupo.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(grupo.getByRole('button', { name: '60 días' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(grupo.getByRole('button', { name: '60 días' }));

    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-10', hasta: '2027-01-08', muebleId: undefined });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Del 10/11/2026 al 08/01/2027');
    expect(grupo.getByRole('button', { name: '60 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(grupo.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(grupo.getByRole('button', { name: '30 días' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-10', hasta: '2026-12-09', muebleId: undefined });
  });

  it('«Semana siguiente» y «Semana anterior» mueven la ventana siete días', async () => {
    const { user } = await montar();

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-17', hasta: '2026-12-16', muebleId: undefined });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Del 17/11/2026 al 16/12/2026');

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-03', hasta: '2026-12-02', muebleId: undefined });
  });

  it('«Hoy» está apagado al empezar y vuelve a hoy desde otra semana', async () => {
    const { user } = await montar();
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(screen.getByRole('button', { name: 'Hoy' })).not.toHaveAttribute('aria-disabled');

    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-10', hasta: '2026-12-09', muebleId: undefined });
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('«Hoy», apagado, sigue en su sitio con el foco y no hace nada', async () => {
    const { user } = await montar();
    const boton = screen.getByRole('button', { name: 'Hoy' });
    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await user.click(boton);
    expect(boton).toHaveFocus();
    const lecturas = getCalendarioReservasAdmin.mock.calls.length;
    await user.click(boton);

    expect(boton).toHaveFocus();
    expect(boton).toBeEnabled();
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(lecturas);
  });

  it('«Hoy» es el del servidor si la pestaña llevaba abierta desde ayer', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([], { hoy: '2026-11-11' })));
    const { user } = await montar();
    expect(screen.getByRole('button', { name: 'Hoy' })).not.toHaveAttribute('aria-disabled');

    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(getCalendarioReservasAdmin).toHaveBeenLastCalledWith({ desde: '2026-11-11', hasta: '2026-12-10', muebleId: undefined });
  });

  it('con `activo` apagado no lee nada, y al encenderse sí', async () => {
    const { rerender } = await montar({ activo: false });
    expect(getCalendarioReservasAdmin).not.toHaveBeenCalled();
    await act(async () => rerender(<VistaGeneral hoy={HOY} onVer={onVer} activo />));
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('cuando sube `version` lee de nuevo', async () => {
    const { rerender } = await montar({ version: 0 });
    await act(async () => rerender(<VistaGeneral hoy={HOY} onVer={onVer} version={1} />));
    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(2);
  });

  it('«Hoy» también cierra el detalle', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await user.click(await screen.findByRole('button', { name: /^bloqueo C3D4E5F6/ }));
    expect(screen.getByRole('region', { name: 'Detalle de la reserva' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
  });

  it('cambiar de ventana cierra el detalle', async () => {
    const { user } = await montar();
    await user.click(barra('Sofá Lumina', /^alquiler A1B2C3D4/));
    expect(screen.getByRole('region', { name: 'Detalle de la reserva' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
  });

  it('cambiar los días que se ven cierra el detalle, y no vuelve a salir cuando llegan los datos', async () => {
    const { user } = await montar();
    await user.click(barra('Sofá Lumina', /^alquiler A1B2C3D4/));
    expect(screen.getByRole('region', { name: 'Detalle de la reserva' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '60 días' }));
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
    // Con los datos de la ventana nueva (la reserva sigue en ella) el detalle no se vuelve a abrir solo.
    await screen.findByText('3 piezas tienen reservas en los 60 días que se ven.');
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();

    await user.click(barra('Sofá Lumina', /^alquiler A1B2C3D4/));
    expect(screen.getByRole('region', { name: 'Detalle de la reserva' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '30 días' }));
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
    await screen.findByText('3 piezas tienen reservas en los 30 días que se ven.');
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
  });
});

const nombresDeFilas = (container) =>
  [...container.querySelectorAll('.ocupacion-fila .ocupacion-pieza-celda strong')].map((e) => e.textContent);

describe('VistaGeneral: la rejilla', () => {
  it('una fila por pieza con reservas, ordenadas por nombre, con su referencia', async () => {
    const { container } = await montar();

    expect(nombresDeFilas(container)).toEqual(['Aparador', 'Lámpara antigua', 'Sofá Lumina']);
    const region = screen.getByRole('region', { name: /^Rejilla de reservas por pieza y día/ });
    expect(within(region).getByText('Ref. NAV-SOF-001')).toBeInTheDocument();
    expect(within(region).getByText('Ref. NAV-APA-002')).toBeInTheDocument();
  });

  it('una pieza vendida antes de la ventana no sale; la vendida dentro de ella, sí', async () => {
    const vendidaAntes = { ...VENTA, id: 'r7', referencia: '7A8B9C0D', pieza: MESA, fecha_inicio: '2026-11-09' };
    const vendidaHoy = { ...VENTA, id: 'r8', referencia: '8B9C0D1E', pieza: LAMPARA, fecha_inicio: '2026-11-10' };
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, vendidaAntes, vendidaHoy])));
    const { container } = await montar();

    expect(nombresDeFilas(container)).toEqual(['Lámpara antigua', 'Sofá Lumina']);
    expect(screen.getByText('2 piezas tienen reservas en los 30 días que se ven.')).toBeInTheDocument();
  });

  it('el resumen cuenta las piezas con reservas, en singular y en plural', async () => {
    await montar();
    expect(screen.getByText('3 piezas tienen reservas en los 30 días que se ven.')).toBeInTheDocument();
  });

  it('con una sola pieza, en singular; sin ninguna, no hay rejilla', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER])));
    const uno = await montar();
    expect(screen.getByText('1 pieza tiene reservas en los 30 días que se ven.')).toBeInTheDocument();
    uno.unmount();

    // Dos reservas de la misma pieza siguen siendo una pieza.
    const otra = { ...ALQUILER, id: 'r9', referencia: '9A0B1C2D', fecha_inicio: '2026-11-20', fin_ocupacion: '2026-11-22', ocupada_hasta: '2026-11-24' };
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, otra])));
    const dos = await montar();
    expect(screen.getByText('1 pieza tiene reservas en los 30 días que se ven.')).toBeInTheDocument();
    dos.unmount();

    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([])));
    await montar();
    expect(screen.getByText('Ninguna pieza tiene reservas en los 30 días que se ven.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('el resumen dice los días que se ven', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: '60 días' }));
    expect(screen.getByText('3 piezas tienen reservas en los 60 días que se ven.')).toBeInTheDocument();
  });

  it('lleva el número de días a la CSS para que las columnas cuadren', async () => {
    const { user } = await montar();
    const region = () => screen.getByRole('region', { name: /^Rejilla/ });
    expect(region().style.getPropertyValue('--dias')).toBe('30');
    await user.click(screen.getByRole('button', { name: '60 días' }));
    expect(region().style.getPropertyValue('--dias')).toBe('60');
  });

  it('la barra de una reserva ocupa sus días y el margen detrás, con su aspecto', async () => {
    await montar();
    const boton = barra('Sofá Lumina', 'alquiler A1B2C3D4 de Ana Pérez, confirmada, del 12/11/2026 al 15/11/2026, con 2 días de margen');

    // Empieza el día 12: la tercera columna (el 10 es la primera); 3 de reserva y 2 de margen.
    expect(boton.style.gridColumn).toBe('3 / 8');
    expect(boton.style.gridTemplateColumns).toBe('3fr 2fr');
    expect(boton).toHaveClass('ocupacion-barra', 'ocupacion-barra--alquiler');
    expect(boton).not.toHaveClass('es-cortada-izq');
    expect(boton).not.toHaveClass('es-cortada-der');
    expect(within(boton).getByText('A1B2C3D4')).toBeInTheDocument();
  });

  it('un bloqueo sin margen y una venta sin fin, cada uno con su aspecto', async () => {
    await montar();
    const bloqueo = barra('Lámpara antigua', /^bloqueo C3D4E5F6/);
    expect(bloqueo).toHaveAccessibleName('bloqueo C3D4E5F6 (Exposición en la tienda), del 18/11/2026 al 20/11/2026');
    expect(bloqueo).toHaveClass('ocupacion-barra--bloqueo');
    expect(bloqueo.style.gridColumn).toBe('9 / 11');
    expect(bloqueo.style.gridTemplateColumns).toBe('2fr 0fr');

    const venta = barra('Aparador', 'venta E5F6A7B8, desde el 25/11/2026, sin fin');
    expect(venta).toHaveClass('ocupacion-barra--venta', 'es-cortada-der');
    expect(venta).not.toHaveClass('es-cortada-izq');
    expect(venta.style.gridColumn).toBe('16 / 31');
  });

  it('una reserva que empieza antes de la ventana lo marca por la izquierda', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([{ ...ALQUILER, fecha_inicio: '2026-11-05', fin_ocupacion: '2026-11-13', fecha_fin: '2026-11-13', ocupada_hasta: '2026-11-15' }])));
    await montar();
    const boton = barra('Sofá Lumina', /^alquiler A1B2C3D4/);
    expect(boton).toHaveClass('es-cortada-izq');
    expect(boton).not.toHaveClass('es-cortada-der');
    expect(boton.style.gridColumn).toBe('1 / 6');
    expect(boton.style.gridTemplateColumns).toBe('3fr 2fr');
  });

  it('una reserva con solo el margen dentro de la ventana enseña solo el margen, sin referencia', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([{ ...ALQUILER, fecha_inicio: '2026-11-05', fin_ocupacion: '2026-11-10', fecha_fin: '2026-11-10', ocupada_hasta: '2026-11-12' }])));
    await montar();
    const boton = barra('Sofá Lumina', /^alquiler A1B2C3D4/);
    expect(boton.style.gridColumn).toBe('1 / 3');
    expect(boton.style.gridTemplateColumns).toBe('0fr 2fr');
    expect(within(boton).queryByText('A1B2C3D4')).toBeNull();
  });

  it('una reserva fuera de la ventana no sale', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([{ ...ALQUILER, fecha_inicio: '2027-02-05', fin_ocupacion: '2027-02-07', ocupada_hasta: '2027-02-09' }])));
    await montar();
    expect(screen.queryByRole('group', { name: /^Reservas de/ })).toBeNull();
  });

  it('una retrasada tiene su franja de «Fuera» debajo, con los días que lleva la pieza fuera', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA])));
    await montar();

    const franja = fila('Mesa de roble').getByRole('button', {
      name: 'alquiler B2C3D4E5 de Ana Pérez, retrasada: la recogida estaba prevista el 06/11/2026 y la pieza sigue fuera'
    });
    expect(franja).toHaveClass('ocupacion-fuera');
    expect(franja).toHaveTextContent('Fuera');
    // Del 8 a hoy, el 10: la primera columna, que es hoy.
    expect(franja.style.gridColumn).toBe('1 / 2');
    // Su reserva ya acabó antes de la ventana: no tiene barra.
    expect(fila('Mesa de roble').getAllByRole('button')).toHaveLength(1);
  });

  it('la franja «Fuera» llega hasta el día de hoy del servidor, no hasta el de la pestaña', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA], { hoy: '2026-11-12' })));
    await montar();

    const franja = fila('Mesa de roble').getByRole('button', { name: /la pieza sigue fuera$/ });
    // Del 8 al 12, hoy incluido; la ventana empieza el 10: las columnas 1, 2 y 3.
    expect(franja.style.gridColumn).toBe('1 / 4');
  });

  it('una retrasada cuya ocupación aún se ve tiene la barra y la franja', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA])));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA])));
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));

    // La ventana empieza el 27 de octubre: la barra de la retrasada (hasta el 8) y la franja (del 8 al 10).
    expect(fila('Mesa de roble').getAllByRole('button')).toHaveLength(2);
    expect(barra('Mesa de roble', /^alquiler B2C3D4E5.*retrasada, del 01\/11\/2026 al 06\/11\/2026, con 2 días de margen$/)).toHaveClass('ocupacion-barra--retrasada');
  });

  it('marca la columna de hoy en cada fila mientras hoy está en la ventana', async () => {
    const { container, user } = await montar();
    const marcas = () => container.querySelectorAll('.ocupacion-hoy');
    expect(marcas()).toHaveLength(3);
    expect([...marcas()].every((m) => m.style.gridColumn === '1 / 2')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(marcas()).toHaveLength(0);
  });

  it('la marca de hoy sale el último día de la ventana y no sale cuando hoy queda detrás', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER], { hoy: '2026-12-09' })));
    const ultimo = await montar();
    expect(ultimo.container.querySelector('.ocupacion-hoy').style.gridColumn).toBe('30 / 31');
    ultimo.unmount();

    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER], { hoy: '2026-12-10' })));
    const detras = await montar();
    expect(detras.container.querySelectorAll('.ocupacion-hoy')).toHaveLength(0);
  });

  it('con hoy en medio de la ventana, su columna es la que toca', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER], { hoy: '2026-11-14' })));
    const { container } = await montar();
    expect(container.querySelector('.ocupacion-hoy').style.gridColumn).toBe('5 / 6');
  });

  it('la cabecera: los meses con su ancho, los números de los días, los fines de semana y hoy', async () => {
    const { container } = await montar();
    const meses = [...container.querySelectorAll('.ocupacion-meses span')];
    expect(meses.map((m) => [m.textContent, m.style.gridColumn])).toEqual([
      ['noviembre de 2026', '1 / 22'],
      ['diciembre de 2026', '22 / 31']
    ]);
    const numeros = [...container.querySelectorAll('.ocupacion-numeros span')];
    expect(numeros).toHaveLength(30);
    expect(numeros[0]).toHaveTextContent('10');
    expect(numeros[21]).toHaveTextContent('1');
    expect(numeros[29]).toHaveTextContent('9');
    expect(numeros[0]).toHaveClass('es-hoy');
    expect(numeros.filter((n) => n.classList.contains('es-hoy'))).toHaveLength(1);
    // El 14 y el 15 de noviembre de 2026 son sábado y domingo; el 10 es martes.
    expect(numeros.filter((n) => n.classList.contains('es-finde')).slice(0, 2).map((n) => n.textContent)).toEqual(['14', '15']);
    expect(numeros.filter((n) => n.classList.contains('es-finde'))).toHaveLength(8);
    expect(numeros[1]).not.toHaveClass('es-finde');
  });

  it('la cabecera es solo visual: el lector de pantalla oye las barras', async () => {
    const { container } = await montar();
    expect(container.querySelector('.ocupacion-cabecera')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('VistaGeneral: riesgos', () => {
  it('«A vigilar» avisa de la retrasada con otra reserva detrás de la misma pieza', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA, SIGUIENTE])));
    await montar();

    const riesgos = screen.getByRole('region', { name: 'A vigilar' });
    expect(within(riesgos).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Mesa de roble: la reserva B2C3D4E5 está retrasada y la siguiente, 6A7B8C9D, empieza dentro de 2 días (el 12/11/2026).'
    ]);
  });

  it('con varios, el más cercano primero', async () => {
    const lejana = { ...SIGUIENTE, id: 'r7', referencia: '7B8C9D0E', pieza: SOFA, fecha_inicio: '2026-11-20', fin_ocupacion: '2026-11-22', ocupada_hasta: '2026-11-24' };
    const otraRetrasada = { ...RETRASADA, id: 'r8', referencia: '8C9D0E1F', pieza: SOFA };
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([lejana, otraRetrasada, RETRASADA, SIGUIENTE])));
    await montar();
    const items = within(screen.getByRole('region', { name: 'A vigilar' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Mesa de roble');
    expect(items[1]).toHaveTextContent('Sofá Lumina');
  });

  it('sin riesgos, no hay sección', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER, BLOQUEO, VENTA])));
    await montar();
    expect(screen.queryByRole('region', { name: 'A vigilar' })).toBeNull();
    expect(screen.queryByText('A vigilar')).toBeNull();
  });

  it('cuenta con los días de hoy del servidor', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA, SIGUIENTE], { hoy: '2026-11-12' })));
    await montar();
    expect(screen.getByRole('region', { name: 'A vigilar' })).toHaveTextContent('empieza hoy');
  });
});

describe('VistaGeneral: el detalle', () => {
  it('pulsar una barra abre su reserva, sin título de día', async () => {
    const { user } = await montar();
    const boton = barra('Sofá Lumina', /^alquiler A1B2C3D4/);

    await user.click(boton);

    const detalle = screen.getByRole('region', { name: 'Detalle de la reserva' });
    expect(within(detalle).getByRole('heading', { level: 4 })).toHaveTextContent('Confirmada Alquiler A1B2C3D4');
    expect(within(detalle).getAllByRole('article')).toHaveLength(1);
    expect(boton).toHaveAttribute('aria-pressed', 'true');
    expect(barra('Aparador', /^venta/)).toHaveAttribute('aria-pressed', 'false');
    expect(boton).toHaveClass('is-seleccionado');
    expect(detalle).toHaveFocus();
  });

  it('otra barra cambia el detalle; la misma lo cierra', async () => {
    const { user } = await montar();
    await user.click(barra('Sofá Lumina', /^alquiler A1B2C3D4/));
    await user.click(barra('Aparador', /^venta/));
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Venta Venta E5F6A7B8');

    await user.click(barra('Aparador', /^venta/));
    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
  });

  it('la franja de una retrasada abre su reserva y se marca ella', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([RETRASADA])));
    const { user } = await montar();
    const franja = fila('Mesa de roble').getByRole('button');

    await user.click(franja);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Retrasada Alquiler B2C3D4E5');
    expect(franja).toHaveAttribute('aria-pressed', 'true');
    expect(franja).toHaveClass('is-seleccionado');
  });

  it('«Ver reserva» manda la reserva al contenedor', async () => {
    const { user } = await montar();
    await user.click(barra('Lámpara antigua', /^bloqueo/));

    await user.click(screen.getByRole('button', { name: 'Ver reserva C3D4E5F6 (Lámpara antigua) en la lista' }));

    expect(onVer).toHaveBeenCalledWith(BLOQUEO);
  });

  it('«Cerrar detalle» lo cierra y devuelve el foco a la barra', async () => {
    const { user } = await montar();
    await user.click(barra('Sofá Lumina', /^alquiler A1B2C3D4/));

    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));

    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
    expect(barra('Sofá Lumina', /^alquiler A1B2C3D4/)).toHaveFocus();
  });

  it('si al releer la reserva ya no está, el detalle se va', async () => {
    const { user, rerender } = await montar({ version: 0 });
    await user.click(barra('Sofá Lumina', /^alquiler A1B2C3D4/));
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([BLOQUEO, VENTA])));

    await act(async () => rerender(<VistaGeneral hoy={HOY} onVer={onVer} version={1} />));

    expect(screen.queryByRole('region', { name: 'Detalle de la reserva' })).toBeNull();
  });
});

describe('VistaGeneral: carga, errores y límites', () => {
  it('mientras lee dice que está cargando y no hay rejilla', async () => {
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);
    await montar();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando el calendario…');
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText(/piezas? (tiene|tienen) reservas/)).toBeNull();

    await act(async () => lectura.resolver(ok(calendario([ALQUILER]))));
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();
    expect(screen.getByRole('region', { name: /^Rejilla/ })).toHaveAttribute('aria-busy', 'false');
  });

  it('el aviso de estado es siempre el mismo: cambia de texto al cambiar de ventana y el título no es una zona viva', async () => {
    const { user } = await montar();
    const estado = screen.getByRole('status');
    expect(estado).toHaveTextContent('3 piezas tienen reservas en los 30 días que se ven.');
    expect(screen.getByRole('heading', { level: 3 })).not.toHaveAttribute('aria-live');

    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);
    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(screen.getByRole('status')).toBe(estado);
    expect(estado).toHaveTextContent('Cargando el calendario…');

    await act(async () => lectura.resolver(ok(calendario([BLOQUEO]))));
    expect(screen.getByRole('status')).toBe(estado);
    expect(estado).toHaveTextContent('1 pieza tiene reservas en los 30 días que se ven.');
  });

  it('si la lectura falla, el aviso de estado queda vacío (habla el error)', async () => {
    getCalendarioReservasAdmin.mockResolvedValueOnce(falla('Error interno al cargar el calendario de reservas.'));
    await montar();

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('al cambiar de ventana no enseña la anterior mientras llega la nueva', async () => {
    const { user } = await montar();
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));

    expect(screen.getByText('Cargando el calendario…')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Rejilla/ })).toBeNull();
  });

  it('al releer la misma ventana deja la rejilla y la marca como ocupada', async () => {
    const { rerender } = await montar({ version: 0 });
    const lectura = diferida();
    getCalendarioReservasAdmin.mockReturnValue(lectura.promesa);

    await act(async () => rerender(<VistaGeneral hoy={HOY} onVer={onVer} version={1} />));

    expect(screen.getByRole('region', { name: /^Rejilla/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();
  });

  it('si falla, enseña el mensaje y «Reintentar» lo pide otra vez', async () => {
    getCalendarioReservasAdmin.mockResolvedValueOnce(falla('Error interno al cargar el calendario de reservas.'));
    const { user } = await montar();

    expect(screen.getByRole('alert')).toHaveTextContent('Error interno al cargar el calendario de reservas.');
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText('Cargando el calendario…')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(getCalendarioReservasAdmin).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('region', { name: /^Rejilla/ })).toBeInTheDocument();
  });

  it('si hay más reservas de las que caben, lo dice y pide menos días', async () => {
    getCalendarioReservasAdmin.mockResolvedValue(ok(calendario([ALQUILER], { limitada: true })));
    await montar();
    expect(
      screen.getByText('Hay más reservas de las que caben en el calendario: faltan algunas. Elige menos días.')
    ).toBeInTheDocument();
  });

  it('y si no, no', async () => {
    await montar();
    expect(screen.queryByText(/Hay más reservas de las que caben/)).toBeNull();
  });

  it('lleva la leyenda', async () => {
    await montar();
    expect(within(screen.getByRole('list', { name: 'Leyenda del calendario' })).getAllByRole('listitem')).toHaveLength(6);
  });
});
