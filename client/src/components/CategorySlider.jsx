import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCategorias } from '../services/api';
import '../styles/CategorySlider.css';

const CategorySlider = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = searchParams.get('category');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategorias().then(data => setCategories(data));
  }, []);

  const handleCategoryClick = (catName) => {
    if (currentCategory === catName) {
      searchParams.delete('category');
    } else {
      searchParams.set('category', catName);
    }
    searchParams.delete('favorites'); // Limpiar favoritos al cambiar categoria
    setSearchParams(searchParams);
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
