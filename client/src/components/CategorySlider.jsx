import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCategorias } from '../services/api';
import { PLACEHOLDER_IMG } from '../utils/images';
import '../styles/CategorySlider.css';

const CategorySlider = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCategory = searchParams.get('categoria'); // ← clave correcta
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    // Solo mostramos las categorías generales aquí (arriba del todo del catálogo);
    // las específicas se eligen desde el desplegable de filtros, más abajo.
    getCategorias().then(data => setCategories(Array.isArray(data) ? data.filter(c => !c.categoria_padre_id) : []));
  }, []);

  const handleCategoryClick = (catName) => {
    if (currentCategory === catName) {
      // Si ya está activa, limpiar filtro → ver todo el catálogo
      navigate('/catalogo');
    } else {
      navigate(`/catalogo?categoria=${encodeURIComponent(catName)}`);
    }
  };

  if (categories.length === 0) return null;

  return (
    <div className="category-slider-wrapper">
      <div className="category-slider">
        {categories.map((cat) => {
          const activa = currentCategory === cat.nombre;
          // Un botón, no un div con onClick (H41): se llega con el tabulador, se activa con Enter o
          // Espacio, y aria-pressed dice si es el filtro puesto (pulsarlo otra vez lo quita). La foto
          // no repite el nombre (alt vacío): ya lo dice la etiqueta, como en la portada (A9).
          return (
            <button
              key={cat.id}
              type="button"
              className={`category-item ${activa ? 'active' : ''}`}
              aria-pressed={activa}
              onClick={() => handleCategoryClick(cat.nombre)}
            >
              <span className="category-img-container">
                <img src={cat.imagen_url || PLACEHOLDER_IMG} alt="" loading="lazy" decoding="async" />
              </span>
              <span className="category-name">{cat.nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySlider;
