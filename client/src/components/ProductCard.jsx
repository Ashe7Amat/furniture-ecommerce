// client/src/components/ProductCard.jsx
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { FavoritesContext } from '../context/FavoritesContext';
import '../styles/ProductCard.css';

const ProductCard = ({ mueble }) => {
  const { toggleFavorite, isFavorite } = useContext(FavoritesContext);
  const isFav = isFavorite(mueble.id);
  const imageUrl = mueble.imagenes && mueble.imagenes.length > 0 
    ? mueble.imagenes[0] 
    : 'https://via.placeholder.com/300x200?text=Sin+Imagen';

  const handleFavClick = (e) => {
    e.preventDefault();
    toggleFavorite(mueble.id);
  };

  return (
    <Link to={`/mueble/${mueble.id}`} className="product-card">
      <div className="product-image-container">
        <img src={imageUrl} alt={mueble.nombre || 'Mueble'} className="product-image" />
        <button className="fav-btn" onClick={handleFavClick} aria-label="Favorito">
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "#B38A70" : "none"} stroke={isFav ? "#B38A70" : "#3E322A"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="card-fav-svg">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        {mueble.estado === 'vendido' && (
          <div className="product-sold-overlay">
            <span className="product-sold-badge">Vendido</span>
          </div>
        )}
        {mueble.estado === 'alquilado' && (
          <div className="product-sold-overlay">
            <span className="product-sold-badge" style={{ color: '#857468' }}>Alquilado</span>
          </div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-title">{mueble.nombre}</h3>
        <p className="product-description">{mueble.descripcion}</p>
        <span className="price-value">
          {mueble.estado === 'vendido' ? (
            <span style={{ textDecoration: 'line-through', color: '#857468', fontSize: '0.9rem' }}>
              {mueble.precio_venta ? `${mueble.precio_venta} €` : `${mueble.precio_alquiler} €/día`}
            </span>
          ) : (
            mueble.precio_venta ? `${mueble.precio_venta} €` : (mueble.precio_alquiler ? `${mueble.precio_alquiler} €/día` : 'Consultar')
          )}
        </span>
      </div>
    </Link>
  );
};

export default ProductCard;
