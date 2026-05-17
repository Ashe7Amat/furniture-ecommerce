import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
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
    setCartItems(prev => {
      const existingItem = prev.find(item => item.productId === product.id && item.modalidad === modality);
      if (existingItem) {
        return prev.map(item => 
          item.id === existingItem.id 
            ? { ...item, cantidad: (item.cantidad || 1) + 1 } 
            : item
        );
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
    setIsCartOpen(true);
  };

  const removeFromCart = (idToRemove) => {
    setCartItems(prev => prev.filter(item => item.id !== idToRemove));
  };

  const updateQuantity = (id, delta) => {
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
