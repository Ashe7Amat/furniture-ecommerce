import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../utils/useDocumentMeta';
import '../styles/NotFound.css';

const NotFound = () => {
  useDocumentMeta({ title: 'Página no encontrada', noindex: true });

  return (
    <div className="not-found-page">
      <span className="not-found-code font-display">404</span>
      <h1>Esta pieza no está en el almacén</h1>
      <p>La página que buscas no existe o se ha movido. Puede que la pieza que buscabas ya se haya vendido.</p>
      <div className="not-found-actions">
        <Link to="/" className="not-found-btn">Volver al inicio</Link>
        <Link to="/catalogo" className="not-found-link">Ver el catálogo completo →</Link>
      </div>
      {/* H40: si buscaba una pieza concreta que ya no está, que pueda preguntar por ella. */}
      <p className="not-found-contacto">
        ¿Buscabas una pieza concreta? <Link to="/contacto">Escríbenos</Link> y te decimos si sigue en el almacén.
      </p>
    </div>
  );
};

export default NotFound;
