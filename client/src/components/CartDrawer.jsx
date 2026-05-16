import React, { useContext, useState } from 'react';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import CheckoutModal from './CheckoutModal';
import '../styles/CartDrawer.css';

const CartDrawer = () => {
  const { isCartOpen, toggleCart, cartItems, removeFromCart, cartTotal } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckoutClick = () => {
    setIsCheckoutOpen(true);
  };

  const handleRemove = (id) => {
    removeFromCart(id);
    showToast('Producto eliminado de la cesta', 'success');
  };

  return (
    <>
      <div className="cart-overlay" onClick={toggleCart}></div>
      <div className="cart-drawer">
        <div className="cart-header">
          <h2>Tu Cesta ({cartItems.length})</h2>
          <button className="cart-close-btn" onClick={toggleCart}>✕</button>
        </div>
        
        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <p>Tu cesta está vacía</p>
              <button className="cart-continue-btn" onClick={toggleCart}>Continuar comprando</button>
            </div>
          ) : (
            cartItems.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-img">
                  <img src={item.imagen} alt={item.nombre} />
                </div>
                <div className="cart-item-info">
                  <span className="cart-item-modality">{item.modalidad === 'compra' ? 'Compra' : 'Alquiler/día'}</span>
                  <h4 className="cart-item-name">{item.nombre}</h4>
                  <span className="cart-item-price">{item.precio} €</span>
                </div>
                <button className="cart-item-remove" onClick={() => handleRemove(item.id)}>✕</button>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total</span>
              <span>{cartTotal} €</span>
            </div>
            <button className="cart-checkout-btn" onClick={handleCheckoutClick}>
              Confirmar pedido
            </button>
          </div>
        )}
      </div>

      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />
    </>
  );
};

export default CartDrawer;
