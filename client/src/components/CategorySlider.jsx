import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCategorias } from '../services/api';
import '../styles/CategorySlider.css';

const CategorySlider = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCategory = searchParams.get('categoria'); // ← clave correcta
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategorias().then(data => setCategories(data));
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
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`category-item ${currentCategory === cat.nombre ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat.nombre)}
          >
            <div className="category-img-container">
              <img src={cat.imagen_url || 'https://via.placeholder.com/100'} alt={cat.nombre} />
            </div>
            <span className="category-name">{cat.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategorySlider;
