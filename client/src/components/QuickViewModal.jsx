import React, { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { formatPrice } from '../utils/format';
import '../styles/QuickViewModal.css';

const QuickViewModal = ({ mueble, onClose }) => {
  const { addToCart } = useContext(CartContext);
  const { toggleFavorite, isFavorite } = useContext(FavoritesContext);
  const closeBtnRef = useRef(null);
  const isFav = isFavorite(mueble.id);
  const isSold = mueble.estado === 'vendido';
  const isAlquilado = mueble.estado === 'alquilado';
  const imageUrl = mueble.imagenes?.[0] || 'https://via.placeholder.com/600x600?text=Sin+Imagen';

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

  const handleAddToCart = () => {
    addToCart(mueble, 'compra');
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
          {mueble.descripcion && <p className="qv-desc">{mueble.descripcion}</p>}
          <span className="qv-price font-display">
            {mueble.precio_venta ? `${formatPrice(mueble.precio_venta)} €` : (mueble.precio_alquiler_dia ? `${formatPrice(mueble.precio_alquiler_dia)} €/día` : 'Consultar precio')}
          </span>

          <div className="qv-actions">
            <button className="qv-btn qv-btn-solid" onClick={handleAddToCart} disabled={isSold || isAlquilado}>
              {isSold ? 'Agotado' : isAlquilado ? 'Alquilado' : 'Añadir a la cesta'}
            </button>
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
