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
        <button className="fav-btn" onClick={handleFavClick}>
          {isFav ? '🖤' : '🤍'}
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
