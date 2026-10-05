import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { ToastContext } from './ToastContext';
import { PLACEHOLDER_IMG } from '../utils/images';
import { getMuebleById } from '../services/api';

export const CartContext = createContext();

const PIEZA_UNICA = 'Lo sentimos, esta es una pieza única restaurada y solo hay 1 unidad disponible.';

// Fase C (C4): una línea de la cesta sin precio. Pasa con los precios ocultos (MOSTRAR_PRECIOS):
// una cesta guardada de antes se queda sin precio al comprobarla (validateCart), y no se puede
// pagar hasta quitarla (el servidor también lo rechaza: crear-sesion-pago responde 403).
export const lineaSinPrecio = (item) => !(Number(item.precio) > 0);
export const SIN_PRECIO_EN_CESTA =
  'Hay piezas sin precio en tu cesta. Quítalas para pagar, o pregúntanos por ellas en la página de contacto.';
// H35: el mismo tope que el servidor (MAX_PIEZAS_CARRITO en server/src/schemas/muebles.js), que
// rechaza los pedidos de más piezas.
export const MAX_PIEZAS_CESTA = 20;
export const CESTA_LLENA = `Tu cesta ya tiene ${MAX_PIEZAS_CESTA} piezas, el máximo por pedido. Termina este pedido o quita alguna pieza para añadir otra.`;
const precioDe = (producto, modalidad) => (modalidad === 'compra' ? producto.precio_venta : producto.precio_alquiler_dia);

export const CartProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const storageKey = user ? `kaveCart_${user.email}` : 'kaveCart_guest';

  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setCartItems(saved ? JSON.parse(saved) : []);
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cartItems));
  }, [cartItems, storageKey]);

  // Qué aviso sale se decide con la cesta de este render, no dentro de la función que se pasa a
  // setCartItems (H25): React no siempre ejecuta esa función al momento, y un aviso decidido ahí
  // dentro salía mal. Añadir por segunda vez una pieza decía "Producto añadido a la cesta." y abría
  // la cesta, y el "+" de una línea no avisaba de nada. La función de setCartItems vuelve a
  // comprobarlo por si llegaran dos clics antes de volver a pintar.
  const addToCart = (product, modality) => {
    const estaEnLaCesta = (items) => items.some(item => item.productId === product.id && item.modalidad === modality);
    // C4: sin precio para esa modalidad no se añade (no debería llegar aquí: sin precios, la web
    // enseña "Preguntar por esta pieza" en vez del botón de la cesta).
    if (!(Number(precioDe(product, modality)) > 0)) {
      showToast('Esta pieza no tiene precio a la vista. Pregúntanos por ella en la página de contacto.', 'warning');
      return;
    }
    if (estaEnLaCesta(cartItems)) {
      showToast(PIEZA_UNICA, 'warning');
      return;
    }
    if (cartItems.length >= MAX_PIEZAS_CESTA) {
      showToast(CESTA_LLENA, 'warning');
      return;
    }

    const newItem = {
      id: `${product.id}-${modality}`,
      productId: product.id,
      nombre: product.nombre,
      imagen: product.imagenes && product.imagenes.length > 0 ? product.imagenes[0] : PLACEHOLDER_IMG,
      precio: precioDe(product, modality),
      modalidad: modality,
      cantidad: 1
    };
    setCartItems(prev => (estaEnLaCesta(prev) || prev.length >= MAX_PIEZAS_CESTA ? prev : [...prev, newItem]));
    showToast('Producto añadido a la cesta.', 'success');
    setIsCartOpen(true);
  };

  const removeFromCart = (idToRemove) => {
    setCartItems(prev => prev.filter(item => item.id !== idToRemove));
  };

  // Igual que en addToCart (H25): el aviso de "pieza única" se decide con la cesta de este render.
  const updateQuantity = (id, delta) => {
    if (!cartItems.some(item => item.id === id)) return;
    if (delta > 0) {
      showToast(PIEZA_UNICA, 'warning');
      return;
    }

    setCartItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (!existing) return prev;
      if ((existing.cantidad || 1) + delta <= 0) {
        return prev.filter(item => item.id !== id);
      }
      return prev.map(item =>
        item.id === id ? { ...item, cantidad: (item.cantidad || 1) + delta } : item
      );
    });
  };

  const emptyCart = () => {
    setCartItems([]);
  };

  const toggleCart = () => {
    setIsCartOpen(!isCartOpen);
  };

  // Comprueba que cada pieza de la cesta sigue existiendo y disponible en el catálogo
  // (puede haberse vendido o eliminado desde que se añadió, sobre todo si la cesta llevaba
  // tiempo guardada en el navegador). Quita en silencio las que ya no valen y avisa con un
  // toast claro, para que el cliente nunca llegue a Stripe con un carrito roto.
  const validateCart = async () => {
    if (cartItems.length === 0) return true;

    try {
      const productos = await Promise.all(
        cartItems.map(item => getMuebleById(item.productId))
      );

      // Se quitan las vendidas y las que ya no existen. Las demás se quedan con el precio que da hoy
      // el catálogo (C4): con los precios ocultos llega null, y la línea pasa a "Consultar precio".
      // Si la respuesta no trae el campo, el precio guardado se deja como estaba.
      const piezasCaidas = [];
      let preciosCambiados = false;
      const itemsValidos = [];
      cartItems.forEach((item, i) => {
        const producto = productos[i];
        if (!producto || producto.estado === 'vendido') {
          piezasCaidas.push(item.nombre);
          return;
        }
        const actual = precioDe(producto, item.modalidad);
        if (actual === undefined || actual === item.precio) {
          itemsValidos.push(item);
          return;
        }
        preciosCambiados = true;
        itemsValidos.push({ ...item, precio: actual });
      });

      if (piezasCaidas.length > 0 || preciosCambiados) setCartItems(itemsValidos);

      if (piezasCaidas.length > 0) {
        showToast(
          `Hemos quitado de tu cesta ${piezasCaidas.length === 1 ? 'una pieza que ya' : 'algunas piezas que ya'} no ${piezasCaidas.length === 1 ? 'está disponible' : 'están disponibles'} (${piezasCaidas.join(', ')}).`,
          'warning'
        );
        return false;
      }

      return true;
    } catch (error) {
      // Si falla la comprobación por red, no bloqueamos al cliente: dejamos que el
      // servidor haga su propia validación al crear la sesión de pago.
      console.error('Error validando la cesta:', error);
      return true;
    }
  };

  // C4: las líneas sin precio no suman (antes, un precio null contaba como 0 sin decir nada).
  const cartTotal = cartItems.reduce((acc, item) => acc + (lineaSinPrecio(item) ? 0 : item.precio * (item.cantidad || 1)), 0);
  const hayLineasSinPrecio = cartItems.some(lineaSinPrecio);
  const cestaLlena = cartItems.length >= MAX_PIEZAS_CESTA;

  return (
    <CartContext.Provider value={{
      cartItems, addToCart, removeFromCart, updateQuantity, emptyCart,
      isCartOpen, toggleCart, setIsCartOpen, cartTotal, validateCart, hayLineasSinPrecio, cestaLlena
    }}>
      {children}
    </CartContext.Provider>
  );
};
