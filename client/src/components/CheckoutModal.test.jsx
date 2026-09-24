import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutModal from './CheckoutModal';
import { CartContext } from '../context/CartContext';
import { crearSesionPago } from '../services/api';

// crearSesionPago llama a fetch contra la API real -- se mockea, igual que Stripe/Resend/
// Supabase en el servidor.
vi.mock('../services/api', () => ({
  crearSesionPago: vi.fn()
}));

const itemBase = (extra = {}) => ({
  id: 'silla-compra',
  productId: 'silla',
  nombre: 'Silla de roble',
  modalidad: 'compra',
  cantidad: 1,
  ...extra
});

const renderCheckout = ({
  isOpen = true,
  onClose = vi.fn(),
  cartItems = [itemBase()],
  cartTotal = 90,
  validateCart = vi.fn().mockResolvedValue(true)
} = {}) => {
  const utils = render(
    <CartContext.Provider value={{ cartItems, cartTotal, validateCart }}>
      <CheckoutModal isOpen={isOpen} onClose={onClose} />
    </CartContext.Provider>
  );
  return { ...utils, onClose, validateCart };
};

// Las etiquetas no usan htmlFor/id (son <label> hermanos del <input>, no envolventes), así
// que getByLabelText no las asocia -- y "Ciudad"/"Provincia" comparten placeholder ("Ej.
// Barcelona"), así que tampoco sirve getByPlaceholderText. Se localiza el <label> por su
// texto (único en cada caso) y se sube al .form-group que comparte con su campo.
const campoPor = (texto) => screen.getByText(texto).closest('.form-group').querySelector('input, textarea');

// Rellena el formulario de datos de entrega con valores válidos, para dejar el botón de
// pago habilitado sin repetir esto en cada test que necesite llegar hasta ahí.
const rellenarFormularioValido = async (user) => {
  await user.type(campoPor('Nombre y Apellidos'), 'Ana Martínez');
  await user.type(campoPor('Teléfono de Contacto'), '600123456');
  await user.type(campoPor('Correo Electrónico'), 'ana@example.com');
  await user.type(campoPor('Dirección de Envío (Calle, número, piso, puerta)'), 'Calle Mayor 15');
  await user.type(campoPor('Ciudad'), 'Barcelona');
  await user.type(campoPor('Código Postal'), '08001');
  await user.type(campoPor('Provincia'), 'Barcelona');
};

beforeEach(() => {
  crearSesionPago.mockReset();
});

describe('CheckoutModal — apertura', () => {
  it('con isOpen=false, no renderiza nada ni valida la cesta', () => {
    const { validateCart, container } = renderCheckout({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
    expect(validateCart).not.toHaveBeenCalled();
  });

  it('con isOpen=true, valida la cesta al abrir', () => {
    const { validateCart } = renderCheckout({ isOpen: true });
    expect(validateCart).toHaveBeenCalledTimes(1);
  });

  it('con la cesta vacía, el botón de pago lo indica y está deshabilitado', () => {
    renderCheckout({ cartItems: [], cartTotal: 0 });
    const boton = screen.getByRole('button', { name: 'Tu cesta está vacía' });
    expect(boton).toBeDisabled();
  });
});

describe('CheckoutModal — validación del formulario', () => {
  it('con el formulario vacío, el botón de pago está deshabilitado', () => {
    renderCheckout();
    expect(screen.getByRole('button', { name: /Pagar 90.00 €/ })).toBeDisabled();
  });

  it('un correo con formato inválido muestra un error al perder el foco', async () => {
    const user = userEvent.setup();
    renderCheckout();

    const campoEmail = campoPor('Correo Electrónico');
    await user.type(campoEmail, 'no-es-un-correo');
    await user.tab();

    expect(screen.getByText('El formato de correo no es válido.')).toBeInTheDocument();
  });

  it('el teléfono solo acepta dígitos, y exige 9 empezando por 6/7/8/9', async () => {
    const user = userEvent.setup();
    renderCheckout();

    const campoTelefono = campoPor('Teléfono de Contacto');
    await user.type(campoTelefono, 'abc123');
    expect(campoTelefono).toHaveValue('123');

    await user.type(campoTelefono, '45');
    await user.tab();
    expect(screen.getByText('Debe tener 9 dígitos.')).toBeInTheDocument();
  });

  it('el código postal exige exactamente 5 dígitos', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.type(campoPor('Código Postal'), '080');
    await user.tab();

    expect(screen.getByText('Debe tener 5 dígitos.')).toBeInTheDocument();
  });

  it('con todos los campos válidos, el botón de pago se habilita', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await rellenarFormularioValido(user);

    expect(screen.getByRole('button', { name: /Pagar 90.00 €/ })).not.toBeDisabled();
  });
});

describe('CheckoutModal — pestañas de pago', () => {
  it('Apple Pay y Bizum avisan de que aún no están disponibles', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole('button', { name: 'Apple Pay' }));
    expect(screen.getByText(/Apple Pay estará disponible/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bizum' }));
    expect(screen.getByText(/Bizum estará disponible/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tarjeta' }));
    expect(screen.getByRole('button', { name: /Pagar/ })).toBeInTheDocument();
  });
});

describe('CheckoutModal — pago con tarjeta', () => {
  it('si la cesta ya no es válida al pagar, avisa y no llama a crearSesionPago', async () => {
    const user = userEvent.setup();
    const validateCart = vi.fn().mockResolvedValue(true);
    renderCheckout({ validateCart }); // la llamada al abrir el modal usa el "true" por defecto

    await rellenarFormularioValido(user);
    validateCart.mockResolvedValueOnce(false); // la siguiente llamada será la del clic en "Pagar"
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(screen.getByText(/hemos quitado automáticamente/)).toBeInTheDocument();
    expect(crearSesionPago).not.toHaveBeenCalled();
  });

  it('con cesta válida, llama a crearSesionPago y redirige a la URL de Stripe recibida', async () => {
    // jsdom no implementa navegación de verdad (loguea "Not implemented: navigation" y no
    // actualiza location.href), así que se sustituye por un objeto plano y escribible.
    const locationOriginal = window.location;
    delete window.location;
    window.location = { href: '' };

    const user = userEvent.setup();
    crearSesionPago.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
    renderCheckout({ cartItems: [itemBase()], cartTotal: 90 });

    await rellenarFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(crearSesionPago).toHaveBeenCalledWith({
      items: [{ productId: 'silla', modalidad: 'compra' }],
      clienteInfo: expect.objectContaining({
        nombre: 'Ana Martínez',
        email: 'ana@example.com',
        telefono: '600123456',
        direccion: 'Calle Mayor 15, 08001 Barcelona (Barcelona)'
      })
    });
    expect(window.location.href).toBe('https://checkout.stripe.com/pay/abc');

    window.location = locationOriginal;
  });

  it('si el servidor rechaza el pago, muestra el motivo y vuelve a validar la cesta', async () => {
    const user = userEvent.setup();
    const validateCart = vi.fn().mockResolvedValue(true);
    crearSesionPago.mockResolvedValue({ error: 'Esa pieza ya no está disponible.' });
    renderCheckout({ validateCart, cartItems: [itemBase()], cartTotal: 90 });
    validateCart.mockClear();

    await rellenarFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(await screen.findByText('Esa pieza ya no está disponible.')).toBeInTheDocument();
    // 1 al pulsar "Pagar" (cesta ok) + 1 al volver a comprobarla tras el rechazo del servidor
    expect(validateCart).toHaveBeenCalledTimes(2);
  });
});
