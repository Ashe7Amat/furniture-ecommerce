import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMuebles, getCategorias } from '../services/api';
import ProductCard from '../components/ProductCard';
import ProductSkeleton from '../components/ProductSkeleton';
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
  const [categorias, setCategorias] = useState([]);
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState('recomendados');

  // 1. Cargar datos usando el servicio centralizado (nunca fetch manual)
  useEffect(() => {
    const fetchDatos = async () => {
      try {
        setLoading(true); // Aseguramos que salgan los skeletons al cargar
        const [mueblesData, categoriasData] = await Promise.all([
          getMuebles(),
          getCategorias()
        ]);
        setTodosLosMuebles(Array.isArray(mueblesData) ? mueblesData : []);
        setCategorias(Array.isArray(categoriasData) ? categoriasData : []);
      } catch (error) {
        console.error('Error cargando muebles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
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

    // Filtro: Disponible
    if (soloDisponibles) {
      resultado = resultado.filter(m => m.estado !== 'vendido' && m.estado !== 'alquilado');
    }

    // Ordenación por precio
    if (orden === 'menor') {
      resultado.sort((a, b) => a.precio_venta - b.precio_venta);
    } else if (orden === 'mayor') {
      resultado.sort((a, b) => b.precio_venta - a.precio_venta);
    }

    setMueblesFiltrados(resultado);
  }, [todosLosMuebles, categoriaUrl, showFavorites, favorites, orden, soloDisponibles]);

  // ⚡ Función limpia para el botón de "Ver todo"
  const limpiarFiltros = () => {
    setSearchParams({});
    setOrden('recomendados');
    setSoloDisponibles(false);
  };

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set('categoria', val);
    } else {
      newParams.delete('categoria');
    }
    setSearchParams(newParams);
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
      </header>

      {!showFavorites && <CategorySlider />}

      {/* PANEL DE FILTROS MINIMALISTA */}
      <div className="catalog-filter-panel">
        <div className="filter-group">
          <label htmlFor="category-select">Categoría</label>
          <select
            id="category-select"
            value={categoriaUrl || ''}
            onChange={handleCategoryChange}
            className="filter-select"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
            ))}
          </select>
        </div>

        <div className="filter-group filter-checkbox-group">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={soloDisponibles}
              onChange={(e) => setSoloDisponibles(e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            Disponible
          </label>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-select">Ordenar por precio</label>
          <select
            id="sort-select"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="filter-select"
          >
            <option value="recomendados">Recomendados</option>
            <option value="menor">Precio: Menor a Mayor</option>
            <option value="mayor">Precio: Mayor a Menor</option>
          </select>
        </div>
      </div>

      {/* SKELETON LOADERS mientras carga */}
      {loading ? (
        <div className="products-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
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