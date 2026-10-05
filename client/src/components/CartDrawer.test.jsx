import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CartDrawer from './CartDrawer';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';

// CartDrawer monta siempre CheckoutModal y AuthModal (devuelven null si isOpen=false), que a
// su vez importan crearSesionPago/loginUser/registerUser de services/api -- se mockean para
// no depender de la API real ni de que esas importaciones disparen nada por accidente.
vi.mock('../services/api', () => ({
  crearSesionPago: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn()
}));

const MarcadorDeRuta = () => <span data-testid="ruta-actual">{useLocation().pathname}</span>;

const itemBase = (extra = {}) => ({
  id: 'silla-compra',
  productId: 'silla',
  nombre: 'Silla de roble',
  imagen: '/img/silla.jpg',
  precio: 90,
  modalidad: 'compra',
  cantidad: 1,
  ...extra
});

const renderDrawer = ({
  cartItems = [],
  toggleCart = vi.fn(),
  removeFromCart = vi.fn(),
  updateQuantity = vi.fn(),
  cartTotal = 0,
  validateCart = vi.fn().mockResolvedValue(true),
  isCartOpen = true,
  hayLineasSinPrecio = false,
  showToast = vi.fn(),
  user = { email: 'cliente@example.com', nombre: 'Cliente' }
} = {}) => {
  const utils = render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={{ user, login: vi.fn(), logout: vi.fn(), loading: false }}>
        <ToastContext.Provider value={{ showToast }}>
          <CartContext.Provider value={{ isCartOpen, toggleCart, cartItems, removeFromCart, updateQuantity, cartTotal, validateCart, hayLineasSinPrecio }}>
            <Routes>
              <Route path="*" element={<><CartDrawer /><MarcadorDeRuta /></>} />
            </Routes>
          </CartContext.Provider>
        </ToastContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return { ...utils, toggleCart, removeFromCart, updateQuantity, showToast, validateCart };
};

beforeEach(() => {
  localStorage.clear();
});

describe('CartDrawer — cesta vacía', () => {
  it('muestra el estado vacío y no el footer con el subtotal', () => {
    renderDrawer({ cartItems: [] });
    expect(screen.getByText('Tu cesta está vacía')).toBeInTheDocument();
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
  });

  it('"Explorar Colección" cierra la cesta y navega al catálogo', async () => {
    const user = userEvent.setup();
    const { toggleCart } = renderDrawer({ cartItems: [] });

    await user.click(screen.getByText('Explorar Colección'));

    expect(toggleCart).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ruta-actual')).toHaveTextContent('/catalogo');
  });
});

describe('CartDrawer — con productos', () => {
  it('muestra la cantidad de artículos en el título y los datos de cada uno', () => {
    renderDrawer({
      cartItems: [itemBase(), itemBase({ id: 'mesa-alquiler', nombre: 'Mesa de centro', modalidad: 'alquiler', precio: 15 })],
      cartTotal: 105
    });

    expect(screen.getByText('Tu Cesta (2)')).toBeInTheDocument();
    expect(screen.getByText('Silla de roble')).toBeInTheDocument();
    expect(screen.getByText('Mesa de centro')).toBeInTheDocument();
    expect(screen.getByText('Compra')).toBeInTheDocument();
    expect(screen.getByText('Alquiler')).toBeInTheDocument();
    expect(screen.getByText('105.00 €')).toBeInTheDocument();
  });

  it('al eliminar un artículo, llama a removeFromCart y avisa con un toast', async () => {
    const user = userEvent.setup();
    const { removeFromCart, showToast } = renderDrawer({ cartItems: [itemBase()], cartTotal: 90 });

    await user.click(screen.getByTitle('Eliminar artículo'));

    expect(removeFromCart).toHaveBeenCalledWith('silla-compra');
    expect(showToast).toHaveBeenCalledWith('Producto eliminado de la cesta', 'success');
  });

  it('al ser piezas únicas (cantidad=1), los dos botones de cantidad están deshabilitados', () => {
    renderDrawer({ cartItems: [itemBase({ cantidad: 1 })], cartTotal: 90 });

    expect(screen.getByRole('button', { name: '−' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
  });

  it('con cantidad > 1 (caso excepcional), "−" está habilitado y llama a updateQuantity', async () => {
    const user = userEvent.setup();
    const { updateQuantity } = renderDrawer({ cartItems: [itemBase({ cantidad: 2 })], cartTotal: 180 });

    const restar = screen.getByRole('button', { name: '−' });
    expect(restar).not.toBeDisabled();

    await user.click(restar);
    expect(updateQuantity).toHaveBeenCalledWith('silla-compra', -1);
  });
});

describe('CartDrawer — cupón de descuento', () => {
  it('un código válido aplica el 10% de descuento y muestra el precio original tachado', async () => {
    const user = userEvent.setup();
    const { showToast } = renderDrawer({ cartItems: [itemBase()], cartTotal: 100 });

    await user.type(screen.getByPlaceholderText('Código de descuento'), 'bienvenida10');
    await user.click(screen.getByText('Aplicar'));

    expect(showToast).toHaveBeenCalledWith('Cupón del 10% aplicado con éxito', 'success');
    expect(screen.getByText('100.00 €')).toBeInTheDocument();
    expect(screen.getByText('90.00 €')).toBeInTheDocument();
  });

  it('un código inválido no aplica descuento y avisa con un toast de error', async () => {
    const user = userEvent.setup();
    const { showToast } = renderDrawer({ cartItems: [itemBase()], cartTotal: 100 });

    await user.type(screen.getByPlaceholderText('Código de descuento'), 'CUALQUIERA');
    await user.click(screen.getByText('Aplicar'));

    expect(showToast).toHaveBeenCalledWith('Cupón inválido', 'error');
    expect(screen.getByText('100.00 €')).toBeInTheDocument();
  });
});

describe('CartDrawer — confirmar pedido', () => {
  it('sin usuario logueado, "Confirmar Pedido" abre el modal de inicio de sesión, no el de pago', async () => {
    const user = userEvent.setup();
    renderDrawer({ cartItems: [itemBase()], cartTotal: 90, user: null });

    await user.click(screen.getByText('Confirmar Pedido'));

    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    expect(screen.queryByText('Finalizar Pago')).not.toBeInTheDocument();
  });

  it('con usuario logueado, "Confirmar Pedido" abre el modal de pago directamente', async () => {
    const user = userEvent.setup();
    renderDrawer({ cartItems: [itemBase()], cartTotal: 90, user: { email: 'c@c.com', nombre: 'Cliente' } });

    await user.click(screen.getByText('Confirmar Pedido'));

    expect(screen.getByText('Finalizar Pago')).toBeInTheDocument();
    expect(screen.queryByText('Iniciar Sesión')).not.toBeInTheDocument();
  });
});

describe('CartDrawer — cierre y validación al abrir', () => {
  it('el botón de cerrar llama a toggleCart', async () => {
    const user = userEvent.setup();
    const { toggleCart } = renderDrawer({ cartItems: [itemBase()], cartTotal: 90 });

    await user.click(screen.getByLabelText('Cerrar cesta'));
    expect(toggleCart).toHaveBeenCalledTimes(1);
  });

  it('con la cesta abierta, valida las piezas al montar', () => {
    const { validateCart } = renderDrawer({ isCartOpen: true, cartItems: [itemBase()] });
    expect(validateCart).toHaveBeenCalledTimes(1);
  });

  it('con la cesta cerrada, no valida nada al montar', () => {
    const { validateCart } = renderDrawer({ isCartOpen: false, cartItems: [itemBase()] });
    expect(validateCart).not.toHaveBeenCalled();
  });
});

// Fase C (C4): con alguna línea sin precio (precios ocultos), no se puede pagar.
describe('CartDrawer — líneas sin precio (fase C)', () => {
  const mensaje = 'Hay piezas sin precio en tu cesta. Quítalas para pagar, o pregúntanos por ellas en la página de contacto.';

  it('la línea sin precio dice "Consultar precio", y "Confirmar Pedido" está desactivado con una explicación', () => {
    renderDrawer({ cartItems: [itemBase(), itemBase({ id: 'mesa-compra', productId: 'mesa', nombre: 'Mesa', precio: null })], cartTotal: 90, hayLineasSinPrecio: true });

    expect(screen.getByText('Consultar precio')).toHaveClass('cart-item-price-label');
    expect(screen.getByText('90 €')).toHaveClass('cart-item-price-label');
    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Pedido' })).toBeDisabled();
  });

  it('con todas las líneas con precio, ni aviso ni botón desactivado', () => {
    renderDrawer({ cartItems: [itemBase()], cartTotal: 90, hayLineasSinPrecio: false });
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Pedido' })).toBeEnabled();
  });
});

// Accesibilidad (auditoría del 5 oct 2026): cerrada, la cesta no se puede alcanzar con el teclado;
// abierta, es un diálogo con el foco en "Cerrar cesta" y se cierra con Escape.
describe('CartDrawer — accesibilidad', () => {
  it('cerrada, está oculta para los lectores de pantalla (aria-hidden)', () => {
    renderDrawer({ isCartOpen: false });
    expect(document.querySelector('.cart-drawer')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abierta, es un diálogo con nombre y el foco en "Cerrar cesta"', () => {
    renderDrawer({ cartItems: [] });
    expect(screen.getByRole('dialog', { name: 'Tu Cesta (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar cesta' })).toHaveFocus();
  });

  it('Escape la cierra; cerrada, Escape no hace nada', () => {
    const { toggleCart } = renderDrawer({ cartItems: [] });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggleCart).toHaveBeenCalledTimes(1);

    const cerrada = renderDrawer({ isCartOpen: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cerrada.toggleCart).not.toHaveBeenCalled();
  });

  it('al cerrarse, el foco vuelve a donde estaba antes de abrirla', () => {
    const boton = document.createElement('button');
    document.body.appendChild(boton);
    boton.focus();

    const { rerender } = renderDrawer({ cartItems: [] });
    expect(boton).not.toHaveFocus();
    rerender(<span />);

    expect(boton).toHaveFocus();
    boton.remove();
  });
});
