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
    const newItem = {
      id: `${product.id}-${modality}-${Date.now()}`,
      productId: product.id,
      nombre: product.nombre,
      imagen: product.imagenes && product.imagenes.length > 0 ? product.imagenes[0] : 'https://via.placeholder.com/300x200?text=Sin+Imagen',
      precio: price,
      modalidad: modality
    };
    setCartItems(prev => [...prev, newItem]);
    setIsCartOpen(true);
  };

  const removeFromCart = (idToRemove) => {
    setCartItems(prev => prev.filter(item => item.id !== idToRemove));
  };

  const emptyCart = () => {
    setCartItems([]);
  };

  const toggleCart = () => {
    setIsCartOpen(!isCartOpen);
  };

  const cartTotal = cartItems.reduce((acc, item) => acc + item.precio, 0);

  return (
    <CartContext.Provider value={{ 
      cartItems, addToCart, removeFromCart, emptyCart, 
      isCartOpen, toggleCart, setIsCartOpen, cartTotal 
    }}>
      {children}
    </CartContext.Provider>
  );
};
