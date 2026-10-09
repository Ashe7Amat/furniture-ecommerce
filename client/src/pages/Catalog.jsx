import { useState, useEffect, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDocumentMeta } from '../utils/useDocumentMeta';
import { useCatalogView } from '../utils/useCatalogView';
import { getMuebles, getCategorias } from '../services/api';
import ProductCard from '../components/ProductCard';
import ProductsTable from '../components/ProductsTable';
import CatalogViewToggle from '../components/CatalogViewToggle';
import ProductSkeleton from '../components/ProductSkeleton';
import CategorySlider from '../components/CategorySlider';
import { FavoritesContext } from '../context/FavoritesContext';
import { tienePrecio } from '../utils/format';
import { compararPorReferencia, SENTIDO_ASC, SENTIDO_DESC } from '../utils/ordenarPorReferencia';
import '../styles/Catalog.css';

// Array estable para cuando el contexto de favoritos aún no está listo: un `[]` literal
// dentro del componente sería una referencia nueva en cada render, lo que haría que el
// useMemo de abajo se recalculase de más (React compara las dependencias por referencia).
const SIN_FAVORITOS = [];

// Los órdenes del selector "Ordenar por". "recomendados" es el orden en que llegan de la API y el
// de por defecto. Los de precio solo se ofrecen si hay precios (ver ordenPorPrecio, más abajo).
const ORDEN_POR_DEFECTO = 'recomendados';
const ORDENES_PRECIO = ['menor', 'mayor'];
const ORDENES = [ORDEN_POR_DEFECTO, 'referencia_asc', 'referencia_desc', ...ORDENES_PRECIO];

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaUrl = searchParams.get('categoria');
  const showFavorites = searchParams.get('favorites') === 'true';
  // El orden va en la URL (?orden=referencia_asc), como la categoría: sobrevive a recargar la
  // página y el enlace se puede compartir tal cual. Un valor que no conocemos (un enlace viejo o
  // mal copiado) se trata como "recomendados" en vez de dejar el selector en blanco.
  const ordenUrl = searchParams.get('orden');
  const ordenPedido = ORDENES.includes(ordenUrl) ? ordenUrl : ORDEN_POR_DEFECTO;

  // 🛡️ Extraemos favorites de forma segura por si el contexto está vacío al cargar
  const context = useContext(FavoritesContext);
  const favorites = context ? context.favorites : SIN_FAVORITOS;

  const [todosLosMuebles, setTodosLosMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useCatalogView();

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

  // Fase C: con los precios ocultos (MOSTRAR_PRECIOS) todas las piezas llegan sin precio, y ordenar
  // por precio no haría nada. El selector "Ordenar por" sale siempre (por referencia se puede ordenar
  // con o sin precios), pero las dos opciones de precio solo si hay precios. Se decide con el catálogo
  // entero que se ha cargado, no con lo filtrado, para que esas opciones no aparezcan y desaparezcan
  // al cambiar de categoría. Mientras carga se dejan.
  const hayPrecios = useMemo(() => todosLosMuebles.some(tienePrecio), [todosLosMuebles]);
  const ordenPorPrecio = loading || hayPrecios;
  // El orden que se aplica de verdad: uno de precio sin precios (p. ej. un enlace con ?orden=menor
  // cuando los precios están ocultos) se comporta como "recomendados", y así lo enseña el selector.
  const orden = !ordenPorPrecio && ORDENES_PRECIO.includes(ordenPedido) ? ORDEN_POR_DEFECTO : ordenPedido;

  // 2. Filtrar y ordenar — NUNCA muta todosLosMuebles. Con useMemo en vez de un
  // useEffect+setState aparte: se recalcula solo cuando algo relevante cambia, sin
  // provocar un re-render extra de por medio.
  const mueblesFiltrados = useMemo(() => {
    let resultado = [...todosLosMuebles];

    // Filtro: favoritos tiene prioridad (Blindado contra arrays de objetos)
    if (showFavorites) {
      resultado = resultado.filter(m =>
        favorites.some(fav => fav === m.id || fav.id === m.id)
      );
    }
    // Filtro: Categoría (admite tanto una categoría específica como una general,
    // en cuyo caso se incluyen los productos de todas sus categorías hijas)
    else if (categoriaUrl) {
      const catObjetivo = categorias.find(c => c.nombre.toLowerCase() === categoriaUrl.toLowerCase());
      const esGeneral = catObjetivo && !catObjetivo.categoria_padre_id;

      const nombresPermitidos = esGeneral
        ? categorias
            .filter(c => c.categoria_padre_id === catObjetivo.id)
            .map(c => c.nombre.toLowerCase())
        : [categoriaUrl.toLowerCase()];

      resultado = resultado.filter(m =>
        m.categoria && nombresPermitidos.includes(m.categoria.toLowerCase())
      );
    }

    // Filtro: Disponible
    if (soloDisponibles) {
      resultado = resultado.filter(m => m.estado !== 'vendido' && m.estado !== 'alquilado');
    }

    // Ordenación. `orden` ya viene corregido: si es de precio, es que hay precios que ordenar (ver
    // ordenPorPrecio). Por referencia, la misma comparación que la pestaña Inventario del panel:
    // orden natural (NAV-SIL-002 antes que NAV-SIL-010) y las piezas sin referencia al final, en
    // los dos sentidos. "recomendados" deja el orden de la API. Se ordena `resultado`, que ya es
    // una copia: todosLosMuebles no se toca. Vale para las dos vistas (tarjetas y tabla), que
    // pintan las dos mueblesFiltrados.
    if (orden === 'menor') {
      resultado.sort((a, b) => a.precio_venta - b.precio_venta);
    } else if (orden === 'mayor') {
      resultado.sort((a, b) => b.precio_venta - a.precio_venta);
    } else if (orden === 'referencia_asc') {
      resultado.sort((a, b) => compararPorReferencia(a, b, SENTIDO_ASC));
    } else if (orden === 'referencia_desc') {
      resultado.sort((a, b) => compararPorReferencia(a, b, SENTIDO_DESC));
    }

    return resultado;
  }, [todosLosMuebles, categorias, categoriaUrl, showFavorites, favorites, orden, soloDisponibles]);

  // ⚡ Función limpia para el botón de "Ver todo". Vaciar la URL quita también el orden (?orden=),
  // que vuelve así a "recomendados".
  const limpiarFiltros = () => {
    setSearchParams({});
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

  // Como handleCategoryChange: parte de la URL que hay, para no perder la categoría ni los
  // favoritos. "recomendados" es el orden por defecto y no se escribe (la URL queda limpia).
  const handleOrdenChange = (e) => {
    const val = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    if (val && val !== ORDEN_POR_DEFECTO) {
      newParams.set('orden', val);
    } else {
      newParams.delete('orden');
    }
    setSearchParams(newParams);
  };

  const tituloPagina = showFavorites ? 'Tus Favoritos' : (categoriaUrl || 'Catálogo');

  useDocumentMeta({
    title: tituloPagina,
    description: 'Descubre nuestra colección de muebles y piezas únicas restauradas a mano en Nave 5 Barcelona.',
  });

  return (
    <div className="catalog-container">
      {/* CABECERA EDITORIAL (TU DISEÑO ORIGINAL) */}
      <header className="catalog-header">
        <span style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--secondary-color)', textTransform: 'uppercase' }}>
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
            {categorias.filter(cat => !cat.categoria_padre_id).map(general => (
              <optgroup key={general.id} label={general.nombre}>
                <option value={general.nombre}>Todo · {general.nombre}</option>
                {categorias
                  .filter(esp => esp.categoria_padre_id === general.id)
                  .map(esp => (
                    <option key={esp.id} value={esp.nombre}>{esp.nombre}</option>
                  ))}
              </optgroup>
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

        {/* Siempre visible: por referencia se puede ordenar con o sin precios. Las opciones de
            precio, solo si hay precios (ordenPorPrecio). */}
        <div className="filter-group">
          <label htmlFor="sort-select">Ordenar por</label>
          <select
            id="sort-select"
            value={orden}
            onChange={handleOrdenChange}
            className="filter-select"
          >
            <option value="recomendados">Recomendados</option>
            <option value="referencia_asc">Referencia (A-Z)</option>
            <option value="referencia_desc">Referencia (Z-A)</option>
            {ordenPorPrecio && (
              <>
                <option value="menor">Precio: Menor a Mayor</option>
                <option value="mayor">Precio: Mayor a Menor</option>
              </>
            )}
          </select>
        </div>

        <div className="filter-group filter-group--view-toggle">
          <span className="filter-group-label-static">Vista</span>
          <CatalogViewToggle vista={vista} onChange={setVista} />
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
        vista === 'table' ? (
          <ProductsTable productos={mueblesFiltrados} />
        ) : (
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
        )
      ) : (
        <div className={`empty-state${showFavorites ? ' empty-state--favoritos' : ''}`}>
          <h2>{showFavorites ? 'Aún no tienes favoritos' : 'No hay productos en esta categoría'}</h2>
          <p>Explora nuestro catálogo para encontrar piezas únicas.</p>
          {/* H40: una salida en vez de un callejón. Quita la categoría, los favoritos y el filtro de
              disponibles; si no había ninguno (el catálogo entero está vacío), no hay nada que quitar. */}
          {(showFavorites || categoriaUrl || soloDisponibles) && (
            <button type="button" className="empty-state-btn" onClick={limpiarFiltros}>
              {showFavorites ? 'Explorar catálogo' : 'Ver todo el catálogo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}