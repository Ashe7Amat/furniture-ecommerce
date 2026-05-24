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
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [provincia, setProvincia] = useState('');
  const [notes, setNotes] = useState('');

  // Estados específicos de pasarela
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

  const validateFullName = (val) => {
    if (!val) return 'El nombre completo es obligatorio.';
    if (val.trim().length < 3) return 'Debe tener al menos 3 caracteres.';
    return '';
  };

  const validatePhone = (val) => {
    const raw = val.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!raw) return 'El teléfono es obligatorio.';
    if (!/^[6789]\d{8}$/.test(raw)) return 'Debe tener 9 dígitos.';
    return '';
  };

  const validateAddress = (val) => {
    if (!val) return 'La dirección de entrega es obligatoria.';
    return '';
  };

  const validateCity = (val) => {
    if (!val) return 'La ciudad es obligatoria.';
    return '';
  };

  const validateZipCode = (val) => {
    if (!val) return 'El código postal es obligatorio.';
    if (!/^\d{5}$/.test(val)) return 'Debe tener 5 dígitos.';
    return '';
  };

  const validateProvincia = (val) => {
    if (!val) return 'La provincia es obligatoria.';
    return '';
  };

  const validateCardholderName = (val) => {
    if (!val) return 'El nombre del titular es obligatorio.';
    if (val.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres.';
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
  const isGeneralFormInvalid =
    validateEmail(email) !== '' ||
    validateFullName(fullName) !== '' ||
    validatePhone(phone) !== '' ||
    validateAddress(address) !== '' ||
    validateCity(city) !== '' ||
    validateZipCode(zipCode) !== '' ||
    validateProvincia(provincia) !== '';

  const isCardDetailsInvalid =
    validateCardholderName(cardholderName) !== '' ||
    validateCardNumber(cardNumber) !== '' ||
    validateExpiry(expiry) !== '' ||
    validateCvv(cvv) !== '';

  // --- SIMULACIÓN Y PROCESAMIENTO DE COMPRA ---
  const simulatePayment = (type) => {
    if (type === 'apple') {
      setPaymentStatus('apple_processing');
      setTimeout(() => {
        finishPayment('apple');
      }, 1500);
    } else if (type === 'bizum') {
      setPaymentStatus('processing');
      setTimeout(() => {
        finishPayment('bizum');
      }, 2000);
    } else {
      setPaymentStatus('processing');
      setTimeout(() => {
        finishPayment('card');
      }, 2000);
    }
  };

  const finishPayment = async (type) => {
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
          nombre: fullName,
          email: email,
          telefono: phone,
          direccion: `${address}, ${zipCode} ${city} (${provincia})`,
          notas: notes || 'Ninguna',
          metodoPago: type === 'apple' ? 'Apple Pay' : type === 'bizum' ? `Bizum (${bizumPhone})` : `Tarjeta (Titular: ${cardholderName})`
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
      setFullName('');
      setPhone('');
      setAddress('');
      setCity('');
      setZipCode('');
      setProvincia('');
      setNotes('');
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

        <div className="checkout-body">
          {/* SECCIÓN 1: DATOS DE ENVÍO Y CONTACTO */}
          <div className="checkout-section">
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#3e322a', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
              1. Datos de Entrega y Contacto
            </h3>
            
            <div className="form-row">
              <div className="form-group half">
                <label>Nombre y Apellidos</label>
                <input
                  type="text"
                  placeholder="Ej. Ana Martínez"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setCardholderName(e.target.value);
                  }}
                  onBlur={() => handleBlur('fullName', fullName, validateFullName)}
                />
                {touched.fullName && errors.fullName && <span className="error-text">{errors.fullName}</span>}
              </div>
              <div className="form-group half">
                <label>Teléfono de Contacto</label>
                <input
                  type="tel"
                  placeholder="Ej. 600123456"
                  maxLength="9"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPhone(val);
                    setBizumPhone(val);
                  }}
                  onBlur={() => handleBlur('phone', phone, validatePhone)}
                />
                {touched.phone && errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>
            </div>

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
              <label>Dirección de Envío (Calle, número, piso, puerta)</label>
              <input
                type="text"
                placeholder="Calle Mayor 15, 2º B"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => handleBlur('address', address, validateAddress)}
              />
              {touched.address && errors.address && <span className="error-text">{errors.address}</span>}
            </div>

            <div className="form-row">
              <div className="form-group third">
                <label>Ciudad</label>
                <input
                  type="text"
                  placeholder="Ej. Barcelona"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onBlur={() => handleBlur('city', city, validateCity)}
                />
                {touched.city && errors.city && <span className="error-text">{errors.city}</span>}
              </div>
              <div className="form-group third">
                <label>Código Postal</label>
                <input
                  type="text"
                  placeholder="Ej. 08001"
                  maxLength="5"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={() => handleBlur('zipCode', zipCode, validateZipCode)}
                />
                {touched.zipCode && errors.zipCode && <span className="error-text">{errors.zipCode}</span>}
              </div>
              <div className="form-group third">
                <label>Provincia</label>
                <input
                  type="text"
                  placeholder="Ej. Barcelona"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  onBlur={() => handleBlur('provincia', provincia, validateProvincia)}
                />
                {touched.provincia && errors.provincia && <span className="error-text">{errors.provincia}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>Notas de Entrega / Alquiler (Opcional)</label>
              <textarea
                placeholder="Ej. Horario de entrega preferente, ascensor disponible, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="2"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '2px',
                  fontFamily: 'inherit',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* SECCIÓN 2: DETALLES DEL PAGO */}
          <div className="checkout-section" style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#3e322a', marginBottom: '15px' }}>
              2. Detalles del Pago
            </h3>
            
            <div className="checkout-tabs">
              <button type="button" className={`tab-btn ${activeTab === 'card' ? 'active' : ''}`} onClick={() => setActiveTab('card')}>Tarjeta</button>
              <button type="button" className={`tab-btn ${activeTab === 'apple' ? 'active' : ''}`} onClick={() => setActiveTab('apple')}>Apple Pay</button>
              <button type="button" className={`tab-btn ${activeTab === 'bizum' ? 'active' : ''}`} onClick={() => setActiveTab('bizum')}>Bizum</button>
            </div>

            <div className="tab-content-wrapper" style={{ marginTop: '15px' }}>
              {activeTab === 'apple' && (
                <div className="tab-content apple-tab">
                  <p>Paga de forma instantánea y segura usando tu dispositivo Apple sin ingresar datos manuales.</p>
                  <button 
                    type="button" 
                    className="apple-pay-btn" 
                    onClick={() => simulatePayment('apple')}
                    disabled={isGeneralFormInvalid}
                  >
                     Pay
                  </button>
                  {isGeneralFormInvalid && <p className="help-text-error">Debes rellenar los datos de envío arriba para poder pagar.</p>}
                </div>
              )}

              {activeTab === 'card' && (
                <div className="tab-content card-tab">
                  <div className="form-group">
                    <label>Nombre del titular de la tarjeta</label>
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
                    type="button"
                    className="checkout-btn-solid"
                    onClick={() => simulatePayment('card')}
                    disabled={isGeneralFormInvalid || isCardDetailsInvalid}
                  >
                    Pagar {cartTotal} € de forma segura
                  </button>
                </div>
              )}

              {activeTab === 'bizum' && (
                <div className="tab-content bizum-tab">
                  <p>Introduce tu teléfono asociado a Bizum para recibir la notificación de confirmación.</p>

                  <div className="form-group" style={{ marginTop: '15px' }}>
                    <label>Número de teléfono para Bizum</label>
                    <input
                      type="tel"
                      placeholder="Ej. 600123456"
                      maxLength="9"
                      value={bizumPhone}
                      onChange={handlePhoneChange}
                      onBlur={() => handleBlur('bizumPhone', bizumPhone, validatePhone)}
                    />
                    {touched.bizumPhone && errors.bizumPhone && <span className="error-text">{errors.bizumPhone}</span>}
                  </div>

                  <button
                    type="button"
                    className="checkout-btn-solid"
                    onClick={() => simulatePayment('bizum')}
                    disabled={isGeneralFormInvalid || validatePhone(bizumPhone) !== ''}
                  >
                    Pagar {cartTotal} € con Bizum
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
