import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutExito from './CheckoutExito';
import { CartContext } from '../context/CartContext';
import { confirmarSesionPago } from '../services/api';

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
