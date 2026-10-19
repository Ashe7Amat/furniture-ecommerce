import { useEffect, useState, useContext, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDocumentMeta } from '../utils/useDocumentMeta';
import { descripcionParaMeta } from '../utils/descripcionMeta';
import { getMuebleById, getDisponibilidad } from '../services/api';
import { CartContext, CESTA_LLENA } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { formatPrice, textoPrecio, tienePrecio } from '../utils/format';
import { rutaPreguntarPorPieza, TEXTO_PREGUNTAR } from '../utils/preguntarPorPieza';
import { PLACEHOLDER_IMG } from '../utils/images';
import '../styles/ProductDetail.css';
import ReferenciaProducto from '../components/ReferenciaProducto';
import { reservasActivas, sumarDias, fechaCorta } from '../utils/reservas';

// Reservas por fechas (docs/reservas-diseno.md, 6.2): el calendario y el paso de confirmación solo se
// descargan si el interruptor está encendido y la pieza se puede alquilar.
const PanelReserva = lazy(() => import('../components/reservas/PanelReserva'));

// Hasta qué día tiene reservas una pieza que no se puede comprar por ellas: el día antes del primero
// libre (`comprable_desde`, 7.1).
const textoReservasHasta = (comprableDesde) =>
  comprableDesde
    ? `Esta pieza tiene reservas hasta el ${fechaCorta(sumarDias(comprableDesde, -1))}.`
    : 'Esta pieza tiene reservas.';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // addToCart ya muestra su propio toast de confirmación (ver CartContext), así que no
  // hace falta duplicar el aviso aquí.
  const { addToCart, cestaLlena } = useContext(CartContext);
  const { favorites, toggleFavorite } = useContext(FavoritesContext);
  const [mueble, setMueble] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');
  const [openAccordion, setOpenAccordion] = useState('');
  const [modalidad, setModalidad] = useState('compra');
  // Con el interruptor de las reservas encendido: la disponibilidad de la pieza (7.1), guardada con
  // el id que la pidió para no enseñar la de otra pieza mientras llega la nueva. `recargas` la vuelve
  // a pedir (tras un 409 al reservar). Si falla, la ficha se queda como antes: sin calendario y sin
  // bloquear la compra.
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
    getDisponibilidad(muebleId).then(({ data }) => {
      if (!vigente) return;
      // Si falla una recarga, se queda la que había.
      setDisponibilidad((anterior) =>
        data
          ? { para: muebleId, estado: 'lista', datos: data }
          : anterior.para === muebleId
            ? anterior
            : { para: muebleId, estado: 'fallo' }
      );
    });
    return () => {
      vigente = false;
    };
  }, [conReservas, muebleId, recargas]);

  // <title>, descripción e imagen para compartir de esta pieza: "{nombre} | Nave 5 Barcelona", el
  // principio de su descripción y su primera foto (la de portada, aunque se esté viendo otra). Mientras
  // carga, o si no existe, las de la web. Solo cambian con JavaScript: las vistas previas de WhatsApp
  // o redes leen el index.html y siguen viendo las de la portada (H34).
  useDocumentMeta({
    title: mueble?.nombre,
    description: mueble ? descripcionParaMeta(mueble) : undefined,
    image: mueble?.imagenes?.[0],
  });

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

  // Con las reservas, la cesta es solo para comprar (6.1): el alquiler va por el calendario.
  const handleAddToCart = () => {
    addToCart(mueble, conReservas ? 'compra' : modalidad);
  };

  // C3: disponible y sin precios a la vista (ocultos por MOSTRAR_PRECIOS, o sin ninguno), no se
  // compra: se pregunta. Sin precios, "Cantidad" y "Modalidad" no dicen nada (el alquiler saldría
  // "No disponible" aunque lo esté), así que tampoco se enseñan.
  const preguntar = mueble.estado !== 'vendido' && mueble.estado !== 'alquilado' && !tienePrecio(mueble);

  // Reservas por fechas, solo con el interruptor encendido.
  const disp = conReservas && disponibilidad.para === mueble.id ? disponibilidad : null;
  const datosDisp = disp?.estado === 'lista' ? disp.datos : null;
  const conCalendario = Boolean(datosDisp?.alquilable && datosDisp.precio_dia_centimos != null);
  // Con reservas que llegan a hoy o más allá no se puede comprar (6.7): se explica y se ofrece preguntar.
  const bloqueadaPorReservas =
    datosDisp?.comprable === false && datosDisp.motivo_no_comprable === 'reservas_activas';
  // Lo que no se puede comprar según el servidor (7.1) tampoco se ofrece, sea cual sea el motivo: una
  // venta con entrega diferida deja la pieza "disponible" en el catálogo y el pago la rechazaría.
  const noComprable = datosDisp?.comprable === false;
  const vendidaEnCalendario = datosDisp?.motivo_no_comprable === 'vendida';
  // Una pieza disponible sin precio de venta no va a la cesta: se alquila por fechas o se pregunta.
  const sinCompra = conReservas && !mueble.precio_venta && mueble.estado !== 'vendido' && mueble.estado !== 'alquilado';

  return (
    <div className="pd-container">
      <div className="pd-breadcrumb">
        <button onClick={() => navigate(-1)} className="pd-back-link">
          &larr; Volver a la colección
        </button>
      </div>

      <div className="pd-grid">
        {/* COLUMNA IZQUIERDA: GALERIA VISUAL */}
        <div className="pd-gallery">
          <div className="pd-main-image-wrapper">
            <img key={mainImage} src={mainImage} alt={mueble.nombre} className="pd-main-image" decoding="async" />
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
                  <img src={img} alt={`Miniatura ${index + 1}`} className="pd-thumbnail-img" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: INFO Y ACCIONES */}
        <div className="pd-info">
          <span className="pd-category">{mueble.categoria || 'Selected Collection'}</span>
          <div className="pd-title-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="pd-title font-display">{mueble.nombre}</h1>
            <button 
              className="icon-btn" 
              onClick={() => toggleFavorite(mueble.id)} 
              style={{ cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: '8px' }}
              aria-label="Añadir a favoritos"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill={favorites.includes(mueble.id) ? "var(--accent-color)" : "none"} stroke={favorites.includes(mueble.id) ? "var(--accent-color)" : "var(--primary-color)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="header-icon-svg">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
          {/* A6: la referencia real (NAV-SIL-001). Sustituye a la "Ref. SKU-…" que había al final de
              la ficha, inventada con los 6 primeros caracteres del id. */}
          <ReferenciaProducto referencia={mueble.referencia} className="pd-ref ref-producto--etiqueta" />
          {/* C2: antes, sin precio de venta salía "Consultar precio" aunque tuviera precio de alquiler */}
          <p className="pd-price font-display">{textoPrecio(mueble)}</p>
          
          <div className="pd-description">
            <p>{mueble.descripcion}</p>
          </div>

          <div className="pd-actions-form">
            {preguntar ? (
              <Link to={rutaPreguntarPorPieza(mueble)} className="pd-cta-btn pd-cta-link">
                {TEXTO_PREGUNTAR}
              </Link>
            ) : sinCompra ? (
              // Con las reservas, una pieza sin precio de venta no se compra en la web: se alquila con el
              // calendario de abajo o, si no lo hay (no se puede alquilar, o falló la disponibilidad),
              // se pregunta.
              disp && !conCalendario && (
                <Link to={rutaPreguntarPorPieza(mueble)} className="pd-cta-btn pd-cta-link">
                  {TEXTO_PREGUNTAR}
                </Link>
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

            {/* Con las reservas, la cesta es solo para comprar: sin "Alquilar por días" (6.1). */}
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
              className="pd-cta-btn" 
              disabled={mueble.estado === 'vendido' || mueble.estado === 'alquilado' || cestaLlena || noComprable}
              onClick={handleAddToCart}
              aria-describedby={bloqueadaPorReservas ? 'pd-aviso-reservas' : undefined}
            >
              {mueble.estado === 'vendido' || vendidaEnCalendario ? 'Agotado' : (mueble.estado === 'alquilado' ? 'Actualmente alquilado' : (cestaLlena ? 'Cesta llena' : 'Añadir a mi cesta'))}
            </button>
            {/* H35: con la cesta en el máximo de piezas, se dice por qué no se puede añadir. */}
            {cestaLlena && mueble.estado !== 'vendido' && mueble.estado !== 'alquilado' && (
              <p className="pd-cesta-llena" role="status">{CESTA_LLENA}</p>
            )}
            {bloqueadaPorReservas && (
              <p id="pd-aviso-reservas" className="pd-aviso-reservas">
                {textoReservasHasta(datosDisp.comprable_desde)} Si quieres comprarla, pregúntanos.{' '}
                <Link to={rutaPreguntarPorPieza(mueble)}>{TEXTO_PREGUNTAR}</Link>
              </p>
            )}
            </>
            )}
          </div>

          {conCalendario && (
            <Suspense fallback={null}>
              <PanelReserva
                key={mueble.id}
                mueble={mueble}
                disponibilidad={datosDisp}
                onRecargar={() => setRecargas((n) => n + 1)}
              />
            </Suspense>
          )}

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

        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
