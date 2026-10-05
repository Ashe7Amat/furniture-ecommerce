import { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { textoPrecio, tienePrecio } from '../utils/format';
import { rutaPreguntarPorPieza, TEXTO_PREGUNTAR } from '../utils/preguntarPorPieza';
import { PLACEHOLDER_IMG } from '../utils/images';
import '../styles/QuickViewModal.css';
import ReferenciaProducto from './ReferenciaProducto';

const QuickViewModal = ({ mueble, onClose }) => {
  const { addToCart, cestaLlena } = useContext(CartContext);
  const { toggleFavorite, isFavorite } = useContext(FavoritesContext);
  const closeBtnRef = useRef(null);
  const isFav = isFavorite(mueble.id);
  const isSold = mueble.estado === 'vendido';
  const isAlquilado = mueble.estado === 'alquilado';
  const imageUrl = mueble.imagenes?.[0] || PLACEHOLDER_IMG;

  useEffect(() => {
    closeBtnRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // C4: antes añadía siempre para comprar, también una pieza que solo se alquila (y llegaba a la
  // cesta sin precio). Sin precio de venta, para alquilar, como la ficha.
  const handleAddToCart = () => {
    addToCart(mueble, mueble.precio_venta ? 'compra' : 'alquiler');
    onClose();
  };

  return createPortal(
    <div className="qv-overlay" role="dialog" aria-modal="true" aria-labelledby="qv-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qv-card">
        <button className="qv-close" onClick={onClose} aria-label="Cerrar" ref={closeBtnRef}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>

        <div className="qv-image-wrap">
          <img src={imageUrl} alt={mueble.nombre} loading="lazy" decoding="async" />
          {isSold && <span className="qv-status-tag sold">Vendido</span>}
          {isAlquilado && <span className="qv-status-tag rented">Alquilado</span>}
        </div>

        <div className="qv-body">
          <span className="qv-category">{mueble.categoria}</span>
          <h3 id="qv-title" className="qv-name font-display">{mueble.nombre}</h3>
          <ReferenciaProducto referencia={mueble.referencia} className="qv-ref" />
          {mueble.descripcion && <p className="qv-desc">{mueble.descripcion}</p>}
          <span className="qv-price font-display">
            {textoPrecio(mueble)}
          </span>

          <div className="qv-actions">
            {/* C3: disponible y sin precios a la vista, se pregunta por ella en vez de comprarla */}
            {!isSold && !isAlquilado && !tienePrecio(mueble) ? (
              <Link to={rutaPreguntarPorPieza(mueble)} className="qv-btn qv-btn-solid" onClick={onClose}>
                {TEXTO_PREGUNTAR}
              </Link>
            ) : (
              <button className="qv-btn qv-btn-solid" onClick={handleAddToCart} disabled={isSold || isAlquilado || cestaLlena}>
                {isSold ? 'Agotado' : isAlquilado ? 'Alquilado' : cestaLlena ? 'Cesta llena' : 'Añadir a la cesta'}
              </button>
            )}
            <button className={`qv-btn qv-btn-ghost ${isFav ? 'active' : ''}`} onClick={() => toggleFavorite(mueble.id)}>
              {isFav ? 'En favoritos ✓' : 'Añadir a favoritos'}
            </button>
          </div>

          <Link to={`/mueble/${mueble.id}`} className="qv-link-full" onClick={onClose}>Ver ficha completa →</Link>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuickViewModal;
