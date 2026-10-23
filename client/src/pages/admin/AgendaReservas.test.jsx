// La agenda de hoy y mañana de «Reservas»: las entregas y recogidas juntas, por día y hora, con lo que
// hace falta para llamar y organizar la ruta. La lista de mutantes (scripts/mutantes/agendaReservas.js)
// corre este archivo.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaReservas from './AgendaReservas';

const HOY = '2026-10-13';
const MANANA = '2026-10-14';

const ENTREGA = {
  clave: 'r1:entrega',
  tipo: 'entrega',
  dia: HOY,
  hora: '10:00',
  modo: 'domicilio',
  atrasada: false,
  prevista: null,
  reserva: {
    id: 'r1',
    referencia: 'A1B2C3D4',
    pieza: { nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' },
    cliente: { nombre: 'Ana Pérez', telefono: '600 111 222' },
    direccion: 'Calle Mayor 1, Barcelona'
  }
};
const RECOGIDA = {
  clave: 'r2:recogida',
  tipo: 'recogida',
  dia: MANANA,
  hora: '18:30',
  modo: 'tienda',
  atrasada: false,
  prevista: null,
  reserva: {
    id: 'r2',
    referencia: 'B2C3D4E5',
    pieza: { nombre: 'Mesa de roble', referencia: null },
    cliente: { nombre: 'Luis Gómez', telefono: null },
    direccion: null
  }
};
const DATOS = { hoy: HOY, manana: MANANA, trayectos: [ENTREGA, RECOGIDA] };

const montar = (props = {}) => {
  const onVer = vi.fn();
  const onRecargar = vi.fn();
  render(<AgendaReservas datos={DATOS} error="" onVer={onVer} onRecargar={onRecargar} {...props} />);
  return { onVer, onRecargar };
};
const agenda = () => within(screen.getByRole('region', { name: 'Hoy y mañana' }));
const dia = (nombre) => within(screen.getByRole('heading', { level: 4, name: new RegExp(`^${nombre}`) }).parentElement);

describe('AgendaReservas — lo que enseña', () => {
  it('sin agenda y sin error no pinta nada (la primera lectura, o una respuesta vacía)', () => {
    const { container } = render(<AgendaReservas datos={null} error="" onVer={vi.fn()} onRecargar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('es una región con su título, el resumen y los dos días con su fecha larga', () => {
    montar();
    expect(agenda().getByRole('heading', { level: 3, name: 'Hoy y mañana' })).toBeInTheDocument();
    expect(agenda().getByText('1 entrega y 1 recogida')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Hoy martes, 13 de octubre de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Mañana miércoles, 14 de octubre de 2026' })).toBeInTheDocument();
  });

  it('cada día lleva solo lo suyo', () => {
    montar();
    expect(dia('Hoy').getByText('Silla Tolix')).toBeInTheDocument();
    expect(dia('Hoy').queryByText('Mesa de roble')).toBeNull();
    expect(dia('Mañana').getByText('Mesa de roble')).toBeInTheDocument();
    expect(dia('Mañana').queryByText('Silla Tolix')).toBeNull();
  });

  it('una entrega: la hora, que es una entrega, a domicilio, la pieza con su referencia, el cliente, su teléfono y la dirección', () => {
    montar();
    const fila = within(screen.getByText('Silla Tolix').closest('li'));
    expect(fila.getByText('10:00')).toBeInTheDocument();
    expect(fila.getByText('Entrega')).toBeInTheDocument();
    expect(fila.getByText('A domicilio')).toBeInTheDocument();
    expect(fila.getByText('Ref. NAV-SIL-001')).toBeInTheDocument();
    expect(fila.getByText(/Ana Pérez/)).toBeInTheDocument();
    expect(fila.getByRole('link', { name: '600 111 222' })).toHaveAttribute('href', 'tel:600 111 222');
    expect(fila.getByText('Calle Mayor 1, Barcelona')).toBeInTheDocument();
  });

  it('una recogida en tienda: sin dirección ni teléfono, y sin referencia si la pieza no la tiene', () => {
    montar();
    const fila = within(screen.getByText('Mesa de roble').closest('li'));
    expect(fila.getByText('Recogida')).toBeInTheDocument();
    expect(fila.getByText('En tienda')).toBeInTheDocument();
    expect(fila.getByText('Luis Gómez')).toBeInTheDocument();
    expect(fila.queryByRole('link')).toBeNull();
    expect(fila.queryByText(/^Ref\./)).toBeNull();
    expect(fila.queryByText('A domicilio')).toBeNull();
    expect(screen.getByText('Mesa de roble').closest('li').querySelector('.agenda-direccion')).toBeNull();
  });

  it('sin hora lo dice; sin cliente, no inventa nada', () => {
    montar({
      datos: {
        ...DATOS,
        trayectos: [{ ...ENTREGA, hora: null, reserva: { ...ENTREGA.reserva, cliente: null, direccion: null } }]
      }
    });
    const fila = within(screen.getByText('Silla Tolix').closest('li'));
    expect(fila.getByText('Sin hora')).toBeInTheDocument();
    expect(fila.queryByText(/Ana Pérez/)).toBeNull();
  });

  it('una entrega atrasada dice cuándo tenía que hacerse', () => {
    montar({
      datos: { ...DATOS, trayectos: [{ ...ENTREGA, atrasada: true, prevista: '2026-10-11' }] }
    });
    expect(screen.getByText('Tenía que entregarse el 11/10/2026')).toBeInTheDocument();
  });

  it('una entrega a tiempo no dice nada de atraso', () => {
    montar();
    expect(screen.queryByText(/Tenía que entregarse/)).toBeNull();
  });

  it('un día sin nada lo dice, y el resumen también', () => {
    montar({ datos: { ...DATOS, trayectos: [] } });
    expect(screen.getAllByText('Nada que entregar ni recoger.')).toHaveLength(2);
    expect(screen.getByText('Nada que entregar ni recoger hoy ni mañana')).toBeInTheDocument();
  });

  it('un día con trayectos y el otro vacío: solo el vacío lo dice', () => {
    montar({ datos: { ...DATOS, trayectos: [ENTREGA] } });
    expect(dia('Hoy').queryByText('Nada que entregar ni recoger.')).toBeNull();
    expect(dia('Mañana').getByText('Nada que entregar ni recoger.')).toBeInTheDocument();
  });

  it('varios trayectos de un día salen en el orden que da el servidor', () => {
    const OTRA = { ...ENTREGA, clave: 'r3:entrega', hora: '16:00', reserva: { ...ENTREGA.reserva, id: 'r3', pieza: { nombre: 'Lámpara', referencia: null } } };
    montar({ datos: { ...DATOS, trayectos: [ENTREGA, OTRA, RECOGIDA] } });
    const filas = within(screen.getByRole('heading', { level: 4, name: /^Hoy/ }).parentElement).getAllByRole('listitem');
    expect(filas.map((f) => within(f).getByText(/^\d\d:\d\d$/).textContent)).toEqual(['10:00', '16:00']);
  });
});

describe('AgendaReservas — «Ver reserva»', () => {
  it('cada trayecto tiene su botón, que dice de qué reserva es, y avisa con el trayecto', async () => {
    const user = userEvent.setup();
    const { onVer } = montar();

    await user.click(screen.getByRole('button', { name: 'Ver reserva B2C3D4E5 (Mesa de roble)' }));

    expect(onVer).toHaveBeenCalledTimes(1);
    expect(onVer).toHaveBeenCalledWith(RECOGIDA);
    expect(screen.getByRole('button', { name: 'Ver reserva A1B2C3D4 (Silla Tolix)' })).toBeInTheDocument();
  });
});

describe('AgendaReservas — cuando falla la lectura', () => {
  it('con una agenda de antes: se queda, y el aviso va encima con su botón', async () => {
    const user = userEvent.setup();
    const { onRecargar } = montar({ error: 'No se ha podido cargar la agenda de hoy y mañana.' });

    expect(screen.getByRole('status')).toHaveTextContent('No se ha podido cargar la agenda de hoy y mañana.');
    expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a cargar la agenda' }));
    expect(onRecargar).toHaveBeenCalledTimes(1);
  });

  it('sin agenda de antes: el título y el aviso, sin resumen ni días', () => {
    montar({ datos: null, error: 'No se ha podido cargar la agenda de hoy y mañana.' });

    expect(agenda().getByRole('heading', { level: 3, name: 'Hoy y mañana' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No se ha podido cargar la agenda de hoy y mañana.');
    expect(screen.queryByRole('heading', { level: 4 })).toBeNull();
    expect(screen.queryByText(/Nada que entregar/)).toBeNull();
  });

  it('sin error no hay aviso', () => {
    montar();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Volver a cargar la agenda' })).toBeNull();
  });
});
