import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getMuebleById } from '../services/api';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import '../styles/ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);
  const { showToast } = useContext(ToastContext);
  const { favorites, toggleFavorite } = useContext(FavoritesContext);
  const [mueble, setMueble] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');
  const [openAccordion, setOpenAccordion] = useState('');
  const [modalidad, setModalidad] = useState('compra');

  useEffect(() => {
    const fetchMueble = async () => {
      setLoading(true);
      try {
        const data = await getMuebleById(id);
        if (data) {
          setMueble(data);
          setMainImage(data.imagenes && data.imagenes.length > 0 
            ? data.imagenes[0] 
            : 'https://via.placeholder.com/600x600?text=Sin+Imagen');
          setModalidad(data.precio_venta ? 'compra' : 'alquiler');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchMueble();
  }, [id]);

  if (loading) {
    return (
      <div className="pd-loading-container">
        <div className="pd-loader"></div>
      </div>
    );
  }

  if (!mueble) {
    return (
      <div className="pd-error-container">
        <h2>Pieza no encontrada</h2>
        <button onClick={() => navigate('/')} className="pd-btn-back">Volver al catálogo</button>
      </div>
    );
  }

  const toggleAccordion = (section) => {
    setOpenAccordion(openAccordion === section ? '' : section);
  };

  const handleAddToCart = () => {
    addToCart(mueble, modalidad);
  };

  return (
    <div className="pd-container">
      <Helmet>
        <title>{`${mueble.nombre} | Nave 5 Barcelona`}</title>
        <meta name="description" content={mueble.descripcion || 'Pieza de diseño restaurada a mano en Nave 5 Barcelona'} />
        <meta property="og:title" content={`${mueble.nombre} | Nave 5 Barcelona`} />
        <meta property="og:description" content={mueble.descripcion || 'Pieza de diseño restaurada a mano en Nave 5 Barcelona'} />
        <meta property="og:image" content={mainImage} />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${mueble.nombre} | Nave 5 Barcelona`} />
        <meta name="twitter:description" content={mueble.descripcion || 'Pieza de diseño restaurada a mano en Nave 5 Barcelona'} />
        <meta name="twitter:image" content={mainImage} />
      </Helmet>

      <div className="pd-breadcrumb">
        <button onClick={() => navigate('/')} className="pd-back-link">
          &larr; Volver a la colección
        </button>
      </div>

      <div className="pd-grid">
        {/* COLUMNA IZQUIERDA: GALERIA VISUAL */}
        <div className="pd-gallery">
          <div className="pd-main-image-wrapper">
            <img key={mainImage} src={mainImage} alt={mueble.nombre} className="pd-main-image" />
            {mueble.estado === 'vendido' && <div className="pd-status-banner sold">Vendido</div>}
            {mueble.estado === 'alquilado' && <div className="pd-status-banner rented">Alquilado</div>}
          </div>
          {mueble.imagenes && mueble.imagenes.length > 1 && (
            <div className="pd-thumbnails">
              {mueble.imagenes.map((img, index) => (
                <button 
                  key={index} 
                  className={`pd-thumbnail-btn ${mainImage === img ? 'active' : ''}`}
                  onClick={() => setMainImage(img)}
                >
                  <img src={img} alt={`Miniatura ${index + 1}`} className="pd-thumbnail-img" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: INFO Y ACCIONES */}
        <div className="pd-info">
          <span className="pd-category">{mueble.categoria || 'Selected Collection'}</span>
          <div className="pd-title-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="pd-title">{mueble.nombre}</h1>
            <button 
              className="icon-btn" 
              onClick={() => toggleFavorite(mueble.id)} 
              style={{ cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: '8px' }}
              aria-label="Añadir a favoritos"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill={favorites.includes(mueble.id) ? "#B38A70" : "none"} stroke={favorites.includes(mueble.id) ? "#B38A70" : "#3E322A"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="header-icon-svg">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
          <p className="pd-price">{mueble.precio_venta ? `${mueble.precio_venta} €` : 'Consultar precio'}</p>
          
          <div className="pd-description">
            <p>{mueble.descripcion}</p>
          </div>

          <div className="pd-actions-form">
            <div className="pd-quantity-wrapper">
              <label className="pd-label">Cantidad</label>
              <div className="pd-quantity-selector">
                <button className="pd-qty-btn" disabled>−</button>
                <span className="pd-qty-val">1</span>
                <button className="pd-qty-btn" disabled>+</button>
              </div>
            </div>

            <div className="pd-options-wrapper">
              <label className="pd-label">Modalidad</label>
              <div className="pd-options-grid">
                <button 
                  className={`pd-option-btn ${modalidad === 'compra' ? 'active' : ''}`}
                  disabled={mueble.estado === 'vendido'}
                  onClick={() => setModalidad('compra')}
                >
                  <span className="pd-opt-title">Comprar pieza única</span>
                  {mueble.precio_venta && <span className="pd-opt-price">{mueble.precio_venta} €</span>}
                </button>
                <button 
                  className={`pd-option-btn outline ${modalidad === 'alquiler' ? 'active' : ''}`}
                  disabled={!mueble.precio_alquiler || mueble.estado === 'vendido'}
                  onClick={() => setModalidad('alquiler')}
                >
                  <span className="pd-opt-title">Alquilar por días</span>
                  {mueble.precio_alquiler ? <span className="pd-opt-price">{mueble.precio_alquiler} €/día</span> : <span className="pd-opt-price">No disponible</span>}
                </button>
              </div>
            </div>

            <button 
              className="pd-cta-btn" 
              disabled={mueble.estado === 'vendido' || mueble.estado === 'alquilado'}
              onClick={handleAddToCart}
            >
              {mueble.estado === 'vendido' ? 'Agotado' : (mueble.estado === 'alquilado' ? 'Actualmente alquilado' : 'Añadir a mi cesta')}
            </button>
          </div>

          {/* ACORDEON DE DETALLES */}
          <div className="pd-accordion-container">
            <div className="pd-accordion-item">
              <button className="pd-accordion-header" onClick={() => toggleAccordion('details')}>
                <span>Detalles del artículo</span>
                <span className="pd-accordion-icon">{openAccordion === 'details' ? '−' : '+'}</span>
              </button>
              <div className={`pd-accordion-content ${openAccordion === 'details' ? 'open' : ''}`}>
                <p>Esta pieza ha sido cuidadosamente restaurada en nuestro taller. Conserva su carácter original pero con acabados renovados para garantizar su durabilidad y adaptabilidad a espacios modernos.</p>
              </div>
            </div>
            
            <div className="pd-accordion-item">
              <button className="pd-accordion-header" onClick={() => toggleAccordion('shipping')}>
                <span>Envíos y devoluciones</span>
                <span className="pd-accordion-icon">{openAccordion === 'shipping' ? '−' : '+'}</span>
              </button>
              <div className={`pd-accordion-content ${openAccordion === 'shipping' ? 'open' : ''}`}>
                <p>Contamos con transporte especializado en muebles delicados (1-2 semanas aprox). Ofrecemos 14 días para devoluciones desde la recepción del producto, siempre conservando el embalaje original.</p>
              </div>
            </div>
          </div>
          
          <div className="pd-sku">
            Ref. SKU-{String(mueble.id).slice(0, 6).toUpperCase() || '0001A'}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
