// client/src/components/ProductSkeleton.jsx
import React from 'react';
import '../styles/ProductSkeleton.css';
import '../styles/ProductCard.css'; // Asegura que hereda la estructura general de ProductCard

const ProductSkeleton = () => {
  return (
    <div className="product-card skeleton-card">
      <div className="product-image-container">
        <div className="skeleton-image animate-pulse"></div>
      </div>
      <div className="product-info">
        <div className="skeleton-title animate-pulse"></div>
        <div className="skeleton-desc animate-pulse"></div>
        <div className="skeleton-price animate-pulse"></div>
      </div>
    </div>
  );
};

export default ProductSkeleton;
