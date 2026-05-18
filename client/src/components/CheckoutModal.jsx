// client/src/components/CheckoutModal.jsx
import React, { useState, useContext } from 'react';
import { CartContext } from '../context/CartContext';
import { checkoutCart } from '../services/api';
import '../styles/CheckoutModal.css';

const CheckoutModal = ({ isOpen, onClose }) => {
  const { cartItems, cartTotal, emptyCart, setIsCartOpen } = useContext(CartContext);
  const [activeTab, setActiveTab] = useState('card');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, apple_processing, processing, success
  const [orderNumber, setOrderNumber] = useState('');

  // Estados para datos de cliente y pago
  const [email, setEmail] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [bizumPhone, setBizumPhone] = useState('');

  // Estados de validación
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  if (!isOpen) return null;

  // --- VALIDACIONES DE CAMPOS ---
  const validateEmail = (val) => {
    if (!val) return 'El correo electrónico es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'El formato de correo no es válido.';
    return '';
  };

  const validateCardholderName = (val) => {
    if (!val) return 'El nombre del titular es obligatorio.';
    if (val.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(val)) return 'El nombre solo puede contener letras y espacios.';
    return '';
  };

  const validateCardNumber = (val) => {
    const raw = val.replace(/\s+/g, '');
    if (!raw) return 'El número de tarjeta es obligatorio.';
    if (raw.length !== 16) return 'El número de tarjeta debe tener exactamente 16 dígitos.';
    return '';
  };

  const validateExpiry = (val) => {
    if (!val) return 'La fecha de caducidad es obligatoria.';
    if (!/^\d{2}\/\d{2}$/.test(val)) return 'Formato inválido. Debe ser MM/AA.';
    const [month, year] = val.split('/').map(Number);
    if (month < 1 || month > 12) return 'El mes debe estar entre 01 y 12.';

    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return 'La tarjeta está caducada.';
    }
    return '';
  };

  const validateCvv = (val) => {
    if (!val) return 'El CVV es obligatorio.';
    if (!/^\d{3,4}$/.test(val)) return 'El CVV debe tener 3 o 4 dígitos.';
    return '';
  };

  const validatePhone = (val) => {
    const raw = val.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!raw) return 'El teléfono es obligatorio.';
    if (!/^[679]\d{8}$/.test(raw)) return 'Número español no válido (debe tener 9 dígitos y empezar por 6, 7 o 9).';
    return '';
  };

  // --- MANEJADORES DE ENTRADAS ---
  const handleBlur = (field, val, validator) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: validator(val) }));
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (touched.email) {
      setErrors(prev => ({ ...prev, email: validateEmail(val) }));
    }
  };

  const handleCardholderChange = (e) => {
    const val = e.target.value;
    setCardholderName(val);
    if (touched.cardholderName) {
      setErrors(prev => ({ ...prev, cardholderName: validateCardholderName(val) }));
    }
  };

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let formattedValue = value.replace(/(.{4})/g, '$1 ').trim();
    const truncated = formattedValue.substring(0, 19);
    setCardNumber(truncated);
    if (touched.cardNumber) {
      setErrors(prev => ({ ...prev, cardNumber: validateCardNumber(truncated) }));
    }
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (value.length > 2) {
      value = `${value.substring(0, 2)}/${value.substring(2, 4)}`;
    }
    const truncated = value.substring(0, 5);
    setExpiry(truncated);
    if (touched.expiry) {
      setErrors(prev => ({ ...prev, expiry: validateExpiry(truncated) }));
    }
  };

  const handleCvvChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').substring(0, 4);
    setCvv(val);
    if (touched.cvv) {
      setErrors(prev => ({ ...prev, cvv: validateCvv(val) }));
    }
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').substring(0, 9);
    setBizumPhone(val);
    if (touched.bizumPhone) {
      setErrors(prev => ({ ...prev, bizumPhone: validatePhone(val) }));
    }
  };

  // --- CÁLCULO DE VALIDEZ DE FORMULARIO ---
  const isCardFormInvalid =
    validateEmail(email) !== '' ||
    validateCardholderName(cardholderName) !== '' ||
    validateCardNumber(cardNumber) !== '' ||
    validateExpiry(expiry) !== '' ||
    validateCvv(cvv) !== '';

  const isBizumFormInvalid =
    validateEmail(email) !== '' ||
    validatePhone(bizumPhone) !== '';

  // --- SIMULACIÓN Y PROCESAMIENTO DE COMPRA ---
  const simulatePayment = (type) => {
    if (type === 'apple') {
      setPaymentStatus('apple_processing');
      setTimeout(() => {
        finishPayment('apple', { nombre: 'Cliente Apple Pay', email: 'applepay@nave5barcelona.com' });
      }, 1500);
    } else if (type === 'bizum') {
      setPaymentStatus('processing');
      setTimeout(() => {
        finishPayment('bizum', { nombre: 'Cliente Bizum', email: email });
      }, 2000);
    } else {
      setPaymentStatus('processing');
      setTimeout(() => {
        finishPayment('card', { nombre: cardholderName, email: email });
      }, 2000);
    }
  };

  const finishPayment = async (type, clientInfo) => {
    try {
      const itemsToSend = cartItems.map(item => ({
        productId: item.productId,
        nombre: item.nombre,
        modalidad: item.modalidad,
        cantidad: item.cantidad,
        precio: item.precio
      }));

      const res = await checkoutCart({
        items: itemsToSend,
        clienteInfo: {
          nombre: clientInfo.nombre,
          email: clientInfo.email,
          metodoPago: type === 'apple' ? 'Apple Pay' : type === 'bizum' ? 'Bizum' : 'Tarjeta de Crédito'
        },
        total: cartTotal
      });

      if (res && res.success) {
        const randomOrder = `#N5B-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        setOrderNumber(randomOrder);
        setPaymentStatus('success');
        emptyCart();
      } else {
        alert(res?.error || 'Hubo un error al procesar el pago con el servidor.');
        setPaymentStatus('idle');
      }
    } catch (error) {
      console.error('Error al completar el pago:', error);
      alert('Error de conexión al procesar el pago.');
      setPaymentStatus('idle');
    }
  };

  const handleClose = () => {
    onClose();
    if (paymentStatus === 'success') {
      setIsCartOpen(false); // Cierra el CartDrawer también
    }
    // Restablece el estado
    setTimeout(() => {
      setPaymentStatus('idle');
      setEmail('');
      setCardholderName('');
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setBizumPhone('');
      setErrors({});
      setTouched({});
    }, 300);
  };

  if (paymentStatus === 'success') {
    return (
      <div className="checkout-overlay">
        <div className="checkout-modal success-modal">
          <div className="success-icon">✓</div>
          <h2>¡Pedido confirmado con éxito!</h2>
          <p className="order-number">Pedido {orderNumber}</p>
          <p className="success-msg">Hemos registrado tu compra en Nave 5 Barcelona. El stock de los productos ha sido actualizado e inhabilitado.</p>
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
          <p>Procesando con Apple Pay...<br />Verificando mediante Face ID / Touch ID</p>
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
              <p>Paga de forma instantánea y segura usando tu dispositivo Apple sin ingresar datos manuales.</p>
              <button className="apple-pay-btn" onClick={() => simulatePayment('apple')}>
                 Pay
              </button>
            </div>
          )}

          {activeTab === 'card' && (
            <div className="tab-content card-tab">
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ana@ejemplo.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => handleBlur('email', email, validateEmail)}
                />
                {touched.email && errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label>Nombre del titular</label>
                <input
                  type="text"
                  placeholder="Ej. Ana Martínez"
                  value={cardholderName}
                  onChange={handleCardholderChange}
                  onBlur={() => handleBlur('cardholderName', cardholderName, validateCardholderName)}
                />
                {touched.cardholderName && errors.cardholderName && <span className="error-text">{errors.cardholderName}</span>}
              </div>

              <div className="form-group">
                <label>Número de tarjeta</label>
                <input
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  onBlur={() => handleBlur('cardNumber', cardNumber, validateCardNumber)}
                />
                {touched.cardNumber && errors.cardNumber && <span className="error-text">{errors.cardNumber}</span>}
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Caducidad</label>
                  <input
                    type="text"
                    placeholder="MM/AA"
                    maxLength="5"
                    value={expiry}
                    onChange={handleExpiryChange}
                    onBlur={() => handleBlur('expiry', expiry, validateExpiry)}
                  />
                  {touched.expiry && errors.expiry && <span className="error-text">{errors.expiry}</span>}
                </div>
                <div className="form-group half">
                  <label>CVV</label>
                  <input
                    type="password"
                    placeholder="123"
                    maxLength="4"
                    value={cvv}
                    onChange={handleCvvChange}
                    onBlur={() => handleBlur('cvv', cvv, validateCvv)}
                  />
                  {touched.cvv && errors.cvv && <span className="error-text">{errors.cvv}</span>}
                </div>
              </div>

              <button
                className="checkout-btn-solid"
                onClick={() => simulatePayment('card')}
                disabled={isCardFormInvalid}
              >
                Pagar {cartTotal} € de forma segura
              </button>
            </div>
          )}

          {activeTab === 'bizum' && (
            <div className="tab-content bizum-tab">
              <p>Introduce tu correo y teléfono asociado a Bizum para recibir la notificación de confirmación.</p>

              <div className="form-group" style={{ marginTop: '15px' }}>
                <label>Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ana@ejemplo.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => handleBlur('email', email, validateEmail)}
                />
                {touched.email && errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label>Número de teléfono</label>
                <input
                  type="tel"
                  placeholder="600000000"
                  value={bizumPhone}
                  onChange={handlePhoneChange}
                  onBlur={() => handleBlur('bizumPhone', bizumPhone, validatePhone)}
                />
                {touched.bizumPhone && errors.bizumPhone && <span className="error-text">{errors.bizumPhone}</span>}
              </div>

              <button
                className="checkout-btn-solid"
                onClick={() => simulatePayment('bizum')}
                disabled={isBizumFormInvalid}
              >
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
