import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/CheckoutResultado.css';

const CheckoutCancelado = () => (
  <div className="checkout-resultado-page">
    <div className="checkout-resultado-box">
      <div className="error-icon">✕</div>
      <h1>Pago cancelado</h1>
      <p className="success-msg">No te hemos cobrado nada. Tus productos siguen en la cesta si quieres retomar la compra.</p>
      <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
    </div>
  </div>
);

export default CheckoutCancelado;
