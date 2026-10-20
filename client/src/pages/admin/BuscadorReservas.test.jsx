// El buscador de la pestaña «Reservas» (BuscadorReservas.jsx). La lista de mutantes está en
// scripts/mutantes/buscadorReservas.js.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuscadorReservas from './BuscadorReservas';

const montar = (props = {}) => {
  const onBuscar = vi.fn();
  const onQuitar = vi.fn();
  const utiles = render(<BuscadorReservas activa={null} onBuscar={onBuscar} onQuitar={onQuitar} {...props} />);
  return { onBuscar, onQuitar, ...utiles, user: userEvent.setup() };
};

const texto = () => screen.getByRole('searchbox', { name: 'Cliente, pieza o referencia' });
const desde = () => screen.getByLabelText('Desde el día');
const hasta = () => screen.getByLabelText('Hasta el día');
const elegir = (campo, valor) => fireEvent.change(campo, { target: { value: valor } });

describe('BuscadorReservas — el formulario', () => {
  it('es una búsqueda con su nombre, tres campos con etiqueta y un solo botón al principio', () => {
    montar();

    expect(screen.getByRole('search', { name: 'Buscar reservas' })).toBeInTheDocument();
    expect(texto()).toHaveValue('');
    expect(texto()).toHaveAttribute('maxLength', '100');
    expect(texto()).toHaveAttribute('placeholder', 'Nombre, teléfono, email, pieza o referencia de la reserva');
    expect(desde()).toHaveAttribute('type', 'date');
    expect(hasta()).toHaveAttribute('type', 'date');
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('«Hasta el día» no deja elegir un día anterior a «Desde el día»', () => {
    montar();
    expect(hasta()).not.toHaveAttribute('min');

    elegir(desde(), '2026-11-02');

    expect(hasta()).toHaveAttribute('min', '2026-11-02');
  });
});

describe('BuscadorReservas — buscar', () => {
  it('manda el texto sin los espacios de los lados, y las fechas vacías', async () => {
    const { user, onBuscar } = montar();

    await user.type(texto(), '  ana pérez  ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).toHaveBeenCalledTimes(1);
    expect(onBuscar).toHaveBeenCalledWith({ q: 'ana pérez', desde: '', hasta: '' });
  });

  it('Intro en el campo de texto también busca', async () => {
    const { user, onBuscar } = montar();

    await user.type(texto(), 'sofá{Enter}');

    expect(onBuscar).toHaveBeenCalledWith({ q: 'sofá', desde: '', hasta: '' });
  });

  it('solo con fechas', async () => {
    const { user, onBuscar } = montar();

    elegir(desde(), '2026-11-02');
    elegir(hasta(), '2026-11-09');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).toHaveBeenCalledWith({ q: '', desde: '2026-11-02', hasta: '2026-11-09' });
  });

  it('con una sola fecha', async () => {
    const { user, onBuscar } = montar();

    elegir(hasta(), '2026-11-09');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).toHaveBeenCalledWith({ q: '', desde: '', hasta: '2026-11-09' });
  });

  it('un solo día vale: desde y hasta iguales', async () => {
    const { user, onBuscar } = montar();

    elegir(desde(), '2026-11-02');
    elegir(hasta(), '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).toHaveBeenCalledWith({ q: '', desde: '2026-11-02', hasta: '2026-11-02' });
  });

  it('la fecha final anterior a la inicial no se manda, y se dice por qué', async () => {
    const { user, onBuscar } = montar();

    elegir(desde(), '2026-11-09');
    elegir(hasta(), '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha final no puede ser anterior a la inicial.');
  });

  it('sin nada escrito no busca, y pide escribir algo', async () => {
    const { user, onBuscar, onQuitar } = montar();

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).not.toHaveBeenCalled();
    expect(onQuitar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe qué buscar o elige unas fechas.');
  });

  it('solo espacios cuenta como nada', async () => {
    const { user, onBuscar } = montar();

    await user.type(texto(), '   ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('el aviso se quita al tocar cualquier campo', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(texto(), 'a');
    expect(screen.queryByRole('alert')).toBeNull();

    await user.clear(texto());
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    elegir(desde(), '2026-11-02');
    expect(screen.queryByRole('alert')).toBeNull();

    elegir(desde(), '');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    elegir(hasta(), '2026-11-02');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una búsqueda buena quita el aviso de antes', async () => {
    const { user, onBuscar } = montar();
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(texto(), 'ana');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BuscadorReservas — limpiar', () => {
  it('con algo escrito sale «Limpiar búsqueda»: vacía los campos, avisa y deja el foco en el texto', async () => {
    const { user, onQuitar } = montar();
    await user.type(texto(), 'ana');
    elegir(desde(), '2026-11-02');
    elegir(hasta(), '2026-11-09');

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(texto()).toHaveValue('');
    expect(desde()).toHaveValue('');
    expect(hasta()).toHaveValue('');
    expect(onQuitar).toHaveBeenCalledTimes(1);
    expect(texto()).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
  });

  it('sale con solo una fecha, o con solo texto', async () => {
    const { user } = montar();
    elegir(hasta(), '2026-11-09');
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument();
    elegir(hasta(), '');
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
    elegir(desde(), '2026-11-02');
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument();
    elegir(desde(), '');
    await user.type(texto(), 'a');
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument();
  });

  it('también quita el aviso de un envío vacío', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    elegir(desde(), '2026-11-09');
    elegir(hasta(), '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BuscadorReservas — con una búsqueda hecha', () => {
  const ACTIVA = { q: 'ana', desde: '2026-11-02', hasta: '' };

  it('los campos enseñan lo que se buscó y «Limpiar búsqueda» está siempre', () => {
    montar({ activa: ACTIVA });

    expect(texto()).toHaveValue('ana');
    expect(desde()).toHaveValue('2026-11-02');
    expect(hasta()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument();
  });

  it('«Buscar» con los campos vacíos equivale a quitarla', async () => {
    const { user, onBuscar, onQuitar } = montar({ activa: ACTIVA });
    await user.clear(texto());
    elegir(desde(), '');

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onQuitar).toHaveBeenCalledTimes(1);
    expect(onBuscar).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cambiar los campos y buscar manda la búsqueda nueva', async () => {
    const { user, onBuscar } = montar({ activa: ACTIVA });

    await user.clear(texto());
    await user.type(texto(), 'luis');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBuscar).toHaveBeenCalledWith({ q: 'luis', desde: '2026-11-02', hasta: '' });
  });

  it('si la búsqueda se quita desde fuera (se eligió una vista), los campos se vacían', () => {
    const { rerender, onBuscar, onQuitar } = montar({ activa: ACTIVA });
    expect(texto()).toHaveValue('ana');

    rerender(<BuscadorReservas activa={null} onBuscar={onBuscar} onQuitar={onQuitar} />);

    expect(texto()).toHaveValue('');
    expect(desde()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
  });

  it('si se quita desde fuera, se va también el aviso que hubiera', async () => {
    const { user, rerender, onBuscar, onQuitar } = montar({ activa: ACTIVA });
    elegir(desde(), '2026-11-09');
    elegir(hasta(), '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<BuscadorReservas activa={null} onBuscar={onBuscar} onQuitar={onQuitar} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lo que se escribe sin buscar se conserva si la búsqueda de antes no cambia', async () => {
    const { user, rerender, onBuscar, onQuitar } = montar({ activa: ACTIVA });
    await user.type(texto(), ' garcía');

    rerender(<BuscadorReservas activa={ACTIVA} onBuscar={onBuscar} onQuitar={onQuitar} />);

    expect(texto()).toHaveValue('ana garcía');
  });

  it('lo que se escribe sin buscar se conserva si hay otra búsqueda hecha', async () => {
    const { user, rerender, onBuscar, onQuitar } = montar({ activa: ACTIVA });
    await user.type(texto(), ' garcía');

    rerender(<BuscadorReservas activa={{ ...ACTIVA, q: 'ana garcía' }} onBuscar={onBuscar} onQuitar={onQuitar} />);

    expect(texto()).toHaveValue('ana garcía');
  });

  it('lo que se escribe sin haber buscado nada no se borra solo', async () => {
    const { user, rerender, onBuscar, onQuitar } = montar();
    await user.type(texto(), 'ana');

    rerender(<BuscadorReservas activa={null} onBuscar={onBuscar} onQuitar={onQuitar} />);

    expect(texto()).toHaveValue('ana');
  });
});
