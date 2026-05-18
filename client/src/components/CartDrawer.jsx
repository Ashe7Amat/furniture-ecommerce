// client/src/components/CartDrawer.jsx
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import CheckoutModal from './CheckoutModal';
import AuthModal from './AuthModal';
import '../styles/CartDrawer.css';

const CartDrawer = () => {
  const { isCartOpen, toggleCart, cartItems, removeFromCart, updateQuantity, cartTotal } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);

  const applyCoupon = () => {
    if (couponCode.toUpperCase() === 'BIENVENIDA10') {
      setDiscount(0.10);
      showToast('Cupón del 10% aplicado con éxito', 'success');
    } else {
      setDiscount(0);
      showToast('Cupón inválido', 'error');
    }
  };

  const finalTotal = discount > 0 ? cartTotal * (1 - discount) : cartTotal;

  const handleCheckoutClick = () => {
    if (!user) {
      setIsAuthOpen(true);
    } else {
      setIsCheckoutOpen(true);
    }
  };

  const handleRemove = (id) => {
    removeFromCart(id);
    showToast('Producto eliminado de la cesta', 'success');
  };

  return (
    <>
      {/* Overlay translúcido de fondo */}
      <div className={`cart-overlay ${isCartOpen ? 'active' : ''}`} onClick={toggleCart}></div>
      
      {/* Contenedor lateral deslizable (Cart Drawer) */}
      <div className={`cart-drawer ${isCartOpen ? 'active' : ''}`}>
        <div className="cart-header">
          <h2>Tu Cesta ({cartItems.length})</h2>
          <button className="cart-close-btn" onClick={toggleCart} aria-label="Cerrar cesta">✕</button>
        </div>
        
        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            /* Estado vacío (Empty State) premium y evocador */
            <div className="cart-empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#B38A70" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '24px', opacity: 0.85 }}>
                <path d="M4 18v3h2v-3" />
                <path d="M18 18v3h2v-3" />
                <path d="M5 4h14a1 1 0 0 1 1 1v7H4V5a1 1 0 0 1 1-1z" />
                <path d="M4 12h16" />
                <path d="M5 12v6h14v-6" />
              </svg>
              <h3>Tu cesta está vacía</h3>
              <p>Cada una de nuestras piezas es única, restaurada a mano y cargada de historia. Explora el catálogo para encontrar la tuya.</p>
              <button 
                className="cart-explore-btn" 
                onClick={() => {
                  toggleCart();
                  navigate('/catalogo');
                }}
              >
                Explorar Colección
              </button>
            </div>
          ) : (
            /* Grid con tarjetas de producto refinadas */
            cartItems.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-img-container">
                  <img src={item.imagen} alt={item.nombre} />
                </div>
                
                <div className="cart-item-details">
                  <div className="cart-item-meta">
                    <span className="cart-item-modality-badge">
                      {item.modalidad === 'compra' ? 'Compra' : 'Alquiler'}
                    </span>
                    <button 
                      className="cart-item-delete-btn" 
                      onClick={() => handleRemove(item.id)} 
                      title="Eliminar artículo"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <h4 className="cart-item-title">{item.nombre}</h4>
                  
                  <div className="cart-item-pricing-qty">
                    <span className="cart-item-price-label">{item.precio} €</span>
                    <div className="cart-qty-selector">
                      <button 
                        className="qty-btn" 
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.cantidad <= 1}
                      >
                        −
                      </button>
                      <span className="qty-number">{item.cantidad || 1}</span>
                      <button 
                        className="qty-btn" 
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer del Carrito (Subtotal, Cupón y Pago Seguro) */}
        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-coupon-section">
              <input 
                type="text" 
                placeholder="Código de descuento" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="cart-coupon-input"
              />
              <button onClick={applyCoupon} className="cart-coupon-apply-btn">
                Aplicar
              </button>
            </div>
            
            <div className="cart-subtotal-row">
              <span>Subtotal</span>
              <div>
                {discount > 0 && (
                  <span style={{ textDecoration: 'line-through', marginRight: '10px', opacity: 0.5, fontSize: '0.95rem' }}>
                    {cartTotal.toFixed(2)} €
                  </span>
                )}
                <span>{finalTotal.toFixed(2)} €</span>
              </div>
            </div>
            
            <button className="cart-checkout-btn" onClick={handleCheckoutClick}>
              Confirmar Pedido
            </button>
          </div>
        )}
      </div>

      {/* Pasarela de pago */}
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />

      {/* Pop-up de autenticación suave previa al checkout */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          setIsAuthOpen(false);
          setIsCheckoutOpen(true);
        }}
      />
    </>
  );
};

export default CartDrawer;
