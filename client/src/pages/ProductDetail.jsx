import { useEffect, useState, useContext, lazy, Suspense, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDocumentMeta } from '../utils/useDocumentMeta';
import { descripcionParaMeta } from '../utils/descripcionMeta';
import { getMuebleById, getDisponibilidad } from '../services/api';
import { CartContext, CESTA_LLENA } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { AuthContext } from '../context/AuthContext';
import { formatPrice, textoPrecio, tienePrecio } from '../utils/format';
import { rutaPreguntarPorPieza, TEXTO_PREGUNTAR } from '../utils/preguntarPorPieza';
import { PLACEHOLDER_IMG, obtenerVariantesWebp } from '../utils/images';
import '../styles/ProductDetail.css';
import ReferenciaProducto from '../components/ReferenciaProducto';
import ModalContacto from '../components/ModalContacto';
import { reservasActivas, sumarDias, fechaSinDia } from '../utils/reservas';
import { extraerMedidas } from '../utils/medidas';

// Reservas por fechas (docs/reservas-diseno.md, 6.2): el calendario y el paso de confirmación solo se
// descargan si el interruptor está encendido y la pieza se puede alquilar.
const PanelReserva = lazy(() => import('../components/reservas/PanelReserva'));
// Modo admin (BarraAdmin.jsx): solo se descarga con la sesión de un administrador.
const BarraAdmin = lazy(() => import('../components/BarraAdmin'));

// Hasta qué día tiene reservas una pieza que no se puede comprar por ellas: el día antes del primero
// libre (`comprable_desde`, 7.1).
const textoReservasHasta = (comprableDesde) =>
  comprableDesde
    ? `Esta pieza tiene reservas hasta el ${fechaSinDia(sumarDias(comprableDesde, -1))}.`
    : 'Esta pieza tiene reservas.';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cestaLlena } = useContext(CartContext);
  const { favorites, toggleFavorite } = useContext(FavoritesContext);
  const esAdmin = useContext(AuthContext)?.user?.rol === 'admin';
  const [mueble, setMueble] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');
  const [openAccordion, setOpenAccordion] = useState('');
  const [modalidad, setModalidad] = useState('compra');
  const [modalContactoAbierto, setModalContactoAbierto] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const ctaRef = useRef(null);

  const conReservas = reservasActivas();
  const [disponibilidad, setDisponibilidad] = useState({ para: null });
  const [recargas, setRecargas] = useState(0);
  const muebleId = mueble?.id;

  useEffect(() => {
    const fetchMueble = async () => {
      setLoading(true);
      try {
        const data = await getMuebleById(id);
        if (data) {
          setMueble(data);
          setMainImage(data.imagenes && data.imagenes.length > 0 
            ? data.imagenes[0] 
            : PLACEHOLDER_IMG);
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

  useEffect(() => {
    if (!conReservas || !muebleId) return undefined;
    let vigente = true;
    const peticion = getDisponibilidad(muebleId);
    if (!peticion || typeof peticion.then !== 'function') return undefined;
    peticion.then(({ data } = {}) => {
      if (!vigente) return;
      setDisponibilidad((anterior) =>
        data
          ? { para: muebleId, estado: 'lista', datos: data }
          : anterior.para === muebleId
            ? anterior
            : { para: muebleId, estado: 'fallo' }
      );
    }).catch(() => {
      if (!vigente) return;
      setDisponibilidad((anterior) =>
        anterior.para === muebleId ? anterior : { para: muebleId, estado: 'fallo' }
      );
    });
    return () => {
      vigente = false;
    };
  }, [conReservas, muebleId, recargas]);

  // Barra sticky inferior al perder de vista el CTA principal
  useEffect(() => {
    if (!ctaRef.current) return undefined;

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          const rect = entry.boundingClientRect;
          const yaPasoElCta = rect.top < 0;
          setStickyVisible(!entry.isIntersecting && yaPasoElCta);
        },
        { threshold: 0 }
      );
      observer.observe(ctaRef.current);
      return () => observer.disconnect();
    }

    const onScroll = () => {
      if (!ctaRef.current) return;
      const rect = ctaRef.current.getBoundingClientRect();
      setStickyVisible(rect.bottom < 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mueble]);

  // Coordinación con modo admin: registrar altura de barra sticky para no solapar
  useEffect(() => {
    const raiz = document.documentElement.style;
    if (stickyVisible) {
      raiz.setProperty('--alto-barra-sticky', '72px');
    } else {
      raiz.removeProperty('--alto-barra-sticky');
    }
    return () => {
      raiz.removeProperty('--alto-barra-sticky');
    };
  }, [stickyVisible]);

  const jsonLdFicha = mueble ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        'name': mueble.nombre,
        'image': (mueble.imagenes && mueble.imagenes.length > 0) ? mueble.imagenes : ['https://www.nave5barcelona.com/og-image.png'],
        'description': descripcionParaMeta(mueble),
        'itemCondition': 'https://schema.org/UsedCondition',
        'offers': {
          '@type': 'Offer',
          'price': mueble.precio_venta || (mueble.precio_alquiler_dia ? mueble.precio_alquiler_dia : 0),
          'priceCurrency': 'EUR',
          'availability': mueble.estado === 'disponible' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          'url': `https://www.nave5barcelona.com/mueble/${mueble.id}`,
          'itemCondition': 'https://schema.org/UsedCondition'
        }
      },
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Inicio',
            'item': 'https://www.nave5barcelona.com/'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Catálogo',
            'item': 'https://www.nave5barcelona.com/catalogo'
          },
          ...(mueble.categoria ? [{
            '@type': 'ListItem',
            'position': 3,
            'name': mueble.categoria,
            'item': `https://www.nave5barcelona.com/catalogo?categoria=${encodeURIComponent(mueble.categoria)}`
          }] : []),
          {
            '@type': 'ListItem',
            'position': mueble.categoria ? 4 : 3,
            'name': mueble.nombre,
            'item': `https://www.nave5barcelona.com/mueble/${mueble.id}`
          }
        ]
      }
    ]
  } : null;

  useDocumentMeta({
    title: mueble?.nombre,
    description: mueble ? descripcionParaMeta(mueble) : undefined,
    image: mueble?.imagenes?.[0],
    url: mueble ? `/mueble/${mueble.id}` : undefined,
    canonical: mueble ? `/mueble/${mueble.id}` : undefined,
    jsonLd: jsonLdFicha
  });

  if (loading) {
    return (
      <div className="pd-container pd-skeleton" aria-busy="true">
        <div className="pd-top-nav">
          <span className="pd-back-link" style={{ visibility: 'hidden' }}>&larr; Volver a la colección</span>
        </div>
        <div className="pd-grid">
          <div className="pd-gallery">
            <div className="pd-main-image-wrapper">
              <div className="pd-loader" role="status" aria-label="Cargando pieza..."></div>
            </div>
          </div>
          <div className="pd-info">
            <div className="pd-skeleton-header">
              <div className="pd-skeleton-line pd-skeleton-ref"></div>
              <div className="pd-skeleton-line pd-skeleton-title"></div>
              <div className="pd-skeleton-line pd-skeleton-price"></div>
            </div>
            <div className="pd-skeleton-block"></div>
          </div>
        </div>
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
    addToCart(mueble, conReservas ? 'compra' : modalidad);
  };

  const preguntar = mueble.estado !== 'vendido' && mueble.estado !== 'alquilado' && !tienePrecio(mueble);

  const disp = conReservas && disponibilidad.para === mueble.id ? disponibilidad : null;
  const datosDisp = disp?.estado === 'lista' ? disp.datos : null;
  const alquiladaAMano = conReservas && mueble.estado === 'alquilado';
  const conCalendario = Boolean(
    datosDisp?.alquilable && datosDisp.precio_dia_centimos != null && mueble.estado !== 'alquilado'
  );

  const datosDispNormalizados = datosDisp ? {
    ...datosDisp,
    precio_dia_centimos: datosDisp.precio_dia_centimos ?? (mueble.precio_alquiler_dia ? Math.round(Number(mueble.precio_alquiler_dia) * 100) : null)
  } : null;

  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.log('[ProductDetail Reservas]', {
      conReservas,
      muebleId: mueble.id,
      referencia: mueble.referencia,
      precioAlquilerDia: mueble.precio_alquiler_dia,
      estado: mueble.estado,
      disponibilidad,
      datosDisp,
      conCalendario
    });
  }

  const bloqueadaPorReservas =
    datosDisp?.comprable === false && datosDisp.motivo_no_comprable === 'reservas_activas';
  const noComprable = datosDisp?.comprable === false;
  const vendidaEnCalendario = datosDisp?.motivo_no_comprable === 'vendida';
  const sinCompra = conReservas && !mueble.precio_venta && mueble.estado !== 'vendido' && mueble.estado !== 'alquilado';

  const medidasExtraidas = extraerMedidas(mueble.descripcion);

  return (
    <div className={`pd-container ${esAdmin ? 'con-barra-admin' : ''} ${stickyVisible ? 'con-barra-sticky' : ''}`}>
      {esAdmin && (
        <Suspense fallback={null}>
          <BarraAdmin
            mueble={mueble}
            onEstadoCambiado={(estado) => {
              setMueble((actual) => ({ ...actual, estado }));
              setRecargas((n) => n + 1);
            }}
          />
        </Suspense>
      )}

      {/* Navegación superior con botón volver */}
      <div className="pd-top-nav">
        <button onClick={() => navigate(-1)} className="pd-back-link" aria-label="Volver a la colección">
          &larr; Volver a la colección
        </button>
      </div>

      <div className="pd-grid">
        {/* COLUMNA IZQUIERDA (60%): GALERÍA DE FOTOS */}
        <div className="pd-gallery">
          <div className="pd-main-image-wrapper">
            {(() => {
              const habilitarWebp = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEBP_OPTIMIZADAS === 'true';
              const variantesWebp = habilitarWebp ? obtenerVariantesWebp(mainImage) : null;
              return (
                <picture className="pd-main-image-picture">
                  {variantesWebp && (
                    <source
                      type="image/webp"
                      srcSet={variantesWebp.srcset}
                      sizes="(max-width: 768px) 100vw, 600px"
                    />
                  )}
                  <img
                    key={mainImage}
                    src={mainImage}
                    alt={mueble.nombre}
                    width="600"
                    height="600"
                    className={`pd-main-image ${mueble.estado === 'vendido' ? 'pd-main-image--sold' : ''}`}
                    decoding="async"
                    loading="eager"
                    // React 18 solo reconoce la grafía en minúsculas: con "fetchPriority" avisa de
                    // prop desconocida. ESLint (react/no-unknown-property) espera la de React 19.
                    // eslint-disable-next-line react/no-unknown-property
                    fetchpriority="high"
                  />
                </picture>
              );
            })()}
            {mueble.estado === 'vendido' && <div className="pd-status-banner sold">Vendido</div>}
            {mueble.estado === 'alquilado' && <div className="pd-status-banner rented">Alquilado</div>}
          </div>

          {mueble.imagenes && mueble.imagenes.length > 1 && (
            <div className="pd-thumbnails" role="region" aria-label="Galería de imágenes">
              {mueble.imagenes.map((img, index) => {
                const habilitarWebp = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEBP_OPTIMIZADAS === 'true';
                const variantesThumb = habilitarWebp ? obtenerVariantesWebp(img) : null;
                return (
                  <button 
                    key={index} 
                    className={`pd-thumbnail-btn ${mainImage === img ? 'active' : ''}`}
                    onClick={() => setMainImage(img)}
                    aria-label={`Ver imagen ${index + 1}`}
                  >
                    <picture className="pd-thumbnail-picture">
                      {variantesThumb && (
                        <source
                          type="image/webp"
                          srcSet={`${variantesThumb.w400} 400w`}
                          sizes="80px"
                        />
                      )}
                      <img
                        src={img}
                        alt={`Miniatura ${index + 1}`}
                        className="pd-thumbnail-img"
                        width="80"
                        height="80"
                        loading="lazy"
                        decoding="async"
                        // eslint-disable-next-line react/no-unknown-property
                        fetchpriority="low"
                      />
                    </picture>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA (40%): INFORMACIÓN Y ACCIONES */}
        <div className="pd-info">
          {/* Breadcrumbs */}
          <nav className="pd-breadcrumbs" aria-label="Migas de pan">
            <Link to="/" className="pd-breadcrumb-link">Inicio</Link>
            <span className="pd-breadcrumb-sep">/</span>
            <Link to="/#catalogo" className="pd-breadcrumb-link">Catálogo</Link>
            <span className="pd-breadcrumb-sep">/</span>
            <span className="pd-breadcrumb-current">{mueble.categoria || 'Selected Collection'}</span>
          </nav>

          {/* Título Enorme y Favoritos */}
          <div className="pd-title-header">
            <h1 className="pd-title font-display">{mueble.nombre}</h1>
            <button 
              className="pd-fav-btn" 
              onClick={() => toggleFavorite(mueble.id)} 
              aria-label="Añadir a favoritos"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={favorites.includes(mueble.id) ? "var(--accent-color)" : "none"} stroke={favorites.includes(mueble.id) ? "var(--accent-color)" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {/* Referencia pequeña debajo del título */}
          <ReferenciaProducto referencia={mueble.referencia} className="pd-ref ref-producto--etiqueta" />

          {/* Precio si está activo o texto configurado */}
          <p className="pd-price font-display">{textoPrecio(mueble)}</p>

          {/* CTA Principal */}
          <div className="pd-actions-form" ref={ctaRef}>
            {mueble.estado === 'vendido' || vendidaEnCalendario ? (
              <button className="pd-cta-btn pd-cta-sold" disabled>
                Agotado
              </button>
            ) : mueble.estado === 'alquilado' ? (
              <>
                <button className="pd-cta-btn pd-cta-rented" disabled>
                  Actualmente alquilado
                </button>
                {alquiladaAMano && (
                  <p className="pd-aviso-reservas">
                    Ahora mismo está alquilada. Si te interesa, pregúntanos cuándo estará libre.{' '}
                    <Link to={rutaPreguntarPorPieza(mueble)}>{TEXTO_PREGUNTAR}</Link>
                  </p>
                )}
              </>
            ) : preguntar ? (
              <button
                type="button"
                className="pd-cta-btn pd-cta-solicitar"
                onClick={() => setModalContactoAbierto(true)}
              >
                Solicitar información
              </button>
            ) : sinCompra ? (
              disp && !conCalendario && (
                <button
                  type="button"
                  className="pd-cta-btn pd-cta-solicitar"
                  onClick={() => setModalContactoAbierto(true)}
                >
                  Solicitar información
                </button>
              )
            ) : (
              <>
                <div className="pd-quantity-wrapper">
                  <label className="pd-label">Cantidad</label>
                  <div className="pd-quantity-selector">
                    <button className="pd-qty-btn" disabled>−</button>
                    <span className="pd-qty-val">1</span>
                    <button className="pd-qty-btn" disabled>+</button>
                  </div>
                </div>

                {!conReservas && (
                  <div className="pd-options-wrapper">
                    <label className="pd-label">Modalidad</label>
                    <div className="pd-options-grid">
                      <button 
                        className={`pd-option-btn ${modalidad === 'compra' ? 'active' : ''}`}
                        disabled={mueble.estado === 'vendido'}
                        onClick={() => setModalidad('compra')}
                      >
                        <span className="pd-opt-title">Comprar pieza única</span>
                        {mueble.precio_venta && <span className="pd-opt-price">{formatPrice(mueble.precio_venta)} €</span>}
                      </button>
                      <button 
                        className={`pd-option-btn outline ${modalidad === 'alquiler' ? 'active' : ''}`}
                        disabled={!mueble.precio_alquiler_dia || mueble.estado === 'vendido'}
                        onClick={() => setModalidad('alquiler')}
                      >
                        <span className="pd-opt-title">Alquilar por días</span>
                        {mueble.precio_alquiler_dia ? <span className="pd-opt-price">{formatPrice(mueble.precio_alquiler_dia)} €/día</span> : <span className="pd-opt-price">No disponible</span>}
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  className="pd-cta-btn pd-cta-comprar" 
                  disabled={mueble.estado === 'vendido' || mueble.estado === 'alquilado' || cestaLlena || noComprable}
                  onClick={handleAddToCart}
                  aria-describedby={bloqueadaPorReservas ? 'pd-aviso-reservas' : undefined}
                >
                  {cestaLlena ? 'Cesta llena' : 'Añadir a mi cesta'}
                </button>

                <button
                  type="button"
                  className="pd-cta-btn pd-cta-secondary"
                  onClick={() => setModalContactoAbierto(true)}
                >
                  Solicitar información
                </button>

                {cestaLlena && mueble.estado !== 'vendido' && mueble.estado !== 'alquilado' && (
                  <p className="pd-cesta-llena" role="status">{CESTA_LLENA}</p>
                )}
                {bloqueadaPorReservas && (
                  <p id="pd-aviso-reservas" className="pd-aviso-reservas">
                    {textoReservasHasta(datosDisp.comprable_desde)} Si quieres comprarla, pregúntanos.{' '}
                    <Link to={rutaPreguntarPorPieza(mueble)}>{TEXTO_PREGUNTAR}</Link>
                  </p>
                )}
                {alquiladaAMano && (
                  <p className="pd-aviso-reservas">
                    Ahora mismo está alquilada. Si te interesa, pregúntanos cuándo estará libre.{' '}
                    <Link to={rutaPreguntarPorPieza(mueble)}>{TEXTO_PREGUNTAR}</Link>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Iconos de confianza */}
          <div className="pd-trust-badges">
            <div className="pd-trust-badge">
              <div className="pd-trust-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="pd-trust-content">
                <strong className="pd-trust-title">Pieza Única</strong>
                <span className="pd-trust-desc">Solo un ejemplar en stock</span>
              </div>
            </div>

            <div className="pd-trust-badge">
              <div className="pd-trust-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <div className="pd-trust-content">
                <strong className="pd-trust-title">Restaurado a mano</strong>
                <span className="pd-trust-desc">En taller artesanal</span>
              </div>
            </div>

            <div className="pd-trust-badge">
              <div className="pd-trust-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </div>
              <div className="pd-trust-content">
                <strong className="pd-trust-title">Envío desde Barcelona</strong>
                <span className="pd-trust-desc">Transporte especializado</span>
              </div>
            </div>
          </div>

          {/* Descripción con tipografía refinada e interlineado */}
          <div className="pd-description">
            <p>{mueble.descripcion}</p>
          </div>

          {conCalendario && (
            <Suspense fallback={null}>
              <PanelReserva
                key={mueble.id}
                mueble={mueble}
                disponibilidad={datosDispNormalizados}
                onRecargar={() => setRecargas((n) => n + 1)}
                precioEnCabecera={!mueble.precio_venta}
              />
            </Suspense>
          )}

          {/* ACORDEÓN DE DETALLES TÉCNICOS Y ENVÍOS */}
          <div className="pd-accordion-container">
            <div className="pd-accordion-item">
              <button className="pd-accordion-header" onClick={() => toggleAccordion('details')}>
                <span>Detalles del artículo</span>
                <span className="pd-accordion-icon">{openAccordion === 'details' ? '−' : '+'}</span>
              </button>
              <div className={`pd-accordion-content ${openAccordion === 'details' ? 'open' : ''}`}>
                <div className="pd-tech-specs">
                  <div className="pd-tech-row">
                    <span className="pd-tech-label">Medidas:</span>
                    <span className="pd-tech-val">{medidasExtraidas}</span>
                  </div>
                  <div className="pd-tech-row">
                    <span className="pd-tech-label">Material / Estado:</span>
                    <span className="pd-tech-val">Madera noble restaurada · Excelente conservación</span>
                  </div>
                  <div className="pd-tech-row">
                    <span className="pd-tech-label">Año / Época:</span>
                    <span className="pd-tech-val">Mediados del siglo XX (c. 1960) · Pieza original única</span>
                  </div>
                </div>
                <p className="pd-tech-p">
                  Esta pieza ha sido cuidadosamente restaurada en nuestro taller. Conserva su carácter original pero con acabados renovados para garantizar su durabilidad y adaptabilidad a espacios modernos.
                </p>
              </div>
            </div>
            
            <div className="pd-accordion-item">
              <button className="pd-accordion-header" onClick={() => toggleAccordion('shipping')}>
                <span>Envíos y devoluciones</span>
                <span className="pd-accordion-icon">{openAccordion === 'shipping' ? '−' : '+'}</span>
              </button>
              <div className={`pd-accordion-content ${openAccordion === 'shipping' ? 'open' : ''}`}>
                <p>
                  Contamos con transporte especializado en muebles delicados (1-2 semanas aprox). Ofrecemos 14 días para devoluciones desde la recepción del producto, siempre conservando el embalaje original.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA STICKY INFERIOR AL HACER SCROLL */}
      {stickyVisible && (
        <aside className="pd-sticky-bar" role="complementary" aria-label="Acciones del producto">
          <div className="pd-sticky-container">
            <div className="pd-sticky-info">
              <img
                src={mainImage || PLACEHOLDER_IMG}
                alt={mueble.nombre}
                className="pd-sticky-thumb"
                loading="lazy"
                decoding="async"
              />
              <div className="pd-sticky-text">
                <span className="pd-sticky-nombre font-display">{mueble.nombre}</span>
                {mueble.referencia && (
                  <span className="pd-sticky-ref">Ref. {mueble.referencia}</span>
                )}
              </div>
            </div>
            <div className="pd-sticky-actions">
              {mueble.estado === 'vendido' || vendidaEnCalendario ? (
                <button className="pd-sticky-btn" disabled>Agotado</button>
              ) : mueble.estado === 'alquilado' ? (
                <button className="pd-sticky-btn" disabled>Alquilado</button>
              ) : (
                <button
                  type="button"
                  className="pd-sticky-btn pd-sticky-btn-primary"
                  onClick={() => setModalContactoAbierto(true)}
                >
                  Solicitar información
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* MODAL DE CONTACTO CON REFERENCIA RELLENADA */}
      {modalContactoAbierto && (
        <ModalContacto
          mueble={mueble}
          onClose={() => setModalContactoAbierto(false)}
        />
      )}
    </div>
  );
};

export default ProductDetail;
