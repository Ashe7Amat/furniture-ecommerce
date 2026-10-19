import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutExito from './CheckoutExito';
import { CartContext } from '../context/CartContext';
import { confirmarSesionPago } from '../services/api';
// Reservas por fechas (al final del archivo)
import { afterEach } from 'vitest';

vi.mock('../services/api');

// La página a la que vuelve Stripe tras pagar: /checkout/exito?session_id=cs_...
const abrir = (ruta = '/checkout/exito?session_id=cs_test_1', { estricto = false } = {}) => {
  const emptyCart = vi.fn();
  const pagina = (
    <MemoryRouter initialEntries={[ruta]}>
      <CartContext.Provider value={{ emptyCart }}>
        <CheckoutExito />
      </CartContext.Provider>
    </MemoryRouter>
  );
  render(estricto ? <StrictMode>{pagina}</StrictMode> : pagina);
  return { emptyCart };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('CheckoutExito', () => {
  it('mientras confirma con el servidor, lo dice', () => {
    confirmarSesionPago.mockReturnValue(new Promise(() => {}));
    abrir();

    expect(screen.getByRole('heading', { name: 'Confirmando tu pago...' })).toBeInTheDocument();
    expect(confirmarSesionPago).toHaveBeenCalledWith('cs_test_1');
  });

  it('si el servidor confirma el pago, vacía la cesta y enseña el pedido confirmado', async () => {
    confirmarSesionPago.mockResolvedValue({ success: true });
    const { emptyCart } = abrir();

    expect(await screen.findByRole('heading', { name: '¡Pedido confirmado con éxito!' })).toBeInTheDocument();
    expect(emptyCart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Volver a la tienda' })).toHaveAttribute('href', '/catalogo');
  });

  it('si el servidor no lo confirma, enseña su motivo y NO vacía la cesta', async () => {
    confirmarSesionPago.mockResolvedValue({ error: 'El pago todavía no se ha completado.' });
    const { emptyCart } = abrir();

    expect(await screen.findByRole('heading', { name: 'No hemos podido confirmar el pago' })).toBeInTheDocument();
    expect(screen.getByText('El pago todavía no se ha completado.')).toBeInTheDocument();
    expect(emptyCart).not.toHaveBeenCalled();
  });

  it('sin motivo en la respuesta, un mensaje por defecto', async () => {
    confirmarSesionPago.mockResolvedValue(null);
    abrir();

    expect(await screen.findByText('No se pudo confirmar el pago.')).toBeInTheDocument();
  });

  it('sin session_id en la URL no pregunta al servidor y dice que falta', () => {
    abrir('/checkout/exito');

    expect(screen.getByRole('heading', { name: 'No hemos podido confirmar el pago' })).toBeInTheDocument();
    expect(screen.getByText('Falta el identificador del pago.')).toBeInTheDocument();
    expect(confirmarSesionPago).not.toHaveBeenCalled();
  });

  it('en StrictMode (que monta dos veces en desarrollo) confirma una sola vez', async () => {
    confirmarSesionPago.mockResolvedValue({ success: true });
    abrir(undefined, { estricto: true });

    await act(async () => {});
    expect(confirmarSesionPago).toHaveBeenCalledTimes(1);
  });
});

// Reservas por fechas (docs/reservas-diseno.md, 6.4): confirmar-sesion responde con tipo 'reserva' y
// el estado en que ha quedado. Una reserva no pasa por la cesta, así que no se vacía.
describe('CheckoutExito — vuelta del pago de una reserva', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const reserva = (estado, message) => ({ success: true, tipo: 'reserva', estado, message, total: 130 });

  it('confirmada: "Reserva confirmada" con el mensaje del servidor, sin vaciar la cesta', async () => {
    confirmarSesionPago.mockResolvedValue(reserva('confirmada', 'Te hemos enviado un email con los detalles.'));
    const { emptyCart } = abrir();

    expect(await screen.findByRole('heading', { name: 'Reserva confirmada' })).toBeInTheDocument();
    expect(screen.getByText('Te hemos enviado un email con los detalles.')).toBeInTheDocument();
    expect(document.querySelector('.success-icon')).toBeInTheDocument();
    expect(emptyCart).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Volver a la tienda' })).toHaveAttribute('href', '/catalogo');
  });

  it('conflicto: las fechas ya no estaban libres y se devolverá el importe (mensaje del servidor)', async () => {
    confirmarSesionPago.mockResolvedValue(
      reserva('conflicto', 'Esas fechas se reservaron mientras pagabas. Te devolveremos los 130,00 €.')
    );
    const { emptyCart } = abrir();

    expect(await screen.findByRole('heading', { name: 'Esas fechas ya no estaban libres' })).toBeInTheDocument();
    expect(screen.getByText('Esas fechas se reservaron mientras pagabas. Te devolveremos los 130,00 €.')).toBeInTheDocument();
    expect(document.querySelector('.error-icon')).toBeInTheDocument();
    expect(emptyCart).not.toHaveBeenCalled();
  });

  it('procesando: "Pago recibido" con el mensaje del servidor', async () => {
    confirmarSesionPago.mockResolvedValue(reserva('procesando', 'Estamos confirmando tu reserva.'));
    abrir();

    expect(await screen.findByRole('heading', { name: 'Pago recibido' })).toBeInTheDocument();
    expect(screen.getByText('Estamos confirmando tu reserva.')).toBeInTheDocument();
  });

  it.each([
    ['confirmada', 'Reserva confirmada', 'Te llegará un email con las fechas y el desglose.'],
    ['conflicto', 'Esas fechas ya no estaban libres', 'Se ocuparon mientras pagabas. Te devolveremos el importe y te escribiremos por email.'],
    ['procesando', 'Pago recibido', 'Estamos confirmando tu reserva. Te escribiremos por email en cuanto esté lista.'],
    ['desconocido', 'Pago recibido', 'Estamos confirmando tu reserva. Te escribiremos por email en cuanto esté lista.']
  ])('%s sin mensaje del servidor: "%s" y un texto de respaldo', async (estado, titulo, respaldo) => {
    confirmarSesionPago.mockResolvedValue(reserva(estado, undefined));
    abrir();

    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument();
    expect(screen.getByText(respaldo)).toBeInTheDocument();
  });

  it('con el interruptor encendido, también "Ver mis reservas", que abre esa pestaña de Mi cuenta', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    confirmarSesionPago.mockResolvedValue(reserva('confirmada', 'Listo.'));
    abrir();

    expect(await screen.findByRole('link', { name: 'Ver mis reservas' })).toHaveAttribute('href', '/cuenta?tab=reservas');
  });

  it('con el interruptor apagado no enlaza a "Mis reservas" (esa pestaña no existe)', async () => {
    confirmarSesionPago.mockResolvedValue(reserva('confirmada', 'Listo.'));
    abrir();

    await screen.findByRole('heading', { name: 'Reserva confirmada' });
    expect(screen.queryByRole('link', { name: 'Ver mis reservas' })).not.toBeInTheDocument();
  });
});

// El administrador canceló la reserva después de que se pagara: confirmar-sesion responde con
// estado 'cancelada' y el mensaje del servidor dice qué pasa con el importe.
describe('CheckoutExito — reserva cancelada después del pago', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const cancelada = (message) => ({ success: true, tipo: 'reserva', estado: 'cancelada', message, total: 130 });

  it('"Reserva cancelada" con el mensaje del servidor, icono de aviso y sin vaciar la cesta', async () => {
    confirmarSesionPago.mockResolvedValue(
      cancelada('Esta reserva se canceló después del pago. Te devolveremos los 130,00 €.')
    );
    const { emptyCart } = abrir();

    expect(await screen.findByRole('heading', { name: 'Reserva cancelada' })).toBeInTheDocument();
    expect(screen.getByText('Esta reserva se canceló después del pago. Te devolveremos los 130,00 €.')).toBeInTheDocument();
    expect(document.querySelector('.error-icon')).toBeInTheDocument();
    expect(document.querySelector('.success-icon')).not.toBeInTheDocument();
    expect(emptyCart).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Pago recibido' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la tienda' })).toHaveAttribute('href', '/catalogo');
  });

  it('sin mensaje del servidor, un texto de respaldo', async () => {
    confirmarSesionPago.mockResolvedValue(cancelada(undefined));
    abrir();

    expect(await screen.findByRole('heading', { name: 'Reserva cancelada' })).toBeInTheDocument();
    expect(screen.getByText('Esta reserva se ha cancelado. Te escribiremos por email con los detalles.')).toBeInTheDocument();
  });

  it('con el interruptor encendido, enlaza a "Ver mis reservas"', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    confirmarSesionPago.mockResolvedValue(cancelada('Cancelada.'));
    abrir();

    expect(await screen.findByRole('link', { name: 'Ver mis reservas' })).toHaveAttribute('href', '/cuenta?tab=reservas');
  });
});

// Con los textos que manda el servidor de verdad: el título no se repite en el mensaje, y el título recibe
// el foco al llegar el resultado (sustituye a "Confirmando tu pago...").
describe('CheckoutExito — textos reales del servidor y foco', () => {
  it.each([
    ['confirmada', 'Reserva confirmada', 'Te hemos enviado los detalles por email.'],
    [
      'conflicto',
      'Esas fechas ya no estaban libres',
      'Hemos recibido tu pago, pero se ocuparon mientras pagabas. Te devolveremos el importe y te escribiremos por email.'
    ],
    ['procesando', 'Pago recibido', 'Estamos confirmando tu reserva y te llegará un email en cuanto esté.'],
    ['cancelada', 'Reserva cancelada', 'Esta reserva está cancelada. Si tienes cualquier duda, escríbenos.']
  ])('%s: «%s» una sola vez', async (estado, titulo, mensaje) => {
    confirmarSesionPago.mockResolvedValue({ success: true, tipo: 'reserva', estado, message: mensaje, total: 75 });
    abrir();

    const encabezado = await screen.findByRole('heading', { name: titulo });
    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(screen.getAllByText((contenido) => contenido.includes(titulo))).toHaveLength(1);
    expect(encabezado).toHaveFocus();
  });

  it('la compra normal no mueve el foco', async () => {
    confirmarSesionPago.mockResolvedValue({ success: true });
    abrir();

    const encabezado = await screen.findByRole('heading', { name: '¡Pedido confirmado con éxito!' });
    expect(encabezado).not.toHaveFocus();
  });
});
