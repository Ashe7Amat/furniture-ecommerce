import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { ToastContext } from './ToastContext';

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
    const price = modality === 'compra' ? product.precio_venta : product.precio_alquiler;
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
          imagen: product.imagenes && product.imagenes.length > 0 ? product.imagenes[0] : 'https://via.placeholder.com/300x200?text=Sin+Imagen',
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

  const cartTotal = cartItems.reduce((acc, item) => acc + (item.precio * (item.cantidad || 1)), 0);

  return (
    <CartContext.Provider value={{ 
      cartItems, addToCart, removeFromCart, updateQuantity, emptyCart, 
      isCartOpen, toggleCart, setIsCartOpen, cartTotal 
    }}>
      {children}
    </CartContext.Provider>
  );
};
