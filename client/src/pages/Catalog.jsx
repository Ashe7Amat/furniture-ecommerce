import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMuebles } from '../services/api';
import ProductCard from '../components/ProductCard';
import CategorySlider from '../components/CategorySlider';
import { FavoritesContext } from '../context/FavoritesContext';
import '../styles/Catalog.css';

const Catalog = () => {
  const [muebles, setMuebles] = useState([]);
  const [filteredMuebles, setFilteredMuebles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { favorites } = React.useContext(FavoritesContext);
  
  const currentCategory = searchParams.get('categoria');
  const showFavorites = searchParams.get('favorites') === 'true';

  useEffect(() => {
    const fetchMuebles = async () => {
      try {
        const data = await getMuebles();
        setMuebles(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchMuebles();
  }, []);

  // Efecto para filtrar localmente sin re-fetching
  useEffect(() => {
    let result = muebles;
    if (showFavorites) {
      result = result.filter(m => favorites.includes(m.id));
    } else if (currentCategory) {
      result = result.filter(m => m.categoria?.toLowerCase() === currentCategory.toLowerCase());
    }
    setFilteredMuebles(result);
  }, [muebles, currentCategory, showFavorites, favorites]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Cargando catálogo...</p>
      </div>
    );
  }

  return (
    <div className="catalog-container">
      <header className="catalog-header">
        <h1>{showFavorites ? 'Tus Favoritos' : (currentCategory ? currentCategory : 'Nuestra Colección')}</h1>
        <p>{showFavorites ? 'Piezas que te han enamorado.' : (currentCategory ? `Descubre la elegancia y versatilidad de nuestra colección de ${currentCategory.toLowerCase()}.` : 'Encuentra la pieza perfecta para tu espacio. Restaurada con pasión y cuidado.')}</p>
      </header>
      
      {!showFavorites && <CategorySlider />}
      
      {(() => {
        const displayMuebles = [...filteredMuebles];
        if (!showFavorites && displayMuebles.length < 8) {
          const mockCards = [
            { id: 'mock-1', nombre: 'Sofá de diseño Elunda', descripcion: 'Lino y madera maciza', precio_venta: 899, imagenes: ['https://images.unsplash.com/photo-1550254478-ead40cc54513?q=80&w=800'] },
            { id: 'mock-2', nombre: 'Mesa auxiliar Tirant', descripcion: 'Mármol travertino y metal', precio_venta: 149, imagenes: ['https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?q=80&w=800'] },
            { id: 'mock-3', nombre: 'Butaca escandinava Björn', descripcion: 'Tela boucle blanca', precio_venta: 320, imagenes: ['https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?q=80&w=800'] },
            { id: 'mock-4', nombre: 'Lámpara de pie Odis', descripcion: 'Acero cepillado negro', precio_venta: 85, imagenes: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800'] },
            { id: 'mock-5', nombre: 'Alfombra tejida Nori', descripcion: '100% yute natural', precio_venta: 110, imagenes: ['https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=800'] },
            { id: 'mock-6', nombre: 'Estantería modular Kross', descripcion: 'Roble claro', precio_venta: 450, imagenes: ['https://images.unsplash.com/photo-1595514535163-0bd9f57bf311?q=80&w=800'] },
            { id: 'mock-7', nombre: 'Mesa de comedor Viena', descripcion: 'Cristal templado y roble', precio_venta: 590, imagenes: ['https://images.unsplash.com/photo-1604578762246-41134e37f9cc?q=80&w=800'] },
            { id: 'mock-8', nombre: 'Silla minimalista Kori', descripcion: 'Madera curvada negra', precio_venta: 125, imagenes: ['https://images.unsplash.com/photo-1503602642458-232111445657?q=80&w=800'] }
          ];
          const missing = 8 - displayMuebles.length;
          displayMuebles.push(...mockCards.slice(0, missing));
        }

        if (displayMuebles.length === 0) {
          return (
            <div className="empty-state">
              <h2>{showFavorites ? 'Aún no tienes favoritos' : 'No hay muebles en esta categoría'}</h2>
              <p>Explora nuestro catálogo para encontrar piezas únicas.</p>
            </div>
          );
        }

        return (
          <div className="products-grid">
            {displayMuebles.map((mueble) => (
              <ProductCard key={mueble.id} mueble={mueble} />
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default Catalog;
