// El calendario de la ficha (CalendarioReserva.jsx): la rejilla de lunes a domingo, los nombres de
// cada día para los lectores de pantalla, los días que no se pueden pulsar, la elección de entrega y
// recogida y el paso de un mes a otro.
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarioReserva from './CalendarioReserva';

// Hoy es el lunes 2 de noviembre de 2026; se puede empezar del 4 de noviembre al 2 de diciembre, de
// 1 a 30 días, con 2 de margen. Ocupado del 10 al 14 de noviembre.
const DISP = {
  hoy: '2026-11-02',
  primer_inicio_posible: '2026-11-04',
  ultimo_inicio_posible: '2026-12-02',
  reglas: { duracion_min_dias: 1, duracion_max_dias: 30, dias_margen: 2 },
  ocupado: [{ desde: '2026-11-10', hasta: '2026-11-15', tipo: 'reservado' }]
};

// Con estado, como en la ficha: cada clic cambia la selección.
const ConEstado = ({ disponibilidad = DISP, alCambiar = () => {} }) => {
  const [fechas, setFechas] = useState({ inicio: null, fin: null });
  return (
    <CalendarioReserva
      disponibilidad={disponibilidad}
      inicio={fechas.inicio}
      fin={fechas.fin}
      onCambiar={(nuevas) => {
        alCambiar(nuevas);
        setFechas(nuevas);
      }}
    />
  );
};

const montar = (props) => {
  const user = userEvent.setup();
  const utils = render(<ConEstado {...props} />);
  return { user, ...utils };
};
const dia = (nombre) => screen.getByRole('button', { name: nombre });
const instrucciones = () => document.querySelector('.cal-reserva-instrucciones');

describe('CalendarioReserva — la rejilla', () => {
  it('un mes de lunes a domingo, con el nombre completo de cada día en la cabecera', () => {
    montar();

    expect(screen.getByRole('heading', { name: 'Noviembre de 2026' })).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: 'Noviembre de 2026' });
    const cabeceras = within(tabla).getAllByRole('columnheader');
    expect(cabeceras.map((c) => c.textContent)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(cabeceras[2].querySelector('abbr')).toHaveAttribute('title', 'miércoles');
    // El 1 de noviembre de 2026 es domingo: la primera semana tiene 6 huecos antes.
    const primeraSemana = within(tabla).getAllByRole('row')[1];
    const celdas = within(primeraSemana).getAllByRole('cell');
    expect(celdas.slice(0, 6).every((c) => c.textContent === '')).toBe(true);
    expect(within(celdas[6]).getByRole('button')).toHaveTextContent('1');
  });

  it('cada día es un botón con su fecha completa; los que no se pueden elegir, desactivados y "no disponible"', () => {
    montar();

    expect(dia('lunes, 2 de noviembre de 2026, no disponible')).toBeDisabled();
    expect(dia('miércoles, 4 de noviembre de 2026')).toBeEnabled();
    expect(dia('miércoles, 4 de noviembre de 2026')).toHaveAttribute('aria-pressed', 'false');
    // Ocupado
    expect(dia('jueves, 12 de noviembre de 2026, no disponible')).toBeDisabled();
    // Libre, pero sin sitio para un día antes de lo ocupado (más el margen)
    expect(dia('domingo, 8 de noviembre de 2026, no disponible')).toBeDisabled();
    expect(dia('domingo, 15 de noviembre de 2026')).toBeEnabled();
    expect(screen.getByText('Libre')).toBeInTheDocument();
    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });
});

describe('CalendarioReserva — elegir las fechas', () => {
  it('el primer clic es la entrega y el segundo la recogida', async () => {
    const alCambiar = vi.fn();
    const { user } = montar({ alCambiar });
    expect(instrucciones()).toHaveTextContent('Elige el día de entrega.');

    await user.click(dia('miércoles, 4 de noviembre de 2026'));
    expect(alCambiar).toHaveBeenLastCalledWith({ inicio: '2026-11-04', fin: null });
    expect(dia('miércoles, 4 de noviembre de 2026, entrega')).toHaveAttribute('aria-pressed', 'true');
    expect(instrucciones()).toHaveTextContent(
      'Entrega el miércoles, 4 de noviembre de 2026. Ahora elige el día de recogida.'
    );
    // Como recogida, solo hasta el 8 (el 10 empieza lo ocupado y hay 2 días de margen).
    expect(dia('domingo, 8 de noviembre de 2026')).toBeEnabled();
    expect(dia('lunes, 9 de noviembre de 2026, no disponible')).toBeDisabled();
    expect(dia('domingo, 15 de noviembre de 2026, no disponible')).toBeDisabled();

    await user.click(dia('sábado, 7 de noviembre de 2026'));
    expect(alCambiar).toHaveBeenLastCalledWith({ inicio: '2026-11-04', fin: '2026-11-07' });
    expect(dia('sábado, 7 de noviembre de 2026, recogida')).toHaveAttribute('aria-pressed', 'true');
    expect(dia('jueves, 5 de noviembre de 2026')).toHaveClass('cal-reserva-dia--rango');
    expect(dia('miércoles, 4 de noviembre de 2026, entrega')).not.toHaveClass('cal-reserva-dia--rango');
    expect(instrucciones()).toHaveTextContent(
      'Entrega el miércoles, 4 de noviembre de 2026 y recogida el sábado, 7 de noviembre de 2026.'
    );
  });

  it('con las dos fechas, otro clic empieza una selección nueva', async () => {
    const { user } = montar();
    await user.click(dia('miércoles, 4 de noviembre de 2026'));
    await user.click(dia('viernes, 6 de noviembre de 2026'));

    await user.click(dia('domingo, 15 de noviembre de 2026'));
    expect(dia('domingo, 15 de noviembre de 2026, entrega')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recogida$/ })).not.toBeInTheDocument();
  });

  it('eligiendo la recogida, un día anterior a la entrega la cambia, y la misma entrega la deshace', async () => {
    const { user } = montar();
    await user.click(dia('viernes, 6 de noviembre de 2026'));

    await user.click(dia('miércoles, 4 de noviembre de 2026'));
    expect(dia('miércoles, 4 de noviembre de 2026, entrega')).toBeInTheDocument();
    expect(dia('viernes, 6 de noviembre de 2026')).toHaveAttribute('aria-pressed', 'false');

    await user.click(dia('miércoles, 4 de noviembre de 2026, entrega'));
    expect(screen.queryByRole('button', { name: /entrega$/ })).not.toBeInTheDocument();
    expect(instrucciones()).toHaveTextContent('Elige el día de entrega.');
  });

  it('la recogida se anuncia como tal aunque ese día no se pueda volver a pulsar, y no suelta el foco', async () => {
    const alCambiar = vi.fn();
    const { user } = montar({ alCambiar });
    await user.click(dia('miércoles, 4 de noviembre de 2026'));
    await user.click(dia('domingo, 8 de noviembre de 2026'));

    // El 8 no sirve como entrega (no cabe un día antes de lo ocupado): no se puede pulsar, pero se
    // anuncia como "recogida" y sigue con el foco (aria-disabled, no disabled).
    const recogida = dia('domingo, 8 de noviembre de 2026, recogida');
    expect(recogida).toHaveAttribute('aria-disabled', 'true');
    expect(recogida).toBeEnabled();
    expect(recogida).toHaveFocus();
    alCambiar.mockClear();
    await user.click(recogida);
    expect(alCambiar).not.toHaveBeenCalled();
    expect(dia('domingo, 8 de noviembre de 2026, recogida')).toBeInTheDocument();
    // Una recogida que también sirve de entrega se puede pulsar (empieza otra selección)
    expect(dia('miércoles, 4 de noviembre de 2026, entrega')).not.toHaveAttribute('aria-disabled');
  });

  it('"Borrar fechas" quita la selección y deja el foco en las instrucciones; sin nada elegido, no aparece', async () => {
    const alCambiar = vi.fn();
    const { user } = montar({ alCambiar });
    expect(screen.queryByRole('button', { name: 'Borrar fechas' })).not.toBeInTheDocument();
    await user.click(dia('miércoles, 4 de noviembre de 2026'));

    await user.click(screen.getByRole('button', { name: 'Borrar fechas' }));
    expect(alCambiar).toHaveBeenLastCalledWith({ inicio: null, fin: null });
    expect(screen.queryByRole('button', { name: 'Borrar fechas' })).not.toBeInTheDocument();
    expect(instrucciones()).toHaveFocus();
    expect(instrucciones()).toHaveTextContent('Elige el día de entrega.');
  });
});

describe('CalendarioReserva — los meses', () => {
  it('empieza en el mes de la primera entrega posible', () => {
    montar({ disponibilidad: { ...DISP, primer_inicio_posible: '2026-12-01' } });
    expect(screen.getByRole('heading', { name: 'Diciembre de 2026' })).toBeInTheDocument();
  });

  it('se puede ir del mes de hoy al de la última recogida posible, y no más allá', async () => {
    const { user } = montar();
    const anterior = screen.getByRole('button', { name: 'Mes anterior' });
    const siguiente = screen.getByRole('button', { name: 'Mes siguiente' });
    expect(anterior).toHaveAttribute('aria-disabled', 'true');
    expect(siguiente).not.toHaveAttribute('aria-disabled');
    // En el primer mes, "Mes anterior" no hace nada
    await user.click(anterior);
    expect(screen.getByRole('heading', { name: 'Noviembre de 2026' })).toBeInTheDocument();

    await user.click(siguiente);
    expect(screen.getByRole('heading', { name: 'Diciembre de 2026' })).toBeInTheDocument();
    expect(anterior).not.toHaveAttribute('aria-disabled');
    await user.click(siguiente);
    // 2 de diciembre + 30 días = 1 de enero de 2027
    expect(screen.getByRole('heading', { name: 'Enero de 2027' })).toBeInTheDocument();
    expect(siguiente).toHaveAttribute('aria-disabled', 'true');
    // Al llegar al límite pulsándolo, el botón conserva el foco y ya no avanza
    expect(siguiente).toHaveFocus();
    await user.click(siguiente);
    expect(screen.getByRole('heading', { name: 'Enero de 2027' })).toBeInTheDocument();
    expect(dia('viernes, 1 de enero de 2027, no disponible')).toBeDisabled();

    await user.click(anterior);
    expect(screen.getByRole('heading', { name: 'Diciembre de 2026' })).toBeInTheDocument();
  });

  it('se puede elegir la recogida en el mes siguiente', async () => {
    const { user } = montar();
    await user.click(dia('lunes, 30 de noviembre de 2026'));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    await user.click(dia('jueves, 3 de diciembre de 2026'));
    expect(dia('jueves, 3 de diciembre de 2026, recogida')).toBeInTheDocument();
    expect(dia('martes, 1 de diciembre de 2026')).toHaveClass('cal-reserva-dia--rango');
  });

  it('si la disponibilidad se recarga con otros límites, el mes visible se queda dentro', async () => {
    const user = userEvent.setup();
    const props = { inicio: null, fin: null, onCambiar: () => {} };
    const { rerender } = render(<CalendarioReserva disponibilidad={DISP} {...props} />);

    // "Hoy" pasa a diciembre: noviembre ya no se puede ver
    rerender(<CalendarioReserva disponibilidad={{ ...DISP, hoy: '2026-12-01', primer_inicio_posible: '2026-12-03' }} {...props} />);
    expect(screen.getByRole('heading', { name: 'Diciembre de 2026' })).toBeInTheDocument();

    rerender(<CalendarioReserva disponibilidad={DISP} {...props} />);
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('heading', { name: 'Enero de 2027' })).toBeInTheDocument();

    // Ahora la última recogida posible cae en diciembre: enero ya no se puede ver
    rerender(<CalendarioReserva disponibilidad={{ ...DISP, ultimo_inicio_posible: '2026-11-20' }} {...props} />);
    expect(screen.getByRole('heading', { name: 'Diciembre de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toHaveAttribute('aria-disabled', 'true');
  });
});
