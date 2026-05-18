import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMuebles, getCategorias } from '../services/api';
import '../styles/Home.css';

export default function Home() {
    const [categorias, setCategorias] = useState([]);
    const [destacados, setDestacados] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const cargarPortada = async () => {
            try {
                const [dataCat, dataMue] = await Promise.all([
                    getCategorias(),
                    getMuebles()
                ]);
                setCategorias(Array.isArray(dataCat) ? dataCat : []);
                setDestacados(Array.isArray(dataMue) ? dataMue.slice(0, 4) : []);
            } catch (error) {
                console.error("Error al alimentar la portada:", error);
            } finally {
                setLoading(false);
            }
        };
        cargarPortada();
    }, []);

    return (
        <div className="home-page">
            {/* HERO BANNER - ESTILO KAVE HOME */}
            <section className="home-hero">
                <div className="hero-content">
                    <span className="hero-subtitle">Almacén de ideas</span>
                    <h1 className="hero-title">Nave 5 Barcelona</h1>
                    <p className="hero-description">
                        Un espacio único en el corazón de Barcelona donde el diseño, la restauración y la creatividad se encuentran. Piezas con historia, cuidadas al detalle para dar vida a tus espacios.
                    </p>
                    <Link to="/catalogo" className="btn-hero-black">Descubrir</Link>
                </div>
                <div className="hero-image-box">
                    <img
                        src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1000"
                        alt="Ambiente Kave Home"
                    />
                </div>
            </section>

            {/* SLIDER DE CATEGORÍAS REALES */}
            <section className="home-slider-section">
                <h2 className="home-section-title">Compra por categoría</h2>
                <div className="category-horizontal-slider">
                    {categorias.map(cat => (
                        <div
                            key={cat.id}
                            className="slider-item-circle"
                            onClick={() => navigate(`/catalogo?categoria=${cat.nombre}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="circle-wrapper">
                                <img src={cat.imagen_url} alt={cat.nombre} />
                            </div>
                            <span className="circle-label">{cat.nombre}</span>
                        </div>
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
                                    <img src={mueble.imagenes?.[0] || 'https://via.placeholder.com/400'} alt={mueble.nombre} />
                                    {mueble.estado && <span className={`card-state-tag ${mueble.estado}`}>{mueble.estado.toUpperCase()}</span>}
                                </div>
                                <div className="home-card-meta">
                                    <h3>{mueble.nombre}</h3>
                                    <p className="home-card-desc">{mueble.descripcion}</p>
                                    <span className="home-card-price">{mueble.precio_venta} €</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* KAVE GALLERY BLOCK */}
            <section className="home-gallery-section">
                <div className="gallery-grid">
                    <img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1000" alt="Interior minimalista" className="gallery-img" />
                    <div className="gallery-text-block">
                        <p>Espacios que inspiran. Comparte tu rincón con el hashtag #KaveHome.</p>
                    </div>
                    <img src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000" alt="Diseño de interiores" className="gallery-img" />
                </div>
            </section>

            {/* SOSTENIBILIDAD BANNER */}
            <section className="home-sustainability">
                <div className="sustainability-content">
                    <h2>Diseño con impacto positivo</h2>
                    <p>Muebles creados pensando en el mañana. Trabajamos con madera certificada FSC y materiales reciclados para reducir nuestra huella de carbono sin renunciar a la estética.</p>
                </div>
            </section>
        </div>
    );
}