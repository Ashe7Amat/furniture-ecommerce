import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMuebles, getCategorias } from '../services/api';
import { textoPrecio } from '../utils/format';
import { useScrollReveal } from '../utils/useScrollReveal';
import { PLACEHOLDER_IMG } from '../utils/images';
import '../styles/Home.css';

// Fotos reales del almacén para el slider del hero (estilo banner rotativo tipo IKEA/Kave Home).
// H42: cada foto en tres tamaños. El hero ocupa todo el ancho de la pantalla: en el móvil (la foto
// arriba, en 4:3) va la de 800 px; hasta 1200 px de pantalla, la de 1200; por encima, el original de
// 1600. hero-showroom es vertical y ya mide 1200 de ancho: no tiene versión de 1200.
const HERO_SLIDES = [
    { src: '/img/hero-almacen.webp', movil: '/img/hero-almacen-800.webp', tableta: '/img/hero-almacen-1200.webp', alt: 'Vista general del almacén de Nave 5 Barcelona' },
    { src: '/img/hero-aerea.webp', movil: '/img/hero-aerea-800.webp', tableta: '/img/hero-aerea-1200.webp', alt: 'Vista aérea del almacén de Nave 5 Barcelona' },
    { src: '/img/hero-sillones.webp', movil: '/img/hero-sillones-800.webp', tableta: '/img/hero-sillones-1200.webp', alt: 'Butacas de cine rojas de época en el almacén de Nave 5' },
    { src: '/img/hero-showroom.webp', movil: '/img/hero-showroom-800.webp', alt: 'Rincón de showroom con sofás y decoración en Nave 5' },
];
// El mismo corte que el CSS del hero (Home.css): por debajo de 768 px, foto arriba y texto debajo.
const HERO_MEDIA_MOVIL = '(max-width: 767.98px)';
const HERO_MEDIA_TABLETA = '(max-width: 1200px)';
const HERO_SLIDE_INTERVAL_MS = 5500;

export default function Home() {
    const [categorias, setCategorias] = useState([]);
    const [destacados, setDestacados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [heroSlide, setHeroSlide] = useState(0);
    const galleryRef = useScrollReveal();
    const sustainabilityRef = useScrollReveal();

    useEffect(() => {
        const timer = setInterval(() => {
            setHeroSlide(prev => (prev + 1) % HERO_SLIDES.length);
        }, HERO_SLIDE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const cargarPortada = async () => {
            try {
                const [dataCat, dataMue] = await Promise.all([
                    getCategorias(),
                    getMuebles({ limit: 4 })
                ]);
                setCategorias(Array.isArray(dataCat) ? dataCat : []);
                setDestacados(Array.isArray(dataMue) ? dataMue : []);
            } catch (error) {
                console.error("Error al alimentar la portada:", error);
            } finally {
                setLoading(false);
            }
        };
        cargarPortada();
    }, []);

    return (
        <>
            {/* HERO A PANTALLA COMPLETA: fuera de .home-page para no quedar limitado a su ancho máximo
                ni a su relleno lateral. En móvil, foto arriba y texto debajo sobre fondo oscuro. */}
            <section className="home-hero">
                <div className="hero-content">
                    <span className="hero-subtitle">Almacén de ideas</span>
                    <h1 className="hero-title">Nave 5{' '}<span className="hero-title-ciudad">Barcelona</span></h1>
                    <p className="hero-description">
                        Un espacio único en el corazón de Barcelona donde el diseño, la restauración y la creatividad se encuentran. Piezas con historia, cuidadas al detalle para dar vida a tus espacios.
                    </p>
                    <Link to="/catalogo" className="btn-hero-black">Descubrir</Link>
                </div>
                <div className="hero-image-box">
                    {HERO_SLIDES.map((slide, i) => (
                        // <picture> no cambia la maqueta: la <img> sigue posicionada respecto a .hero-image-box.
                        <picture key={slide.src}>
                            <source media={HERO_MEDIA_MOVIL} srcSet={slide.movil} />
                            {slide.tableta && <source media={HERO_MEDIA_TABLETA} srcSet={slide.tableta} />}
                            <img
                                src={slide.src}
                                alt={slide.alt}
                                decoding="async"
                                // React 18 solo reconoce la grafía en minúsculas: con "fetchPriority" avisa de
                                // prop desconocida. ESLint (react/no-unknown-property) espera la de React 19.
                                // eslint-disable-next-line react/no-unknown-property
                                fetchpriority={i === 0 ? 'high' : undefined}
                                loading={i === 0 ? undefined : 'lazy'}
                                className={`hero-slide-img${i === heroSlide ? ' is-active' : ''}`}
                            />
                        </picture>
                    ))}
                    <div className="hero-slide-dots">
                        {HERO_SLIDES.map((slide, i) => (
                            <button
                                key={slide.src}
                                type="button"
                                className={`hero-dot${i === heroSlide ? ' is-active' : ''}`}
                                aria-label={`Ver foto ${i + 1} de ${HERO_SLIDES.length}`}
                                aria-current={i === heroSlide}
                                onClick={() => setHeroSlide(i)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <div className="home-page">
                {/* SLIDER DE CATEGORÍAS REALES */}
                <section className="home-slider-section">
                    <h2 className="home-section-title">Compra por categoría</h2>
                    <div className="category-horizontal-slider">
                        {categorias.filter(cat => !cat.categoria_padre_id).map(cat => (
                            // Un enlace, no un div con onClick: se llega con el teclado y se puede abrir en otra
                            // pestaña. La foto no repite el nombre (alt vacío): ya lo dice la etiqueta.
                            <Link
                                key={cat.id}
                                to={`/catalogo?categoria=${cat.nombre}`}
                                className="slider-item-circle"
                            >
                                <div className="circle-wrapper">
                                    <img src={cat.imagen_url} alt="" loading="lazy" decoding="async" />
                                </div>
                                <span className="circle-label">{cat.nombre}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* FEED DE PIEZAS DESTACADAS */}
                <section className="home-featured-section">
                    <div className="featured-header-flex">
                        <h2 className="home-section-title">Piezas destacadas</h2>
                        <Link to="/catalogo" className="link-underline-clean">Ver catálogo completo →</Link>
                    </div>

                    {loading ? (
                        <div className="home-loading-feed">Cargando colecciones de Supabase...</div>
                    ) : (
                        <div className="home-products-grid">
                            {destacados.map(mueble => (
                                <Link to={`/mueble/${mueble.id}`} key={mueble.id} className="home-product-card">
                                    <div className="home-card-img-holder">
                                        <img src={mueble.imagenes?.[0] || PLACEHOLDER_IMG} alt={mueble.nombre} loading="lazy" decoding="async" />
                                        {mueble.estado && <span className={`card-state-tag ${mueble.estado}`}>{mueble.estado.toUpperCase()}</span>}
                                    </div>
                                    <div className="home-card-meta">
                                        <h3>{mueble.nombre}</h3>
                                        <p className="home-card-desc">{mueble.descripcion}</p>
                                        <span className="home-card-price">
                                            {textoPrecio(mueble)}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* GALERÍA DE AMBIENTE */}
                <section className="home-gallery-section reveal-init" ref={galleryRef}>
                    <div className="gallery-grid">
                        <img src="/img/galeria-rincon.webp" alt="Rincón de decoración en el almacén de Nave 5" className="gallery-img" loading="lazy" decoding="async" />
                        <div className="gallery-text-block">
                            <p>Espacios que inspiran. Comparte tu rincón con el hashtag #Nave5Barcelona.</p>
                        </div>
                        <img src="/img/galeria-butacas.webp" alt="Butacas de cine restauradas en el almacén de Nave 5" className="gallery-img" loading="lazy" decoding="async" />
                    </div>
                </section>

                {/* SOSTENIBILIDAD BANNER */}
                <section className="home-sustainability reveal-init" ref={sustainabilityRef}>
                    <div className="sustainability-content">
                        <h2>Diseño con impacto positivo</h2>
                        <p>Muebles creados pensando en el mañana. Trabajamos con madera certificada FSC y materiales reciclados para reducir nuestra huella de carbono sin renunciar a la estética.</p>
                    </div>
                </section>
            </div>
        </>
    );
}