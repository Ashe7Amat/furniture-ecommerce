// client/src/components/CheckoutModal.jsx
import { useState, useContext, useEffect } from 'react';
import { CartContext } from '../context/CartContext';
import { crearSesionPago } from '../services/api';
import '../styles/CheckoutModal.css';

const CheckoutModal = ({ isOpen, onClose }) => {
  const { cartItems, cartTotal, validateCart } = useContext(CartContext);
  const [activeTab, setActiveTab] = useState('card');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, checking, redirecting
  const [payError, setPayError] = useState('');

  // Al abrir el modal, comprobamos que ninguna pieza de la cesta se haya vendido o
  // eliminado mientras tanto, para no llegar a Stripe con un carrito ya inválido.
  useEffect(() => {
    if (isOpen) {
      validateCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Estados para datos de cliente y envío
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [provincia, setProvincia] = useState('');
  const [notes, setNotes] = useState('');

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

  // --- CÁLCULO DE VALIDEZ DE FORMULARIO ---
  const isGeneralFormInvalid =
    validateEmail(email) !== '' ||
    validateFullName(fullName) !== '' ||
    validatePhone(phone) !== '' ||
    validateAddress(address) !== '' ||
    validateCity(city) !== '' ||
    validateZipCode(zipCode) !== '' ||
    validateProvincia(provincia) !== '';

  // --- PAGO REAL CON STRIPE (redirige a la página segura de Stripe) ---
  const handlePagarConTarjeta = async () => {
    setPayError('');
    setPaymentStatus('checking');

    // Última comprobación por si alguna pieza se vendió o se eliminó mientras el
    // cliente rellenaba el formulario. Si hemos tenido que quitar algo, no seguimos:
    // le dejamos ver la cesta actualizada y pulsar Pagar otra vez.
    const cestaValida = await validateCart();
    if (!cestaValida) {
      setPayError('Alguna pieza de tu cesta ya no estaba disponible y la hemos quitado automáticamente. Revisa el resumen del pedido y vuelve a intentarlo.');
      setPaymentStatus('idle');
      return;
    }

    if (cartItems.length === 0) {
      setPayError('Tu cesta está vacía.');
      setPaymentStatus('idle');
      return;
    }

    setPaymentStatus('redirecting');

    const itemsToSend = cartItems.map(item => ({
      productId: item.productId,
      modalidad: item.modalidad
    }));

    const res = await crearSesionPago({
      items: itemsToSend,
      clienteInfo: {
        nombre: fullName,
        email: email,
        telefono: phone,
        direccion: `${address}, ${zipCode} ${city} (${provincia})`,
        notas: notes || 'Ninguna'
      }
    });

    if (res && res.url) {
      window.location.href = res.url; // el comprador termina el pago en Stripe y vuelve a /checkout/exito
      return;
    }

    // El servidor hace su propia validación al crear la sesión (por si la pieza cambió
    // justo en este instante); si rechaza algo, quitamos la cesta de la vista de "todo
    // ok" y mostramos el motivo real que ha dado, en vez de dejar el botón sin reacción.
    setPayError(res?.error || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
    setPaymentStatus('idle');
    validateCart();
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setPaymentStatus('idle');
      setPayError('');
    }, 300);
  };

  return (
    <div className="checkout-overlay">
      {paymentStatus === 'checking' && (
        <div className="processing-overlay">
          <div className="classic-spinner"></div>
          <p>Comprobando disponibilidad de tu pedido...</p>
        </div>
      )}

      {paymentStatus === 'redirecting' && (
        <div className="processing-overlay">
          <div className="classic-spinner"></div>
          <p>Conectando con la pasarela segura de Stripe...</p>
        </div>
      )}

      <div className="checkout-modal">
        <div className="checkout-header">
          <h2>Finalizar Pago</h2>
          <button className="close-checkout" onClick={handleClose}>✕</button>
        </div>

        <div className="checkout-body">
          {/* SECCIÓN 1: DATOS DE ENVÍO Y CONTACTO */}
          <div className="checkout-section">
            <h3 className="checkout-section-title">
              1. Datos de Entrega y Contacto
            </h3>

            <div className="form-row">
              <div className="form-group half">
                <label>Nombre y Apellidos</label>
                <input
                  type="text"
                  placeholder="Ej. Ana Martínez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
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
              />
            </div>
          </div>

          {/* SECCIÓN 2: DETALLES DEL PAGO */}
          <div className="checkout-section checkout-section-payment">
            <h3 className="checkout-section-title checkout-section-title-plain">
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
                  <p>Apple Pay estará disponible en cuanto se active en la pasarela de pago. De momento, paga con tarjeta en la pestaña «Tarjeta».</p>
                </div>
              )}

              {activeTab === 'card' && (
                <div className="tab-content card-tab">
                  <p className="card-tab-note">
                    Al continuar te llevamos a la página de pago segura de Stripe, donde introduces los datos de tu tarjeta. Nave 5 Barcelona nunca ve ni guarda tu número de tarjeta.
                  </p>

                  {payError && <p className="payment-error-box">{payError}</p>}

                  <button
                    type="button"
                    className="checkout-btn-solid"
                    onClick={handlePagarConTarjeta}
                    disabled={isGeneralFormInvalid || cartItems.length === 0 || paymentStatus === 'checking' || paymentStatus === 'redirecting'}
                  >
                    {cartItems.length === 0
                      ? 'Tu cesta está vacía'
                      : `Pagar ${cartTotal.toFixed(2)} € de forma segura`}
                  </button>
                </div>
              )}

              {activeTab === 'bizum' && (
                <div className="tab-content bizum-tab">
                  <p>Bizum estará disponible en cuanto se active en la pasarela de pago. De momento, paga con tarjeta en la pestaña «Tarjeta».</p>
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
