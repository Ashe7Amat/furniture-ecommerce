// client/src/components/ProductCard.jsx
import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { FavoritesContext } from '../context/FavoritesContext';
import { textoPrecio, tienePrecio } from '../utils/format';
import { PLACEHOLDER_IMG, miniatura } from '../utils/images';
import QuickViewModal from './QuickViewModal';
import '../styles/ProductCard.css';
import ReferenciaProducto from './ReferenciaProducto';

const ProductCard = ({ mueble }) => {
  const { toggleFavorite, isFavorite } = useContext(FavoritesContext);
  const [isPopping, setIsPopping] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const isFav = isFavorite(mueble.id);
  // La tarjeta pinta la foto a unos 300 px: la miniatura de 400 px si la tiene (H61).
  const imageUrl = mueble.imagenes && mueble.imagenes.length > 0
    ? miniatura(mueble.imagenes[0])
    : PLACEHOLDER_IMG;

  const handleFavClick = (e) => {
    e.preventDefault();
    toggleFavorite(mueble.id);
    setIsPopping(true);
    setTimeout(() => setIsPopping(false), 400);
  };

  const handleQuickView = (e) => {
    e.preventDefault();
    setIsQuickViewOpen(true);
  };

  return (
    <>
      <Link to={`/mueble/${mueble.id}`} className="product-card">
        <div className="product-image-container">
          <img src={imageUrl} alt={mueble.nombre || 'Mueble'} className="product-image" loading="lazy" decoding="async" />
          <button className={`fav-btn ${isPopping ? 'pop-anim' : ''}`} onClick={handleFavClick} aria-label="Favorito">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "var(--accent-color)" : "none"} stroke={isFav ? "var(--accent-color)" : "var(--primary-color)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="card-fav-svg">
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
              <span className="product-sold-badge" style={{ color: 'var(--secondary-color)' }}>Alquilado</span>
            </div>
          )}
          {mueble.estado !== 'vendido' && mueble.estado !== 'alquilado' && (
            <button className="quick-view-btn" onClick={handleQuickView}>Vista rápida</button>
          )}
        </div>
        <div className="product-info">
          <h2 className="product-title">{mueble.nombre}</h2>
          <ReferenciaProducto referencia={mueble.referencia} />
          <p className="product-description">{mueble.descripcion}</p>
          <span className="price-value">
            {/* C2: vendida, el precio tachado; vendida y sin precio, nada (antes salía "null €/día", y
                pedir precio de algo vendido no tiene sentido). Si no, textoPrecio. */}
            {mueble.estado === 'vendido' ? (
              tienePrecio(mueble) && (
                <span style={{ textDecoration: 'line-through', color: 'var(--secondary-color)', fontSize: '0.9rem' }}>
                  {textoPrecio(mueble)}
                </span>
              )
            ) : (
              textoPrecio(mueble)
            )}
          </span>
        </div>
      </Link>
      {isQuickViewOpen && <QuickViewModal mueble={mueble} onClose={() => setIsQuickViewOpen(false)} />}
    </>
  );
};

export default ProductCard;
