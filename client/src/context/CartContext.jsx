import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { ToastContext } from './ToastContext';
import { PLACEHOLDER_IMG } from '../utils/images';
import { getMuebleById } from '../services/api';

export const CartContext = createContext();

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

  const addToCart = (product, modality) => {
    const price = modality === 'compra' ? product.precio_venta : product.precio_alquiler_dia;
    let alreadyExists = false;

    setCartItems(prev => {
      const existingItem = prev.find(item => item.productId === product.id && item.modalidad === modality);
      if (existingItem) {
        alreadyExists = true;
        return prev;
      } else {
        const newItem = {
          id: `${product.id}-${modality}`,
          productId: product.id,
          nombre: product.nombre,
          imagen: product.imagenes && product.imagenes.length > 0 ? product.imagenes[0] : PLACEHOLDER_IMG,
          precio: price,
          modalidad: modality,
          cantidad: 1
        };
        return [...prev, newItem];
      }
    });

    if (alreadyExists) {
      showToast('Lo sentimos, esta es una pieza única restaurada y solo hay 1 unidad disponible.', 'warning');
    } else {
      showToast('Producto añadido a la cesta.', 'success');
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (idToRemove) => {
    setCartItems(prev => prev.filter(item => item.id !== idToRemove));
  };

  const updateQuantity = (id, delta) => {
    let limitReached = false;

    setCartItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (!existing) return prev;
      
      if (delta > 0) {
        limitReached = true;
        return prev;
      }
      
      if ((existing.cantidad || 1) + delta <= 0) {
        return prev.filter(item => item.id !== id);
      }
      
      return prev.map(item => 
        item.id === id ? { ...item, cantidad: (item.cantidad || 1) + delta } : item
      );
    });

    if (limitReached) {
      showToast('Lo sentimos, esta es una pieza única restaurada y solo hay 1 unidad disponible.', 'warning');
    }
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

      const piezasCaidas = [];
      const itemsValidos = cartItems.filter((item, i) => {
        const producto = productos[i];
        const disponible = producto && producto.estado !== 'vendido';
        if (!disponible) piezasCaidas.push(item.nombre);
        return disponible;
      });

      if (piezasCaidas.length > 0) {
        setCartItems(itemsValidos);
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

  const cartTotal = cartItems.reduce((acc, item) => acc + (item.precio * (item.cantidad || 1)), 0);

  return (
    <CartContext.Provider value={{
      cartItems, addToCart, removeFromCart, updateQuantity, emptyCart,
      isCartOpen, toggleCart, setIsCartOpen, cartTotal, validateCart
    }}>
      {children}
    </CartContext.Provider>
  );
};
