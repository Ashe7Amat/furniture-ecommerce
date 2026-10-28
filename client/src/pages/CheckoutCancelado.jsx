import { Link } from 'react-router-dom';
import '../styles/CheckoutResultado.css';
import { useDocumentMeta } from '../utils/useDocumentMeta';

const CheckoutCancelado = () => {
  // Página de paso: fuera de los buscadores (SEO del catálogo, 28 oct 2026).
  useDocumentMeta({ title: 'Pago cancelado', noindex: true });

  return (
    <div className="checkout-resultado-page">
      <div className="checkout-resultado-box">
        <div className="error-icon">✕</div>
        <h1>Pago cancelado</h1>
        <p className="success-msg">No te hemos cobrado nada. Tus productos siguen en la cesta si quieres retomar la compra.</p>
        <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
      </div>
    </div>
  );
};

export default CheckoutCancelado;
