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

  const esVendido = mueble.estado === 'vendido';
  const esAlquilado = mueble.estado === 'alquilado';

  return (
    <>
      <Link to={`/mueble/${mueble.id}`} className={`product-card ${esVendido ? 'is-sold' : ''}`}>
        <div className="product-image-container">
          <img
            src={imageUrl}
            alt={mueble.nombre || 'Mueble'}
            className={`product-image ${esVendido ? 'product-image--sold' : ''}`}
            loading="lazy"
            decoding="async"
          />

          {/* Overlay esquina superior izquierda: Pieza Única (disponible) o Vendido (grayscale) */}
          <div className="product-badge-overlay">
            {esVendido ? (
              <span className="product-badge product-badge--sold">Vendido</span>
            ) : esAlquilado ? (
              <span className="product-badge product-badge--rented">Alquilado</span>
            ) : (
              <span className="product-badge product-badge--unique">Pieza Única</span>
            )}
          </div>

          {/* Overlay esquina superior derecha: Corazón de favoritos con fondo oscuro y backdrop-blur */}
          <button
            className={`fav-btn ${isPopping ? 'pop-anim' : ''}`}
            onClick={handleFavClick}
            aria-label="Favorito"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isFav ? "var(--accent-color)" : "none"}
              stroke={isFav ? "var(--accent-color)" : "#ffffff"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="card-fav-svg"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {!esVendido && !esAlquilado && (
            <button className="quick-view-btn" onClick={handleQuickView}>Vista rápida</button>
          )}
        </div>
        <div className="product-info">
          <h2 className="product-title">{mueble.nombre}</h2>
          <ReferenciaProducto referencia={mueble.referencia} className="product-reference" />
          {mueble.descripcion && (
            <p className="product-description">{mueble.descripcion}</p>
          )}
          <div className="product-footer">
            <span className="price-value">
              {/* C2: vendida, el precio tachado; vendida y sin precio, nada. Si no, textoPrecio. */}
              {esVendido ? (
                tienePrecio(mueble) && (
                  <span style={{ textDecoration: 'line-through', color: 'var(--secondary-color)', fontSize: '0.9rem' }}>
                    {textoPrecio(mueble)}
                  </span>
                )
              ) : (
                textoPrecio(mueble)
              )}
            </span>
            <span className="product-cta">
              {esVendido ? 'Ver detalles →' : 'Solicitar información →'}
            </span>
          </div>
        </div>
      </Link>
      {isQuickViewOpen && <QuickViewModal mueble={mueble} onClose={() => setIsQuickViewOpen(false)} />}
    </>
  );
};

export default ProductCard;
