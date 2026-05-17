import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMuebles } from '../services/api';
import ProductCard from '../components/ProductCard';
import CategorySlider from '../components/CategorySlider';
import { FavoritesContext } from '../context/FavoritesContext';
import '../styles/Catalog.css';

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaUrl = searchParams.get('categoria');
  const showFavorites = searchParams.get('favorites') === 'true';

  // 🛡️ Extraemos favorites de forma segura por si el contexto está vacío al cargar
  const context = useContext(FavoritesContext);
  const favorites = context ? context.favorites : [];

  const [todosLosMuebles, setTodosLosMuebles] = useState([]);
  const [mueblesFiltrados, setMueblesFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState('recomendados');

  // 1. Cargar datos usando el servicio centralizado (nunca fetch manual)
  useEffect(() => {
    const fetchMuebles = async () => {
      try {
        setLoading(true); // Aseguramos que salgan los skeletons al cargar
        const data = await getMuebles();
        setTodosLosMuebles(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error cargando muebles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMuebles();
  }, []);

  // 2. Filtrar y ordenar reactivamente — NUNCA muta todosLosMuebles
  useEffect(() => {
    let resultado = [...todosLosMuebles];

    // Filtro: favoritos tiene prioridad (Blindado contra arrays de objetos)
    if (showFavorites) {
      resultado = resultado.filter(m =>
        favorites.some(fav => fav === m.id || fav.id === m.id)
      );
    }
    // Filtro: Categoría
    else if (categoriaUrl) {
      resultado = resultado.filter(m =>
        m.categoria && m.categoria.toLowerCase() === categoriaUrl.toLowerCase()
      );
    }

    // Ordenación por precio
    if (orden === 'menor') {
      resultado.sort((a, b) => a.precio_venta - b.precio_venta);
    } else if (orden === 'mayor') {
      resultado.sort((a, b) => b.precio_venta - a.precio_venta);
    }

    setMueblesFiltrados(resultado);
  }, [todosLosMuebles, categoriaUrl, showFavorites, favorites, orden]);

  // ⚡ Función limpia para el botón de "Ver todo"
  const limpiarFiltros = () => {
    setSearchParams({});
    setOrden('recomendados');
  };

  return (
    <div className="catalog-container">
      {/* CABECERA EDITORIAL (TU DISEÑO ORIGINAL) */}
      <header className="catalog-header">
        <span style={{ fontSize: '11px', letterSpacing: '2px', color: '#8c8c8c', textTransform: 'uppercase' }}>
          {showFavorites ? 'Tu Selección' : (categoriaUrl ? 'Colección Seleccionada' : 'Catálogo')}
        </span>
        <h1 style={{ textTransform: 'capitalize' }}>
          {showFavorites ? 'Tus Favoritos' : (categoriaUrl || 'Colección Completa')}
        </h1>
        <p>
          {showFavorites
            ? 'Piezas que te han enamorado.'
            : categoriaUrl
              ? `Descubre la elegancia y versatilidad de nuestra colección de ${categoriaUrl.toLowerCase()}.`
              : 'Encuentra la pieza perfecta para tu espacio. Restaurada con pasión y cuidado.'}
        </p>

        {/* BOTÓN LIMPIEZA DE FILTRO REPARADO */}
        {categoriaUrl && !showFavorites && (
          <button
            className="catalog-clear-filter"
            onClick={limpiarFiltros}
          >
            ← Ver toda la colección
          </button>
        )}

        {/* SELECTOR DE ORDENACIÓN */}
        <select
          className="catalog-sort-select"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
        >
          <option value="recomendados">Recomendados</option>
          <option value="menor">Precio: Menor a Mayor</option>
          <option value="mayor">Precio: Mayor a Menor</option>
        </select>
      </header>

      {!showFavorites && <CategorySlider />}

      {/* SKELETON LOADERS mientras carga */}
      {loading ? (
        <div className="products-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-text-title"></div>
              <div className="skeleton-text-desc"></div>
            </div>
          ))}
        </div>
      ) : mueblesFiltrados.length > 0 ? (
        <div
          key={categoriaUrl || 'all'}
          className="products-grid products-grid--animated"
        >
          {mueblesFiltrados.map((mueble, index) => (
            <div
              key={mueble.id}
              className="product-card-animated"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              <ProductCard mueble={mueble} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{showFavorites ? 'Aún no tienes favoritos' : 'No hay productos en esta categoría'}</h2>
          <p>Explora nuestro catálogo para encontrar piezas únicas.</p>
        </div>
      )}
    </div>
  );
}