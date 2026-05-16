import React, { useState, useContext } from 'react';
import { CartContext } from '../context/CartContext';
import '../styles/CheckoutModal.css';

const CheckoutModal = ({ isOpen, onClose }) => {
  const { cartTotal, emptyCart, setIsCartOpen } = useContext(CartContext);
  const [activeTab, setActiveTab] = useState('card');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, apple_processing, processing, success
  const [orderNumber, setOrderNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  
  if (!isOpen) return null;

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let formattedValue = value.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formattedValue.substring(0, 19));
  };

  const simulatePayment = (type) => {
    if (type === 'apple') {
      setPaymentStatus('apple_processing');
      setTimeout(() => {
        finishPayment();
      }, 1500);
    } else {
      setPaymentStatus('processing');
      setTimeout(() => {
        finishPayment();
      }, 2000);
    }
  };

  const finishPayment = () => {
    const randomOrder = `#KH-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setOrderNumber(randomOrder);
    setPaymentStatus('success');
    emptyCart();
  };

  const handleClose = () => {
    onClose();
    if (paymentStatus === 'success') {
      setIsCartOpen(false); // Cierra el CartDrawer también
    }
    // Restablece el estado por si acaso
    setTimeout(() => setPaymentStatus('idle'), 300);
  };

  if (paymentStatus === 'success') {
    return (
      <div className="checkout-overlay">
        <div className="checkout-modal success-modal">
          <div className="success-icon">✓</div>
          <h2>¡Pedido confirmado con éxito!</h2>
          <p className="order-number">Pedido {orderNumber}</p>
          <p className="success-msg">Hemos enviado los detalles de tu pedido y el recibo a tu correo electrónico.</p>
          <button className="checkout-btn-solid" onClick={handleClose}>Volver a la tienda</button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-overlay">
      {paymentStatus === 'apple_processing' && (
        <div className="apple-processing-overlay">
          <div className="apple-spinner"></div>
          <p>Procesando con Apple Pay...<br/>Verificando mediante Face ID / Touch ID</p>
        </div>
      )}
      
      {paymentStatus === 'processing' && (
        <div className="processing-overlay">
          <div className="classic-spinner"></div>
          <p>Conectando con la pasarela segura del banco...</p>
        </div>
      )}

      <div className="checkout-modal">
        <div className="checkout-header">
          <h2>Finalizar Pago</h2>
          <button className="close-checkout" onClick={onClose}>✕</button>
        </div>

        <div className="checkout-tabs">
          <button className={`tab-btn ${activeTab === 'card' ? 'active' : ''}`} onClick={() => setActiveTab('card')}>Tarjeta</button>
          <button className={`tab-btn ${activeTab === 'apple' ? 'active' : ''}`} onClick={() => setActiveTab('apple')}>Apple Pay</button>
          <button className={`tab-btn ${activeTab === 'bizum' ? 'active' : ''}`} onClick={() => setActiveTab('bizum')}>Bizum</button>
        </div>

        <div className="checkout-body">
          {activeTab === 'apple' && (
            <div className="tab-content apple-tab">
              <p>Paga rápidamente y de forma segura usando tu dispositivo Apple.</p>
              <button className="apple-pay-btn" onClick={() => simulatePayment('apple')}>
                 Pay
              </button>
            </div>
          )}

          {activeTab === 'card' && (
            <div className="tab-content card-tab">
              <div className="form-group">
                <label>Nombre del titular</label>
                <input type="text" placeholder="Ej. Ana Martínez" />
              </div>
              <div className="form-group">
                <label>Número de tarjeta</label>
                <input 
                  type="text" 
                  placeholder="0000 0000 0000 0000" 
                  value={cardNumber} 
                  onChange={handleCardNumberChange} 
                />
              </div>
              <div className="form-row">
                <div className="form-group half">
                  <label>Caducidad</label>
                  <input type="text" placeholder="MM/AA" maxLength="5" />
                </div>
                <div className="form-group half">
                  <label>CVV</label>
                  <input type="password" placeholder="123" maxLength="4" />
                </div>
              </div>
              <button className="checkout-btn-solid" onClick={() => simulatePayment('card')}>
                Pagar {cartTotal} € de forma segura
              </button>
            </div>
          )}

          {activeTab === 'bizum' && (
            <div className="tab-content bizum-tab">
              <p>Introduce tu número de teléfono asociado a Bizum para recibir la notificación de pago en tu app bancaria.</p>
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Número de teléfono</label>
                <input type="tel" placeholder="+34 600 000 000" />
              </div>
              <button className="checkout-btn-solid bizum-btn" onClick={() => simulatePayment('bizum')}>
                Pagar {cartTotal} € con Bizum
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
