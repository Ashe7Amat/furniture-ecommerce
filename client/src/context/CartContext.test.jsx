import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContext } from 'react';
import { CartProvider, CartContext, lineaSinPrecio } from './CartContext';
import { AuthContext } from './AuthContext';
import { ToastContext } from './ToastContext';
import { getMuebleById } from '../services/api';
import { PLACEHOLDER_IMG } from '../utils/images';

vi.mock('../services/api');

const SILLA = { id: 'm1', nombre: 'Silla Tolix', precio_venta: 120, precio_alquiler_dia: 8, imagenes: ['https://img.test/silla.jpg'] };
const MESA = { id: 'm2', nombre: 'Mesa de roble', precio_venta: 450, precio_alquiler_dia: 20, imagenes: [] };
const UNIDAD_UNICA = 'Lo sentimos, esta es una pieza única restaurada y solo hay 1 unidad disponible.';

// La cesta depende de la sesión (una por usuario) y de los avisos: los dos contextos se simulan.
const montar = ({ user = null } = {}) => {
  const showToast = vi.fn();
  let sesion = { user };
  const wrapper = ({ children }) => (
    <AuthContext.Provider value={sesion}>
      <ToastContext.Provider value={{ showToast }}>
        <CartProvider>{children}</CartProvider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
  const utils = renderHook(() => useContext(CartContext), { wrapper });
  const cambiarUsuario = (nuevo) => {
    sesion = { user: nuevo };
    utils.rerender();
  };
  return { ...utils, showToast, cambiarUsuario };
};

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('CartContext — añadir', () => {
  it('añadir para comprar guarda la pieza con el precio de venta y su primera foto, avisa y abre la cesta', () => {
    const { result, showToast } = montar();

    act(() => result.current.addToCart(SILLA, 'compra'));

    expect(result.current.cartItems).toEqual([
      { id: 'm1-compra', productId: 'm1', nombre: 'Silla Tolix', imagen: 'https://img.test/silla.jpg', precio: 120, modalidad: 'compra', cantidad: 1 },
    ]);
    expect(showToast).toHaveBeenCalledWith('Producto añadido a la cesta.', 'success');
    expect(result.current.isCartOpen).toBe(true);
  });

  it('para alquilar usa el precio por día; sin fotos, la imagen genérica', () => {
    const { result } = montar();

    act(() => result.current.addToCart(MESA, 'alquiler'));

    expect(result.current.cartItems[0]).toMatchObject({ id: 'm2-alquiler', precio: 20, imagen: PLACEHOLDER_IMG });
  });

  it('la misma pieza en la misma modalidad no se añade dos veces: son piezas únicas', () => {
    const { result, showToast } = montar();

    act(() => result.current.addToCart(SILLA, 'compra'));
    act(() => result.current.addToCart(SILLA, 'compra'));

    expect(result.current.cartItems).toHaveLength(1);
    expect(showToast).toHaveBeenLastCalledWith(UNIDAD_UNICA, 'warning');
  });

  it('la misma pieza para comprar y para alquilar son dos líneas distintas', () => {
    const { result } = montar();

    act(() => result.current.addToCart(SILLA, 'compra'));
    act(() => result.current.addToCart(SILLA, 'alquiler'));

    expect(result.current.cartItems.map((i) => i.id)).toEqual(['m1-compra', 'm1-alquiler']);
  });
});

describe('CartContext — cambiar y quitar', () => {
  it('quitar una línea deja las demás', () => {
    const { result } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));
    act(() => result.current.addToCart(MESA, 'compra'));

    act(() => result.current.removeFromCart('m1-compra'));

    expect(result.current.cartItems.map((i) => i.id)).toEqual(['m2-compra']);
  });

  it('subir la cantidad no se deja (pieza única) y avisa', () => {
    const { result, showToast } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));

    act(() => result.current.updateQuantity('m1-compra', 1));

    expect(result.current.cartItems[0].cantidad).toBe(1);
    expect(showToast).toHaveBeenLastCalledWith(UNIDAD_UNICA, 'warning');
  });

  it('bajar la cantidad de 1 a 0 quita la línea', () => {
    const { result } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));

    act(() => result.current.updateQuantity('m1-compra', -1));

    expect(result.current.cartItems).toEqual([]);
  });

  it('con una cantidad guardada mayor que 1 (cestas antiguas), bajar resta uno', () => {
    localStorage.setItem('kaveCart_guest', JSON.stringify([{ id: 'm1-compra', productId: 'm1', nombre: 'Silla', precio: 10, modalidad: 'compra', cantidad: 3 }]));
    const { result } = montar();

    act(() => result.current.updateQuantity('m1-compra', -1));

    expect(result.current.cartItems[0].cantidad).toBe(2);
  });

  it('cambiar la cantidad de una línea que no existe no hace nada', () => {
    const { result, showToast } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));
    showToast.mockClear();

    act(() => result.current.updateQuantity('no-existe', 1));

    expect(result.current.cartItems).toHaveLength(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('vaciar la cesta, abrirla y cerrarla', () => {
    const { result } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));

    act(() => result.current.emptyCart());
    expect(result.current.cartItems).toEqual([]);

    act(() => result.current.toggleCart());
    expect(result.current.isCartOpen).toBe(false); // addToCart la había abierto
    act(() => result.current.toggleCart());
    expect(result.current.isCartOpen).toBe(true);
    act(() => result.current.setIsCartOpen(false));
    expect(result.current.isCartOpen).toBe(false);
  });

  it('el total suma precio por cantidad de cada línea', () => {
    localStorage.setItem('kaveCart_guest', JSON.stringify([
      { id: 'a', productId: 'a', precio: 100, cantidad: 2 },
      { id: 'b', productId: 'b', precio: 20 }, // sin cantidad cuenta como 1
    ]));
    const { result } = montar();

    expect(result.current.cartTotal).toBe(220);
  });
});

describe('CartContext — se guarda en el navegador, una cesta por usuario', () => {
  it('sin sesión, la cesta se guarda como la del invitado y se recupera al volver', () => {
    const { result, unmount } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));
    unmount();

    expect(JSON.parse(localStorage.getItem('kaveCart_guest'))).toHaveLength(1);
    expect(montar().result.current.cartItems.map((i) => i.id)).toEqual(['m1-compra']);
  });

  it('con sesión, cada usuario tiene su cesta; al cambiar de usuario se carga la suya', () => {
    localStorage.setItem('kaveCart_ana@nave5.test', JSON.stringify([{ id: 'm2-compra', productId: 'm2', precio: 450 }]));
    const { result, cambiarUsuario } = montar({ user: { email: 'luis@nave5.test' } });
    act(() => result.current.addToCart(SILLA, 'compra'));

    cambiarUsuario({ email: 'ana@nave5.test' });

    expect(result.current.cartItems.map((i) => i.id)).toEqual(['m2-compra']);
    expect(JSON.parse(localStorage.getItem('kaveCart_luis@nave5.test')).map((i) => i.id)).toEqual(['m1-compra']);
  });
});

describe('CartContext — validateCart, antes de pagar', () => {
  const cestaCon = (...piezas) => {
    localStorage.setItem('kaveCart_guest', JSON.stringify(piezas.map((p) => ({ id: `${p.id}-compra`, productId: p.id, nombre: p.nombre, precio: 1 }))));
    return montar();
  };

  it('con la cesta vacía no pregunta nada y deja pagar', async () => {
    const { result } = montar();
    expect(await result.current.validateCart()).toBe(true);
    expect(getMuebleById).not.toHaveBeenCalled();
  });

  it('si todas siguen disponibles, deja pagar sin tocar la cesta', async () => {
    getMuebleById.mockImplementation(async (id) => ({ id, estado: 'disponible' }));
    const { result, showToast } = cestaCon(SILLA, MESA);

    let valida;
    await act(async () => { valida = await result.current.validateCart(); });

    expect(valida).toBe(true);
    expect(result.current.cartItems).toHaveLength(2);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('quita las vendidas y las que ya no existen, avisa con sus nombres y no deja pagar', async () => {
    const { result, showToast } = cestaCon(SILLA, MESA, { id: 'm3', nombre: 'Lámpara' });
    getMuebleById.mockImplementation(async (id) => {
      if (id === 'm1') return { id, estado: 'vendido' };
      if (id === 'm2') return null; // borrada del catálogo
      return { id, estado: 'alquilado' }; // hoy solo se quitan las vendidas: una alquilada se queda (ver H7)
    });

    let valida;
    await act(async () => { valida = await result.current.validateCart(); });

    expect(valida).toBe(false);
    expect(result.current.cartItems.map((i) => i.productId)).toEqual(['m3']);
    expect(showToast).toHaveBeenCalledWith(
      'Hemos quitado de tu cesta algunas piezas que ya no están disponibles (Silla Tolix, Mesa de roble).',
      'warning'
    );
  });

  it('con una sola pieza caída, el aviso va en singular', async () => {
    getMuebleById.mockResolvedValue({ estado: 'vendido' });
    const { result, showToast } = cestaCon(SILLA);

    await act(async () => { await result.current.validateCart(); });

    expect(showToast).toHaveBeenCalledWith(
      'Hemos quitado de tu cesta una pieza que ya no está disponible (Silla Tolix).',
      'warning'
    );
  });

  it('si la comprobación falla por la red, no bloquea: deja pagar y ya valida el servidor', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getMuebleById.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = cestaCon(SILLA);

    expect(await result.current.validateCart()).toBe(true);
    expect(result.current.cartItems).toHaveLength(1);
  });
});

// Fase C (C4): con los precios ocultos (MOSTRAR_PRECIOS), una línea puede quedarse sin precio.
describe('CartContext — líneas sin precio (fase C)', () => {
  it('lineaSinPrecio: sin precio, null, 0 o un texto que no es número', () => {
    expect(lineaSinPrecio({ precio: 120 })).toBe(false);
    expect(lineaSinPrecio({ precio: '120' })).toBe(false);
    for (const precio of [null, undefined, 0, 'abc']) expect(lineaSinPrecio({ precio })).toBe(true);
  });

  it('una pieza sin precio para esa modalidad no se añade, y avisa', () => {
    const { result, showToast } = montar();
    act(() => result.current.addToCart({ ...SILLA, precio_venta: null, precio_alquiler_dia: null }, 'compra'));
    act(() => result.current.addToCart({ ...MESA, precio_alquiler_dia: null }, 'alquiler'));

    expect(result.current.cartItems).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('Esta pieza no tiene precio a la vista. Pregúntanos por ella en la página de contacto.', 'warning');
    expect(result.current.isCartOpen).toBe(false);
  });

  it('las líneas sin precio no suman al total, y hayLineasSinPrecio lo dice', () => {
    localStorage.setItem('kaveCart_guest', JSON.stringify([
      { id: 'm1-compra', productId: 'm1', nombre: 'Silla Tolix', precio: 120, cantidad: 1 },
      { id: 'm2-compra', productId: 'm2', nombre: 'Mesa de roble', precio: null, cantidad: 1 }
    ]));
    const { result } = montar();
    expect(result.current.cartTotal).toBe(120);
    expect(result.current.hayLineasSinPrecio).toBe(true);
  });

  it('sin líneas sin precio, hayLineasSinPrecio es false', () => {
    const { result } = montar();
    act(() => result.current.addToCart(SILLA, 'compra'));
    expect(result.current.hayLineasSinPrecio).toBe(false);
  });

  it('validateCart: si el catálogo ya no da precio (ocultos), la línea se queda sin él; no quita nada y deja seguir', async () => {
    localStorage.setItem('kaveCart_guest', JSON.stringify([
      { id: 'm1-compra', productId: 'm1', nombre: 'Silla Tolix', precio: 120, modalidad: 'compra', cantidad: 1 },
      { id: 'm2-alquiler', productId: 'm2', nombre: 'Mesa de roble', precio: 20, modalidad: 'alquiler', cantidad: 1 }
    ]));
    getMuebleById.mockImplementation(async (id) => ({ id, estado: 'disponible', precio_venta: null, precio_alquiler_dia: null }));
    const { result, showToast } = montar();

    let valida;
    await act(async () => { valida = await result.current.validateCart(); });

    expect(valida).toBe(true);
    expect(result.current.cartItems.map((i) => i.precio)).toEqual([null, null]);
    expect(result.current.cartTotal).toBe(0);
    expect(result.current.hayLineasSinPrecio).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('validateCart: si el precio ha cambiado, la línea se queda con el de hoy (el que cobraría el servidor)', async () => {
    localStorage.setItem('kaveCart_guest', JSON.stringify([
      { id: 'm1-compra', productId: 'm1', nombre: 'Silla Tolix', precio: 120, modalidad: 'compra', cantidad: 1 }
    ]));
    getMuebleById.mockResolvedValue({ id: 'm1', estado: 'disponible', precio_venta: 150, precio_alquiler_dia: 8 });
    const { result } = montar();

    await act(async () => { await result.current.validateCart(); });

    expect(result.current.cartItems[0].precio).toBe(150);
    expect(result.current.cartTotal).toBe(150);
  });
});
