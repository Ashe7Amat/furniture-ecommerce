// «Gestionar fianza» en el panel de reservas (R-e): el botón solo en las devueltas cuya fianza está por
// resolver (lo dice el servidor en `acciones`), el modal para devolverla entera o retener una parte con
// su motivo, y lo que se manda a la acción «devolver-fianza». La API es un mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReservasTab from './ReservasTab';
import { ToastContext } from '../../../context/ToastContext';
import { getReservasAdmin, accionReservaAdmin } from '../../../services/api';
import { eurosDeCentimos } from '../../../utils/reservas';

// Intl separa la cifra del € con un espacio duro: Testing Library lo normaliza en los textos, no en
// los nombres accesibles (los botones van con eurosDeCentimos tal cual).
const eur = (centimos) => eurosDeCentimos(centimos).replace(/\u00a0/g, ' ');

vi.mock('../../../services/api', () => ({
  getReservasAdmin: vi.fn(),
  entregarReservaAdmin: vi.fn(),
  recogerReservaAdmin: vi.fn(),
  cancelarReservaAdmin: vi.fn(),
  bloquearFechasAdmin: vi.fn(),
  accionReservaAdmin: vi.fn()
}));

const DEVUELTA = {
  id: 'res-3',
  tipo: 'alquiler',
  estado: 'devuelta',
  fecha_inicio: '2026-10-20',
  fecha_fin: '2026-10-23',
  importe_total: 130,
  pieza: { nombre: 'Mesa Bistro', referencia: 'NAV-MES-002' },
  contacto: { nombre: 'Lucía Díaz', email: 'lucia@ejemplo.com' },
  fianza: { importe: 30, estado: 'garantizada', retenido: null, motivo_retencion: null },
  acciones: ['devolver-fianza']
};

const pintar = async (reserva = DEVUELTA) => {
  getReservasAdmin.mockResolvedValue({ data: { reservas: [reserva] } });
  const showToast = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast }}>
      <ReservasTab />
    </ToastContext.Provider>
  );
  await screen.findByText('Mesa Bistro');
  return { showToast };
};
const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Gestionar fianza' }));

describe('ReservasTab — Gestionar fianza (R-e)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('una devuelta con la fianza por resolver: el botón y el estado de la fianza', async () => {
    await pintar();
    expect(screen.getByRole('button', { name: 'Gestionar fianza' })).toBeInTheDocument();
    expect(screen.getByText('Fianza por resolver')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizada' })).not.toBeInTheDocument();
  });

  it('una devuelta con la fianza ya resuelta: «Finalizada» y cómo quedó', async () => {
    await pintar({ ...DEVUELTA, fianza: { ...DEVUELTA.fianza, estado: 'cobrada_parcial' }, acciones: [] });
    expect(screen.getByRole('button', { name: 'Finalizada' })).toBeDisabled();
    expect(screen.getByText('Fianza devuelta en parte')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gestionar fianza' })).not.toBeInTheDocument();
  });

  it('devolverla entera: manda retener 0 y avisa', async () => {
    accionReservaAdmin.mockResolvedValue({ data: { reserva: { ...DEVUELTA, acciones: [] } } });
    const { showToast } = await pintar();
    abrir();
    expect(screen.getByRole('dialog', { name: 'Gestionar fianza' })).toBeInTheDocument();
    expect(screen.getByText(`Se devolverán ${eur(3000)} a la tarjeta del cliente.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Devolver ${eurosDeCentimos(3000)}` }));
    await waitFor(() =>
      expect(accionReservaAdmin).toHaveBeenCalledWith('res-3', 'devolver-fianza', { retener_centimos: 0 })
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Fianza resuelta. Le hemos enviado un correo al cliente.', 'success')
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('retener una parte: importe y motivo, y el botón dice lo que se devuelve', async () => {
    accionReservaAdmin.mockResolvedValue({ data: { reserva: DEVUELTA } });
    await pintar();
    abrir();
    fireEvent.click(screen.getByLabelText('Retener una parte (daños, retraso…)'));
    fireEvent.change(screen.getByLabelText('Importe que se retiene (€):'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText('Motivo (lo verá el cliente en el correo):'), {
      target: { value: '  Arañazo en la pata  ' }
    });
    fireEvent.click(screen.getByRole('button', { name: `Devolver ${eurosDeCentimos(1750)}` }));
    await waitFor(() =>
      expect(accionReservaAdmin).toHaveBeenCalledWith('res-3', 'devolver-fianza', {
        retener_centimos: 1250,
        motivo_retencion: 'Arañazo en la pata'
      })
    );
  });

  it('retenerla entera: el botón lo dice', async () => {
    await pintar();
    abrir();
    fireEvent.click(screen.getByLabelText('Retener una parte (daños, retraso…)'));
    fireEvent.change(screen.getByLabelText('Importe que se retiene (€):'), { target: { value: '30' } });
    expect(screen.getByText('No se devuelve nada: se retiene la fianza entera.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retener la fianza entera' })).toBeInTheDocument();
  });

  it('sin motivo, sin importe o con más que la fianza: no se manda nada y dice por qué', async () => {
    await pintar();
    abrir();
    fireEvent.click(screen.getByLabelText('Retener una parte (daños, retraso…)'));
    const confirmar = () => fireEvent.click(screen.getByRole('button', { name: /^Devolver|^Retener la fianza/ }));

    confirmar();
    expect(screen.getByRole('alert')).toHaveTextContent('Indica cuánto retienes, o elige devolver la fianza entera.');

    fireEvent.change(screen.getByLabelText('Importe que se retiene (€):'), { target: { value: '31' } });
    confirmar();
    expect(screen.getByRole('alert')).toHaveTextContent(`No se puede retener más que la fianza (${eur(3000)}).`);

    fireEvent.change(screen.getByLabelText('Importe que se retiene (€):'), { target: { value: '5' } });
    confirmar();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el motivo por el que retienes parte de la fianza.');
    expect(accionReservaAdmin).not.toHaveBeenCalled();
  });

  it('si el servidor responde con error, se ve en el modal, que sigue abierto', async () => {
    accionReservaAdmin.mockResolvedValue({ error: 'La devolución de la fianza no se ha podido hacer.', codigo: 'reembolso_a_medias' });
    await pintar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: `Devolver ${eurosDeCentimos(3000)}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La devolución de la fianza no se ha podido hacer.');
    expect(screen.getByRole('dialog', { name: 'Gestionar fianza' })).toBeInTheDocument();
    // A medias: la lista se recarga para enseñar cómo ha quedado.
    expect(getReservasAdmin).toHaveBeenCalledTimes(2);
  });

  it('una fianza a medias: sin elegir de nuevo, «Terminar la devolución» con un cuerpo vacío', async () => {
    accionReservaAdmin.mockResolvedValue({ data: { reserva: DEVUELTA } });
    await pintar({
      ...DEVUELTA,
      fianza: { importe: 30, estado: 'en_resolucion', retenido: 10, motivo_retencion: 'Mancha' }
    });
    expect(screen.getByText('Fianza a medias')).toBeInTheDocument();
    abrir();
    expect(screen.getByText(/La devolución se quedó a medias/)).toHaveTextContent(`(retener ${eur(1000)})`);
    expect(screen.queryByLabelText('Retener una parte (daños, retraso…)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminar la devolución' }));
    await waitFor(() => expect(accionReservaAdmin).toHaveBeenCalledWith('res-3', 'devolver-fianza', {}));
  });

  it('«Volver» cierra el modal sin mandar nada', async () => {
    await pintar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(accionReservaAdmin).not.toHaveBeenCalled();
  });
});
