import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMuebles, getCategorias, getAjustesHome } from '../services/api';
import { useScrollReveal } from '../utils/useScrollReveal';
import { RUTA_ALQUILER } from '../utils/preguntarPorPieza';
import ProductCard from '../components/ProductCard';
import VistosEn from '../components/VistosEn';
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
// H49: las fotos se apilan dentro de la pantalla (con opacity 0), así que el navegador las descarga todas al
// cargar aunque lleven loading="lazy". Ahora solo hay <img> de la foto que se ve y de las que ya se han
// visto; la siguiente se pide este tiempo después de mostrar la actual, 2,5 s antes de que le toque.
const HERO_PRECARGA_MS = 3000;

export default function Home() {
    const [categorias, setCategorias] = useState([]);
    const [destacados, setDestacados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [heroSlide, setHeroSlide] = useState(0);
    const [heroPedidas, setHeroPedidas] = useState(() => new Set([0]));
    const galleryRef = useScrollReveal();
    const sustainabilityRef = useScrollReveal();
    const slides = HERO_SLIDES;
    const totalSlides = slides.length;

    useEffect(() => {
        const timer = setInterval(() => {
            setHeroSlide(prev => (prev + 1) % totalSlides);
        }, HERO_SLIDE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [totalSlides]);

    // La foto que se ve se queda pedida (para el fundido al salir) y la siguiente se pide poco antes de
    // que le toque. Al pulsar un punto, la foto elegida sale en ese mismo render (ver abajo).
    useEffect(() => {
        const anadir = (i) => setHeroPedidas(prev => (prev.has(i) ? prev : new Set(prev).add(i)));
        anadir(heroSlide);
        const siguiente = (heroSlide + 1) % totalSlides;
        const pedirSiguiente = setTimeout(() => anadir(siguiente), HERO_PRECARGA_MS);
        return () => clearTimeout(pedirSiguiente);
    }, [heroSlide, totalSlides]);

    useEffect(() => {
        const cargarPortada = async () => {
            try {
                const [dataCat, ajustes] = await Promise.all([
                    getCategorias(),
                    getAjustesHome()
                ]);
                setCategorias(Array.isArray(dataCat) ? dataCat : []);

                // Si el panel eligió piezas destacadas, se enseñan EXCLUSIVAMENTE esas y en su orden. Si ninguna de las
                // elegidas existe ya (borradas), o no hay selección, se vuelve a las 4 más recientes.
                const ids = Array.isArray(ajustes?.productos_destacados) ? ajustes.productos_destacados.map(String) : [];
                let elegidas = [];
                if (ids.length > 0) {
                    const todos = await getMuebles();
                    const porId = new Map((Array.isArray(todos) ? todos : []).map(m => [String(m.id), m]));
                    elegidas = ids.map(id => porId.get(id)).filter(Boolean);
                }
                if (elegidas.length > 0) {
                    setDestacados(elegidas);
                } else {
                    const recientes = await getMuebles({ limit: 4 });
                    setDestacados(Array.isArray(recientes) ? recientes : []);
                }
            } catch (error) {
                console.error("Error al alimentar la portada:", error);
            } finally {
                setLoading(false);
            }
        };
        cargarPortada();
    }, []);

    const fotosGaleria = ['/img/galeria-rincon.webp', '/img/galeria-butacas.webp'];

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
                    {/* Los dos caminos de Nave 5: piezas para casa y piezas para producciones. */}
                    <div className="hero-acciones">
                        <Link to="/catalogo" className="btn-hero-black">Ver catálogo</Link>
                        <Link to={RUTA_ALQUILER} className="btn-hero-outline">Alquilar para rodajes</Link>
                    </div>
                </div>
                <div className="hero-image-box">
                    {slides.map((slide, i) => (heroPedidas.has(i) || i === heroSlide) && (
                        // <picture> no cambia la maqueta: la <img> sigue posicionada respecto a .hero-image-box.
                        <picture key={`${slide.src}-${i}`}>
                            {slide.movil && <source media={HERO_MEDIA_MOVIL} srcSet={slide.movil} />}
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
                    {totalSlides > 1 && (
                    <div className="hero-slide-dots">
                        {slides.map((slide, i) => (
                            <button
                                key={`${slide.src}-${i}`}
                                type="button"
                                className={`hero-dot${i === heroSlide ? ' is-active' : ''}`}
                                aria-label={`Ver foto ${i + 1} de ${totalSlides}`}
                                aria-current={i === heroSlide}
                                onClick={() => setHeroSlide(i)}
                            />
                        ))}
                    </div>
                    )}
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
                        <div className="home-loading-feed">Cargando piezas…</div>
                    ) : (
                        <div className="home-products-grid">
                            {destacados.map(mueble => (
                                <ProductCard key={mueble.id} mueble={mueble} />
                            ))}
                        </div>
                    )}
                </section>

                {/* PRODUCCIONES DONDE HAN SALIDO LAS PIEZAS (no se pinta mientras la lista esté vacía) */}
                <VistosEn />

                {/* GALERÍA DE AMBIENTE */}
                <section className="home-gallery-section reveal-init" ref={galleryRef}>
                    <div className={`gallery-grid${fotosGaleria.length >= 3 ? ' gallery-grid--tres' : ''}`}>
                        <img
                            src={fotosGaleria[0]}
                            alt="Espacio decorativo en Nave 5 Barcelona"
                            className="gallery-img"
                            loading="lazy"
                            decoding="async"
                        />
                        <div className="gallery-text-block">
                            <p>Espacios que inspiran. Comparte tu rincón con el hashtag #Nave5Barcelona.</p>
                        </div>
                        <img
                            src={fotosGaleria[1]}
                            alt="Detalle de muebles restaurados en Nave 5 Barcelona"
                            className="gallery-img"
                            loading="lazy"
                            decoding="async"
                        />
                        {fotosGaleria.length >= 3 && (
                            <img
                                src={fotosGaleria[2]}
                                alt="Ambiente singular en Nave 5 Barcelona"
                                className="gallery-img"
                                loading="lazy"
                                decoding="async"
                            />
                        )}
                    </div>
                </section>

                {/* SEGUNDA VIDA */}
                <section className="home-sustainability reveal-init" ref={sustainabilityRef}>
                    <div className="sustainability-layout">
                        <div className="sustainability-content">
                            <h2>El mueble más sostenible es el que ya existe</h2>
                            <p>No fabricamos nada nuevo. Rescatamos piezas con décadas de historia y las restauramos a mano, con aceites naturales y cera de abejas, para que sigan muchos años más.</p>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}