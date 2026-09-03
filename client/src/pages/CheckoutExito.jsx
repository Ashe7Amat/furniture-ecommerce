import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { confirmarSesionPago } from '../services/api';
import { CartContext } from '../context/CartContext';
import '../styles/CheckoutResultado.css';

const CheckoutExito = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { emptyCart } = useContext(CartContext);
  const [estado, setEstado] = useState('confirmando'); // confirmando, ok, error
  const [mensajeError, setMensajeError] = useState('');
  const yaConfirmado = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setEstado('error');
      setMensajeError('Falta el identificador del pago.');
      return;
    }
    if (yaConfirmado.current) return; // evita doble llamada en StrictMode
    yaConfirmado.current = true;

    confirmarSesionPago(sessionId).then((res) => {
      if (res && res.success) {
        emptyCart();
        setEstado('ok');
      } else {
        setEstado('error');
        setMensajeError(res?.error || 'No se pudo confirmar el pago.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="checkout-resultado-page">
      <div className="checkout-resultado-box">
        {estado === 'confirmando' && (
          <>
            <div className="classic-spinner" style={{ margin: '0 auto 24px' }}></div>
            <h1>Confirmando tu pago...</h1>
            <p>Estamos verificando el pago con Stripe, un momento.</p>
          </>
        )}

        {estado === 'ok' && (
          <>
            <div className="success-icon">✓</div>
            <h1>¡Pedido confirmado con éxito!</h1>
            <p className="success-msg">
              Hemos registrado tu compra en Nave 5 Barcelona y actualizado el catálogo.
              En breve recibirás la confirmación por correo.
            </p>
            <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="error-icon">!</div>
            <h1>No hemos podido confirmar el pago</h1>
            <p className="success-msg">{mensajeError}</p>
            <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutExito;
